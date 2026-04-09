import pool, { query } from "../db";

export class SessionRepository {
  async createSessionIfNotExists(sessionId: string) {
    return await query("INSERT INTO sessions (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [sessionId]);
  }

  async getSessionById(sessionId: string) {
    const result = await query("SELECT * FROM sessions WHERE id = $1", [sessionId]);
    return result.rows[0] || null;
  }

  async getAllSessions() {
    return await query(`
      SELECT id, created_at 
      FROM sessions 
      ORDER BY created_at DESC
    `);
  }

  async getSessionData(sessionId: string) {
    // Fetches documents for a session
    return await query(`
      SELECT * 
      FROM extractions 
      WHERE session_id = $1 
      ORDER BY created_at ASC
    `, [sessionId]);
  }

  async getSessionSummaryData(sessionId: string) {
    return await query("SELECT * FROM sessions WHERE id = $1", [sessionId]);
  }

  async getLatestValidation(sessionId: string) {
    return await query(`
      SELECT result_json, created_at
      FROM validations
      WHERE session_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [sessionId]);
  }

  async getValidation(sessionId: string) {
    return await this.getLatestValidation(sessionId);
  }

  async saveValidation(validationId: string, sessionId: string, parsedObject: any) {
    return await query(
      "INSERT INTO validations (id, session_id, result_json) VALUES ($1, $2, $3)",
      [validationId, sessionId, JSON.stringify(parsedObject)]
    );
  }

  async deleteSessionCascade(sessionId: string) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM validations WHERE session_id = $1", [sessionId]);
      await client.query("DELETE FROM jobs WHERE session_id = $1", [sessionId]);
      await client.query("DELETE FROM extractions WHERE session_id = $1", [sessionId]);
      const deleteRes = await client.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
      await client.query("COMMIT");
      return deleteRes;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getAllExtractionNamesAndRoles() {
    return await query(`
      SELECT session_id, holder_name, applicable_role, created_at 
      FROM extractions 
      ORDER BY created_at ASC
    `);
  }
}
