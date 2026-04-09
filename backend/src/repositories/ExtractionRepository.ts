import { query } from "../db";

export class ExtractionRepository {
  async findByFileHash(sessionId: string, fileHash: string) {
    const existingRes = await query("SELECT * FROM extractions WHERE session_id = $1 AND file_hash = $2", [sessionId, fileHash]);
    if (existingRes.rowCount && existingRes.rowCount > 0) {
      return existingRes.rows[0];
    }
    return null;
  }

  async createSessionExtractionIndex(sessionId: string) {
    return await query("INSERT INTO sessions (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [sessionId]);
  }

  async saveFailedExtraction(
    extractionId: string, 
    sessionId: string, 
    fileName: string, 
    fileHash: string, 
    s3Url: string | null, 
    rawResponse: string, 
    processingTimeMs: number
  ) {
    await query(
      `INSERT INTO extractions (
        id, session_id, file_name, file_hash, s3_url, raw_llm_response, processing_time_ms, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'FAILED')`,
      [extractionId, sessionId, fileName, fileHash, s3Url || null, rawResponse || "", processingTimeMs]
    );
  }

  async saveSuccessfulExtraction(
      extractionId: string,
      sessionId: string,
      fileName: string,
      fileHash: string,
      s3Url: string | null,
      parsedObject: any,
      rawResponse: string,
      processingTimeMs: number
  ) {
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
        rawResponse || "",
        processingTimeMs
      ]
    );
  }

  async getExtractionsBySessionId(sessionId: string) {
    return await query("SELECT * FROM extractions WHERE session_id = $1 ORDER BY created_at DESC", [sessionId]);
  }

  async getCompleteExtractionsBySessionId(sessionId: string) {
    return await query("SELECT * FROM extractions WHERE session_id = $1 AND status = $2", [sessionId, "COMPLETE"]);
  }

  async getExtractionById(extractionId: string) {
    const res = await query("SELECT * FROM extractions WHERE id = $1", [extractionId]);
    return res.rows[0] || null;
  }

  async getAllExtractionsNamesAndRoles() {
    return await query(`
      SELECT session_id, holder_name, applicable_role, created_at 
      FROM extractions 
      ORDER BY created_at ASC
    `);
  }
}