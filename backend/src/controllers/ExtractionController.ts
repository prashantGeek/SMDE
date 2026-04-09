import { Request, Response } from "express";
import crypto from "crypto";
import { uploadToS3 } from "../services/s3";
import { extractDocumentData } from "../services/llm";
import { documentQueue } from "../queue";
import { SessionRepository } from "../repositories/SessionRepository";
import { ExtractionRepository } from "../repositories/ExtractionRepository";
import { JobRepository } from "../repositories/JobRepository";

export class ExtractionController {
  constructor(
    private readonly sessionRepository = new SessionRepository(),
    private readonly extractionRepository = new ExtractionRepository(),
    private readonly jobRepository = new JobRepository()
  ) {}

  handleUpload = async (req: Request, res: Response) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: "BAD_REQUEST", message: "No document provided. Must include a 'document' field." });
      }

      const mode = req.query.mode === "sync" ? "sync" : "async";
      const sessionId = (req.body.sessionId as string | undefined) || crypto.randomUUID();

      const base64Data = file.buffer.toString("base64");
      const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
      const s3Url = await uploadToS3(file.buffer, file.originalname, file.mimetype, sessionId);

      await this.sessionRepository.createSessionIfNotExists(sessionId);

      const existingExtraction = await this.extractionRepository.findByFileHash(sessionId, fileHash);
      if (existingExtraction) {
        res.setHeader("X-Deduplicated", "true");
        return res.status(200).json({
          id: existingExtraction.id,
          sessionId: existingExtraction.session_id,
          fileName: existingExtraction.file_name,
          s3Url: existingExtraction.s3_url,
          documentType: existingExtraction.document_type,
          applicableRole: existingExtraction.applicable_role,
          category: existingExtraction.category || "OTHER",
          confidence: existingExtraction.confidence,
          holderName: existingExtraction.holder_name,
          dateOfBirth: existingExtraction.date_of_birth,
          sirbNumber: existingExtraction.sirb_number,
          passportNumber: existingExtraction.passport_number,
          nationality: existingExtraction.nationality,
          rank: existingExtraction.rank,
          fields: JSON.parse(existingExtraction.fields_json || "[]"),
          validity: JSON.parse(existingExtraction.validity_json || "{}"),
          medicalData: JSON.parse(existingExtraction.medical_data_json || "{}"),
          flags: JSON.parse(existingExtraction.flags_json || "[]"),
          isExpired: existingExtraction.is_expired === 1,
          processingTimeMs: existingExtraction.processing_time_ms,
          summary: existingExtraction.summary,
          createdAt: existingExtraction.created_at,
        });
      }

      if (mode === "async") {
        const jobId = crypto.randomUUID();
        await this.jobRepository.createQueuedJob(jobId, sessionId);

        await documentQueue.add("extract", {
          jobId,
          sessionId,
          base64Data,
          mimeType: file.mimetype,
          fileName: file.originalname,
          fileHash,
          s3Url,
        });

        return res.status(202).json({
          jobId,
          sessionId,
          status: "QUEUED",
          pollUrl: `/api/jobs/${jobId}`,
          estimatedWaitMs: 6000,
        });
      }

      const startTime = Date.now();
      const llmResult = await extractDocumentData(base64Data, file.mimetype, file.originalname);
      const processingTimeMs = Date.now() - startTime;
      const extractionId = crypto.randomUUID();

      if (llmResult.error) {
        await this.extractionRepository.saveFailedExtraction(
          extractionId,
          sessionId,
          file.originalname,
          fileHash,
          s3Url,
          llmResult.rawResponse || "",
          processingTimeMs
        );

        return res.status(422).json({
          error: llmResult.error,
          message: "Document extraction failed. The raw response has been stored for review.",
          extractionId,
          retryAfterMs: null,
        });
      }

      const { parsedObject } = llmResult;

      await this.extractionRepository.saveSuccessfulExtraction(
        extractionId,
        sessionId,
        file.originalname,
        fileHash,
        s3Url,
        parsedObject,
        llmResult.rawResponse,
        processingTimeMs
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
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Extraction error:", error);
      return res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected server error" });
    }
  };
}
