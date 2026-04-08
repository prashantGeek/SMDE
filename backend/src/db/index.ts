import { Pool } from "pg";
import dotenv from "dotenv";

// Ensure environment variables are loaded
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper function to query the database
export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

// Expose the pool directly if needed for transactions
export default pool;
