import { JobRepository } from "../repositories/JobRepository";
import { ExtractionRepository } from "../repositories/ExtractionRepository";
import { SessionRepository } from "../repositories/SessionRepository";
import { extractDocumentData, validateSessionDocuments } from "./llm";
import { uploadToS3 } from "./s3";
import crypto from "crypto";

export class DocumentService {
  constructor(
    private jobRepo: JobRepository,
    private extractionRepo: ExtractionRepository,
    private sessionRepo: SessionRepository
  ) {}

  async handleSyncExtraction(file: Express.Multer.File, sessionId: string, fileHash: string) {
    const base64Data = file.buffer.toString("base64");
    const s3Url = await uploadToS3(file.buffer, file.originalname, file.mimetype, sessionId);

    await this.sessionRepo.createSessionIfNotExists(sessionId);

    // Deduplication check
    const existing = await this.extractionRepo.findByFileHash(sessionId, fileHash);
    if (existing) {
      return { isDuplicate: true, data: existing };
    }

    const startTime = Date.now();
    const llmResult = await extractDocumentData(base64Data, file.mimetype, file.originalname);
    const processingTimeMs = Date.now() - startTime;

    const extractionId = crypto.randomUUID();

    if (llmResult.error) {
      await this.extractionRepo.saveFailedExtraction(
        extractionId,
        sessionId,
        file.originalname,
        fileHash,
        s3Url,
        llmResult.rawResponse || "",
        processingTimeMs
      );
      throw new Error(llmResult.error);
    }

    await this.extractionRepo.saveSuccessfulExtraction(
      extractionId,
      sessionId,
      file.originalname,
      fileHash,
      s3Url,
      llmResult.parsedObject,
      llmResult.rawResponse,
      processingTimeMs
    );

    return {
      isDuplicate: false,
      extractionId,
      s3Url,
      parsedObject: llmResult.parsedObject,
      processingTimeMs
    };
  }

  async getSessionOverview(sessionId: string) {
    const docsRes = await this.sessionRepo.getSessionData(sessionId);
    const validRes = await this.sessionRepo.getValidation(sessionId);
    
    // Map existing rows to expected formats
    const documents = docsRes.rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      fileName: row.file_name,
      s3Url: row.s3_url,
      documentType: row.document_type,
      applicableRole: row.applicable_role,
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
    }));

    const validation = validRes.rows[0] ? JSON.parse(validRes.rows[0].result_json) : null;
    return { documents, validation, overallHealth: validation?.overallStatus || "OK", detectedRole: documents.find(d => d.applicableRole && d.applicableRole !== "N/A")?.applicableRole || "UNKNOWN" };
  }
}
