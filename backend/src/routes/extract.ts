import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { uploadMiddleware } from "../middleware/upload";
import { query } from "../db";
import { extractDocumentData } from "../services/llm";
import { documentQueue } from "../queue";
import crypto from "crypto";
import { uploadToS3 } from "../services/s3";

const router = Router();

// Rate limiter for POST /api/extract
const extractLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per `window` (here, per minute)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next, options) => {
    return res.status(429).json({
      error: "RATE_LIMITED",
      message: "Too many requests, please try again later.",
      retryAfterMs: options.windowMs,
    });
  },
});

// Wrap multer to handle errors gracefully as per spec
const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  uploadMiddleware.single("document")(req, res, (err: any) => {
    if (err) {
      if (err.message === "UNSUPPORTED_FORMAT") {
        return res.status(400).json({ error: "UNSUPPORTED_FORMAT", message: "File type not accepted (only jpeg, png, pdf allowed)." });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "FILE_TOO_LARGE", message: "File exceeds 10MB limit." });
      }
      return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
    next();
  });
};

router.post("/", extractLimiter, handleUpload, async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "No document provided. Must include a 'document' field." });
    }

    const mode = req.query.mode === "sync" ? "sync" : "async";
    const sessionId = req.body.sessionId || crypto.randomUUID();

    // 1. Convert to base64 which LLMs expect
    const base64Data = file.buffer.toString("base64");
    const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");

    // 2. Upload to S3
    const s3Url = await uploadToS3(file.buffer, file.originalname, file.mimetype, sessionId);

    // 3. Ensure session exists
    await query("INSERT INTO sessions (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [sessionId]);

    // 3. Deduplication check
    const existingRes = await query("SELECT * FROM extractions WHERE session_id = $1 AND file_hash = $2", [sessionId, fileHash]);
    if (existingRes.rowCount && existingRes.rowCount > 0) {
      const row = existingRes.rows[0];
      res.setHeader("X-Deduplicated", "true");
      
      const responsePayload = {
        id: row.id,
        sessionId: row.session_id,
        fileName: row.file_name,
        s3Url: row.s3_url,
        documentType: row.document_type,
        applicableRole: row.applicable_role,
        category: row.category || "OTHER",
        confidence: row.confidence,
        holderName: row.holder_name,
        dateOfBirth: row.date_of_birth,
        sirbNumber: row.sirb_number,
        passportNumber: row.passport_number,
        nationality: row.nationality,
        rank: row.rank,
        fields: JSON.parse(row.fields_json || "[]"),
        validity: JSON.parse(row.validity_json || "{}"),
        medicalData: JSON.parse(row.medical_data_json || "{}"),
        flags: JSON.parse(row.flags_json || "[]"),
        isExpired: row.is_expired === 1,
        processingTimeMs: row.processing_time_ms,
        summary: row.summary,
        createdAt: row.created_at,
      };

      return res.status(200).json(responsePayload);
    }

    if (mode === "async") {
      const jobId = crypto.randomUUID();
      
      // Save initial QUEUED state
      await query(
        `INSERT INTO jobs (id, session_id, status) VALUES ($1, $2, 'QUEUED')`,
        [jobId, sessionId]
      );
      
      await documentQueue.add("extract", {
        jobId,
        sessionId,
        base64Data,
        mimeType: file.mimetype,
        fileName: file.originalname,
        fileHash,
        s3Url
      });

      return res.status(202).json({
        jobId,
        sessionId,
        status: "QUEUED",
        pollUrl: `/api/jobs/${jobId}`,
        estimatedWaitMs: 6000
      });
    }

    // mode === "sync"
    const startTime = Date.now();
    const llmResult = await extractDocumentData(base64Data, file.mimetype, file.originalname);
    const processingTimeMs = Date.now() - startTime;

    const extractionId = crypto.randomUUID();
    
    if (llmResult.error) {
      // Fallback
      await query(
        `INSERT INTO extractions (
          id, session_id, file_name, file_hash, s3_url, raw_llm_response, processing_time_ms, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'FAILED')`,
        [extractionId, sessionId, file.originalname, fileHash, s3Url, llmResult.rawResponse || "", processingTimeMs]
      );
      
      return res.status(422).json({
        error: llmResult.error,
        message: "Document extraction failed. The raw response has been stored for review.",
        extractionId,
        retryAfterMs: null
      });
    }

    const { parsedObject } = llmResult;

    await query(
      `INSERT INTO extractions (
        id, session_id, file_name, file_hash, s3_url, document_type, applicable_role, confidence,
        holder_name, date_of_birth, sirb_number, passport_number, nationality, rank, fields_json, validity_json,
        medical_data_json, flags_json, is_expired, summary, raw_llm_response, processing_time_ms, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 'COMPLETE')`,
      [
        extractionId,
        sessionId,
        file.originalname,
        fileHash,
        s3Url,
        parsedObject?.detection?.documentType || "OTHER",
        parsedObject?.detection?.applicableRole || "N/A",
        parsedObject?.detection?.confidence || "LOW",
        parsedObject?.holder?.fullName || null,
        parsedObject?.holder?.dateOfBirth || null,
        parsedObject?.holder?.sirbNumber || null,
        parsedObject?.holder?.passportNumber || null,
        parsedObject?.holder?.nationality || null,
        parsedObject?.holder?.rank || null,
        JSON.stringify(parsedObject?.fields || []),
        JSON.stringify(parsedObject?.validity || {}),
        JSON.stringify(parsedObject?.medicalData || {}),
        JSON.stringify(parsedObject?.flags || []),
        parsedObject?.validity?.isExpired ? 1 : 0,
        parsedObject?.summary || null,
        llmResult.rawResponse,
        processingTimeMs
      ]
    );

    return res.status(200).json({
      id: extractionId,
      sessionId,
      fileName: file.originalname,
      s3Url,
      documentType: parsedObject?.detection?.documentType || "OTHER",
      documentName: parsedObject?.detection?.documentName || "",
      applicableRole: parsedObject?.detection?.applicableRole || "N/A",
      category: parsedObject?.detection?.category || "OTHER",
      confidence: parsedObject?.detection?.confidence || "LOW",
      holderName: parsedObject?.holder?.fullName || null,
      dateOfBirth: parsedObject?.holder?.dateOfBirth || null,
      sirbNumber: parsedObject?.holder?.sirbNumber || null,
      passportNumber: parsedObject?.holder?.passportNumber || null,
      fields: parsedObject?.fields || [],
      validity: parsedObject?.validity || {},
      compliance: parsedObject?.compliance || {},
      medicalData: parsedObject?.medicalData || {},
      flags: parsedObject?.flags || [],
      isExpired: parsedObject?.validity?.isExpired || false,
      processingTimeMs,
      summary: parsedObject?.summary || null,
      createdAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Extraction error:", error);
    return res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected server error" });
  }
});

export default router;
