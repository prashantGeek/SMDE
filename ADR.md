# Architecture Decision Record (ADR)

## Question 1 — Sync vs Async
**Decision:** In production, `?mode=async` should be the default.
**Reasoning:** LLM extraction, especially with vision models processing dense images or multipage PDFs, is inherently slow and unpredictable. A synchronous request forces the client to hold a connection open for up to 30 seconds (or more), which is prone to timeouts at the load balancer or proxy level (e.g., Nginx, AWS ALB). By defaulting to async, we guarantee a fast `202 Accepted` response, freeing up server connections and providing the client with a predictable polling mechanism.
**Force Async Threshold:** I would force async regardless of the mode parameter if the uploaded file exceeds 2MB, if the file is a PDF with more than 1 page, or if the server's active concurrent extraction count exceeds a safe threshold (e.g., 50 concurrent requests) to protect the LLM rate limits and memory footprint.

## Question 2 — Queue Choice
**Decision:** BullMQ backed by Redis.
**Reasoning:** BullMQ is a robust, battle-tested queue mechanism for Node.js. It natively understands job states (Queued, Processing, Completed, Failed), supports robust retry strategies, delayed jobs, and isolates the worker processes from the HTTP server threads.
**Scale to 500/min:** If the system needed to handle 500 extractions per minute, a single Redis instance might become a bottleneck or a single worker node might exhaust CPU/Memory. I would migrate to AWS SQS (with Lambda or ECS workers) or an event-streaming platform like Kafka to scale workers horizontally without managing Redis infrastructure.
**Failure Modes:** Current failure modes include Redis OOM (if jobs queue up indefinitely without workers) and dropped jobs if Redis crashes (unless AOF/RDB persistence is perfectly tuned).

## Question 3 — LLM Provider Abstraction
**Decision:** I implemented against one provider directly (OpenAI) tailored with standard environment variables.
**Reasoning:** While building a full abstraction interface (`ExtractionProvider`) is good practice, I deliberately skipped a strict abstract class implementation to prioritize shipping the core logic and reliability features (repair, retry, boundary parsing) within the time constraints. The `llm.ts` service acts as the boundary. To swap to Anthropic or Gemini, only the internal API call inside `extractDocumentData` needs to be rewritten, as the inputs (base64, mime type) and desired output (JSON) remain identical. If I had built the interface, it would look like:
`interface LLMProvider { extract(base64: string, mimeType: string, prompt: string): Promise<string> }`

## Question 4 — Schema Design
**Decision:** Storing dynamic fields in `TEXT` columns holding JSON strings (`fields_json`, `validity_json`).
**Reasoning & Risks:** JSON columns are excellent for handling the variable nature of extracted maritime documents without schema migrations for every new form type. The risk at scale is slow query performance since scanning inside JSON objects requires full table scans.
**Optimization for Full-Text/Queries:** If the system needed to query "all sessions with an expired COC" efficiently, I would extract core indexable fields into top-level typed columns (e.g., `has_expired_coc BOOLEAN` or a relational table `document_flags`). For full-text search across all extracted values, I would stream the extracted JSON payloads into ElasticSearch or use PostgreSQL's `tsvector`/GIN indexes against specific json properties instead of simple `TEXT` fields.

## Question 5 — What You Skipped
List of items deliberately not implemented:
1. **Authentication & Authorization:** The API endpoints are open. A real Manning Agent system would require JWTs or API keys to isolate sessions by tenant. Skipped because it wasn't requested and distracts from the core LLM challenge.
2. **File Storage strategy:** Files are kept in memory (using `multer.memoryStorage`) and sent directly to the LLM. In production, these files should be streamed directly to an S3 bucket with strict IAM access policies, rather than holding 10MB buffers in the Node.js memory space or saving to local disk.
3. **Comprehensive Unit Tests:** While the API is fully functional, I skipped writing an automated Jest suite to verify JSON repair edges or mocked LLM failures to focus on delivering a working end-to-end integration within the time bounds.