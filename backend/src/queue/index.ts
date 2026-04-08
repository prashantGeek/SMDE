import { Queue, Worker } from "bullmq";
import { extractDocumentData } from "../services/llm";
import { query } from "../db";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

export const documentQueue = new Queue("documentExtraction", { connection });

export const documentWorker = new Worker("documentExtraction", async job => {
  const { jobId, sessionId, base64Data, mimeType, fileName, fileHash, s3Url } = job.data;
  
  await query("UPDATE jobs SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2", ["PROCESSING", jobId]);

  const startTime = Date.now();
  const llmResult = await extractDocumentData(base64Data, mimeType, fileName);
  const processingTimeMs = Date.now() - startTime;

  const extractionId = crypto.randomUUID();

  if (llmResult.error) {
    // Save failed extraction
    await query(
      "INSERT INTO extractions (id, session_id, file_name, file_hash, s3_url, raw_llm_response, processing_time_ms, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'FAILED')",
      [extractionId, sessionId, fileName, fileHash, s3Url || null, llmResult.rawResponse || "", processingTimeMs]
    );

    // Update job as FAILED
    await query(
      "UPDATE jobs SET status = 'FAILED', extraction_id = $1, error_code = $2, error_message = $3, completed_at = CURRENT_TIMESTAMP WHERE id = $4",
      [extractionId, llmResult.error, "Document extraction failed.", jobId]
    );
    throw new Error(llmResult.error);
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
      fileName,
      fileHash,
      s3Url || null,
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
      llmResult.rawResponse || "",
      processingTimeMs
    ]
  );
  
  // Mark job as COMPLETE
  await query(
    "UPDATE jobs SET status = 'COMPLETE', extraction_id = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2",
    [extractionId, jobId]
  );
  
  return { extractionId };

}, { connection });

documentWorker.on('completed', job => {
  console.log(`Job with id ${job.id} has been completed`);
});

documentWorker.on('failed', (job, err) => {
  console.log(`Job with id ${job?.id} has failed with ${err.message}`);
});
