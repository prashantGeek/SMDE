import { Queue, Worker } from "bullmq";
import { extractDocumentData } from "../services/llm";
import crypto from "crypto";
import dotenv from "dotenv";
import { JobRepository } from "../repositories/JobRepository";
import { ExtractionRepository } from "../repositories/ExtractionRepository";

dotenv.config();

const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

export const documentQueue = new Queue("documentExtraction", { connection });
const jobRepository = new JobRepository();
const extractionRepository = new ExtractionRepository();

export const documentWorker = new Worker("documentExtraction", async job => {
  const { jobId, sessionId, base64Data, mimeType, fileName, fileHash, s3Url } = job.data;
  
  await jobRepository.markJobProcessing(jobId);

  try {
    const startTime = Date.now();
    const llmResult = await extractDocumentData(base64Data, mimeType, fileName);
    const processingTimeMs = Date.now() - startTime;

    const extractionId = crypto.randomUUID();

    if (llmResult.error) {
      await extractionRepository.saveFailedExtraction(
        extractionId,
        sessionId,
        fileName,
        fileHash,
        s3Url || null,
        llmResult.rawResponse || "",
        processingTimeMs
      );
      await jobRepository.markJobFailed(jobId, extractionId, llmResult.error, "Document extraction failed.");
      throw new Error(llmResult.error);
    }

    const { parsedObject } = llmResult;

    await extractionRepository.saveSuccessfulExtraction(
      extractionId,
      sessionId,
      fileName,
      fileHash,
      s3Url || null,
      parsedObject,
      llmResult.rawResponse || "",
      processingTimeMs
    );
    
    await jobRepository.markJobComplete(jobId, extractionId);
    
    return { extractionId };

  } catch (uncaughtError: any) {
    // Failsafe for unhandled extraction or database insertion errors
    await jobRepository.markJobFailed(jobId, crypto.randomUUID(), "UNHANDLED_ERROR", uncaughtError.message || "An unknown error occurred during job processing.");
    throw uncaughtError;
  }

}, { connection });

documentWorker.on('completed', job => {
  console.log(`Job with id ${job.id} has been completed`);
});

documentWorker.on('failed', (job, err) => {
  console.log(`Job with id ${job?.id} has failed with ${err.message}`);
});
