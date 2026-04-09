# Code Review

**To:** Junior Engineer
**From:** Senior Backend Engineer
**Date:** April 8, 2026
**Subject:** PR Review: feat: add document extraction endpoint

Hey! Great job getting a working prototype up so quickly. Connecting the file upload, base64 conversion, and Anthropic API in one go is a solid first step. The fact that you tested it end-to-end with a real PEME file and verified the JSON parsing means the core pipeline idea is sound.

I've left a few comments below. We need to tighten up security, reliability, and architectural scalability before we merge this to `main`. 

### 1. Hardcoded Credentials (Security)
```typescript
const client = new Anthropic({ apiKey: 'sk-ant-REDACTED' });
```
**Issue:** Hardcoded API keys should never be committed to source control. They can be scraped by bots and abused.
**Fix:** Use environment variables. Change this to `const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });`

### 2. LLM Model Choice (Cost vs Speed)
```typescript
model: 'claude-opus-4-6',
```
**Issue:** Claude Opus is their most powerful model, but also the most expensive and slowest. For document extraction tasks, lighter models often perform just as well.
**Teaching Moment:** When building features that scale with user uploads, we must balance accuracy with unit economics. Let's try `claude-haiku-4-5-20251001` or `gpt-4o-mini` first. If extraction accuracy drops, we can evaluate a dynamic fallback, but Opus as the default will burn through our API budget quickly.

### 3. File Handling & PII (Security & Disk Space)
```typescript
const savedPath = path.join('./uploads', file.originalname);
fs.copyFileSync(file.path, savedPath);
```
**Issue:** Saving maritime documents (which contain sensitive PII like medical history and passport numbers) to the local server disk is a massive security compliance risk. Furthermore, the disk will eventually fill up and crash the server.
**Fix:** We shouldn't save these to local disk. If we need persistent storage, they should be uploaded directly to a secure S3 bucket with strict access policies and lifecycle rules. For now, just process it from memory or a temporary temp-file and delete it immediately.

### 4. Global State Mutations (Architecture)
```typescript
global.extractions = global.extractions || [];
global.extractions.push(result);
```
**Issue:** `global` state in Node.js is shared across all requests. If two users upload documents at the same time, their results will get mixed together. Plus, when the server restarts, all data is lost.
**Fix:** We need to store these results in a database (like PostgreSQL) tied to a specific `sessionId` so users only see their own extractions.

### 5. Missing Failure Recovery (Reliability)
```typescript
const result = JSON.parse(response.content[0].text);
```
**Issue:** LLMs are non-deterministic. Even when asked for JSON, they sometimes return markdown ticks like ` ```json { ... } ``` ` or add text before the JSON. `JSON.parse` will crash the whole request if this happens.
**Fix:** We need a recovery strategy. Try extracting the substring between the first `{` and last `}` using regex before parsing, and gracefully handle the `catch` if it still fails.

### Summary
Really good proof of concept! Let's pair up to tackle the database storage and environment variables first. Once we drop the local disk saving and global arrays, this will be in much better shape for production.