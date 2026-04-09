# Smart Maritime Document Extractor (SMDE)

SMDE is a full-stack document intelligence platform for maritime hiring workflows. It extracts structured data from certificates and IDs, tracks async processing jobs, and runs cross-document compliance validation.

## Live Deployment

- Source Repository (GitHub): https://github.com/prashantGeek/SMDE
- Frontend (Vercel): https://smde-one.vercel.app
- Backend (AWS EC2): Hosted on an EC2 instance and exposed through the public API domain (for example, https://smde.stackvise.in)
- Demo Recording (Loom): https://www.loom.com/share/054fd96883a64b1295d5623b0ba9cd60

## Project Architecture (Brief)

- Frontend: Next.js app in `frontend/`
- Backend API: Express + TypeScript in `backend/`
- Database: PostgreSQL
- Queue: BullMQ
- Queue Broker: Redis
- AI Extraction and Validation: Vision-capable LLM (OpenAI)

Async extraction works as:

1. Upload request hits `/api/extract?mode=async`
2. Backend stores metadata and enqueues a BullMQ job
3. Worker consumes job from Redis-backed queue
4. Client polls `/api/jobs/:jobId` until COMPLETE or FAILED

## Core Features

- Intelligent extraction of maritime document fields
- Sync and async processing modes
- Session-based document grouping
- Cross-document compliance validation
- Validation report generation and retrieval
- Rate-limited extraction endpoint

## Local Setup (Postgres + Redis + BullMQ)

### Prerequisites

- Node.js v18+
- Docker Desktop (or Docker Engine + Compose)

### 1. Install dependencies

From project root:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure backend environment

Create and update `backend/.env` with database, Redis, and LLM credentials.

Minimum local values:

- `POSTGRES_HOST=localhost`
- `POSTGRES_PORT=5433`
- `POSTGRES_USER=myuser`
- `POSTGRES_PASSWORD=mypassword`
- `POSTGRES_DB=mydatabase`
- `DATABASE_URL=postgresql://myuser:mypassword@localhost:5433/mydatabase`
- `REDIS_URL=redis://localhost:6379`
- `PORT=8000`
- `OPENAI_API_KEY=<your_key>`

### 3. Start Postgres and Redis with Docker Compose

From `backend/`:

```bash
docker compose up -d
```

This starts:

- Postgres on `localhost:5433`
- Redis on `localhost:6379`

BullMQ does not need a separate container. It runs inside the backend process and uses Redis as its queue backend.

### 4. Start backend

From `backend/`:

```bash
npm run dev
```

Backend runs on `http://localhost:8000`.

### 5. Configure frontend API origin

Set `frontend/.env`:

```env
API_ORIGIN=http://127.0.0.1:8000
```

### 6. Start frontend

From `frontend/`:

```bash
npm run dev
```

Frontend runs on `http://localhost:3000` and proxies `/api/*` to the backend origin via Next.js rewrites.

## API Endpoints

- `POST /api/extract?mode=sync` - Upload and extract immediately
- `POST /api/extract?mode=async` - Upload and enqueue extraction job
- `GET /api/jobs/:jobId` - Poll async job status
- `GET /api/sessions` - List sessions
- `GET /api/sessions/:sessionId` - Get session documents and validation snapshot
- `POST /api/sessions/:sessionId/validate` - Run compliance validation
- `GET /api/sessions/:sessionId/report` - Get compliance report
- `DELETE /api/sessions/:sessionId` - Delete session and related data

## Swagger

- Docs UI: `/docs`
- OpenAPI JSON: `/openapi.json`

## Tech Stack

- Next.js, React, TypeScript
- Express, Node.js
- PostgreSQL, Redis, BullMQ
- OpenAI API