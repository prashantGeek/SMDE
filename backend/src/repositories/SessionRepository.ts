import { query } from "../db";

export class SessionRepository {
  async createSessionIfNotExists(sessionId: string) {
    return await query("INSERT INTO sessions (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [sessionId]);
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

  async saveValidation(validationId: string, sessionId: string, parsedObject: any) {
    return await query(
      "INSERT INTO validations (id, session_id, result_json) VALUES ($1, $2, $3)",
      [validationId, sessionId, JSON.stringify(parsedObject)]
    );
  }

  async getValidation(sessionId: string) {
    return await query(`
      SELECT * 
      FROM validations 
      WHERE session_id = $1 
      ORDER BY created_at DESC LIMIT 1
    `, [sessionId]);
  }
}
