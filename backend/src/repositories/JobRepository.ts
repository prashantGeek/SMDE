import { query } from "../db";

export class JobRepository {
  async createQueuedJob(jobId: string, sessionId: string) {
    await query(
      `INSERT INTO jobs (id, session_id, status) VALUES ($1, $2, 'QUEUED')`,
      [jobId, sessionId]
    );
  }

  async getActiveJobsForSession(sessionId: string) {
    return await query('SELECT id, status FROM jobs WHERE session_id = $1 AND status IN ($2, $3)', [sessionId, 'QUEUED', 'PROCESSING']);
  }

  async markJobProcessing(jobId: string) {
    await query("UPDATE jobs SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2", ["PROCESSING", jobId]);
  }

  async markJobFailed(jobId: string, extractionId: string, errorCode: string, errorMessage: string) {
    await query(
      "UPDATE jobs SET status = 'FAILED', extraction_id = $1, error_code = $2, error_message = $3, completed_at = CURRENT_TIMESTAMP WHERE id = $4",
      [extractionId, errorCode, errorMessage, jobId]
    );
  }

  async markJobComplete(jobId: string, extractionId: string) {
    await query(
      "UPDATE jobs SET status = 'COMPLETE', extraction_id = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2",
      [extractionId, jobId]
    );
  }

  async getJob(jobId: string) {
    const res = await query(`
      SELECT jobs.*, extractions.file_name, extractions.document_type
      FROM jobs 
      LEFT JOIN extractions ON jobs.extraction_id = extractions.id
      WHERE jobs.id = $1
    `, [jobId]);
    return res.rows[0];
  }
}