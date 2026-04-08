import pool from "./index";

const initSchema = async () => {
  const schema = `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS extractions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      file_name TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      document_type TEXT,
      applicable_role TEXT,
      confidence TEXT,
      s3_url TEXT,
      holder_name TEXT,
      date_of_birth TEXT,
      sirb_number TEXT,
      passport_number TEXT,
      nationality TEXT,
      rank TEXT,
      fields_json TEXT,         -- Storing JSON data as TEXT for flexibility
      validity_json TEXT,
      medical_data_json TEXT,
      flags_json TEXT,
      is_expired INTEGER DEFAULT 0,
      summary TEXT,
      raw_llm_response TEXT,
      processing_time_ms INTEGER,
      status TEXT DEFAULT 'COMPLETE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      extraction_id TEXT REFERENCES extractions(id),
      status TEXT DEFAULT 'QUEUED',
      error_code TEXT,
      error_message TEXT,
      queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMP,
      completed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS validations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      result_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Add basic indexes for expected queries
    CREATE INDEX IF NOT EXISTS idx_extractions_session_id ON extractions(session_id);
    CREATE INDEX IF NOT EXISTS idx_extractions_file_hash ON extractions(file_hash); -- useful for deduplication
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_session_id ON jobs(session_id);
  `;

  try {
    await pool.query(schema);
    console.log("Database schema initialized successfully.");
  } catch (error) {
    console.error("Error initializing database schema:", error);
    process.exit(1); 
  }
};

export default initSchema;
