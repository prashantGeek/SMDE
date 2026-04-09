import { Request, Response } from "express";
import { JobRepository } from "../repositories/JobRepository";
import { ExtractionRepository } from "../repositories/ExtractionRepository";

export class JobController {
  constructor(
    private readonly jobRepository = new JobRepository(),
    private readonly extractionRepository = new ExtractionRepository()
  ) {}

  getJobStatus = async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = await this.jobRepository.getJob(jobId as string);

      if (!job) {
        return res.status(404).json({ error: "JOB_NOT_FOUND", message: "Job ID does not exist" });
      }

      if (job.status === "QUEUED") {
        return res.status(200).json({
          jobId: job.id,
          status: "QUEUED",
          startedAt: job.started_at,
          estimatedCompleteMs: 6000,
        });
      }

      if (job.status === "PROCESSING") {
        return res.status(200).json({
          jobId: job.id,
          status: "PROCESSING",
          startedAt: job.started_at,
          estimatedCompleteMs: 3200,
        });
      }

      if (job.status === "COMPLETE") {
        const ext = await this.extractionRepository.getExtractionById(job.extraction_id);
        const extraction = ext || {};

        return res.status(200).json({
          jobId: job.id,
          status: "COMPLETE",
          extractionId: job.extraction_id,
          result: {
            id: extraction.id,
            sessionId: extraction.session_id,
            fileName: extraction.file_name,
            s3Url: extraction.s3_url,
            documentType: extraction.document_type,
            applicableRole: extraction.applicable_role,
            confidence: extraction.confidence,
            holderName: extraction.holder_name,
            dateOfBirth: extraction.date_of_birth,
            sirbNumber: extraction.sirb_number,
            passportNumber: extraction.passport_number,
            nationality: extraction.nationality,
            rank: extraction.rank,
            fields: JSON.parse(extraction.fields_json || "[]"),
            validity: JSON.parse(extraction.validity_json || "{}"),
            medicalData: JSON.parse(extraction.medical_data_json || "{}"),
            flags: JSON.parse(extraction.flags_json || "[]"),
            summary: extraction.summary,
          },
          completedAt: job.completed_at,
        });
      }

      if (job.status === "FAILED") {
        return res.status(200).json({
          jobId: job.id,
          status: "FAILED",
          error: job.error_code,
          message: job.error_message,
          failedAt: job.completed_at,
          retryable: true,
        });
      }

      return res.status(200).json({
        jobId: job.id,
        status: job.status,
      });
    } catch (error) {
      console.error("Job routing error:", error);
      return res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected server error" });
    }
  };
}
