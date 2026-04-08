# Smart Maritime Document Extractor (SMDE)

A robust backend service for dynamically extracting structured data from seafarer certifications, passports, and medical exams using vision-capable LLMs.

## Features
- **Intelligent Extraction**: Uses Vision LLMs (e.g. OpenAI `gpt-4o-mini`) to dynamically identify and parse 20+ maritime document types.
- **Sync & Async Modes**: Process small documents instantly or queue large documents for background processing.
- **Reliability Built-in**: Automatic JSON-fencing repairs, confidence-based retries, and strict database state tracking so no upload is ever lost.
- **Cross-Document Validation**: Evaluates compliance across an entire session of documents (e.g. checking if a COC expires before a Medical Exam).
- **Rate-Limited**: Uploads are restricted by IP to prevent abuse.

## Prerequisites
- Node.js v18+
- Docker & Docker Compose (for PostgreSQL and Redis)

## Setup & Run

It takes less than 3 minutes to start the system.

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Setup your environment variables**  
   An `.env` is provided. Modify it with your actual LLM API Keys.
   ```bash
   cp .env.example .env
   ```

3. **Start the database & queue**
   ```bash
   docker compose up -d
   ```

4. **Run the backend server**
   ```bash
   npm run dev
   ```

The API will automatically run database migrations on boot and be available at `http://localhost:8000`.

## API Capabilities

- `POST /api/extract?mode=sync` - Upload and extract a document immediately.
- `POST /api/extract?mode=async` - Upload and queue a document, returning a Job ID.
- `GET /api/jobs/:jobId` - Poll the progress of an async extraction.
- `GET /api/sessions/:sessionId` - Retrieve all extracted documents in a session.
- `POST /api/sessions/:sessionId/validate` - Trigger the LLM to cross-validate compliance across all documents.
- `GET /api/sessions/:sessionId/report` - Get a human-readable compliance overview.

## Tech Stack
Node.js (TypeScript), Express, PostgreSQL (pg), BullMQ, Redis, OpenAI API.