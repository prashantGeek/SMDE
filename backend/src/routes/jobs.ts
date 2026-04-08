import { Router, Request, Response } from "express";
import { query } from "../db";
import { JobRepository } from "../repositories/JobRepository";
import { ExtractionRepository } from "../repositories/ExtractionRepository";

const router = Router();
const jobRepo = new JobRepository();

router.get("/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = await jobRepo.getJob(jobId as string);
    if (!job) {
      return res.status(404).json({ error: "JOB_NOT_FOUND", message: "Job ID does not exist" });
    }

    if (job.status === "QUEUED") {
      return res.status(200).json({
        jobId: job.id,
        status: "QUEUED",
        startedAt: job.started_at,
        estimatedCompleteMs: 6000
      });
    }

    if (job.status === "PROCESSING") {
      return res.status(200).json({
        jobId: job.id,
        status: "PROCESSING",
        startedAt: job.started_at,
        estimatedCompleteMs: 3200
      });
    }

    if (job.status === "COMPLETE") {
      const extRes = await query("SELECT * FROM extractions WHERE id = $1", [job.extraction_id]);
      const ext = extRes.rows[0] || {};
      
      return res.status(200).json({
        jobId: job.id,
        status: "COMPLETE",
        extractionId: job.extraction_id,
        result: {
          id: ext.id,
          sessionId: ext.session_id,
          fileName: ext.file_name,
          s3Url: ext.s3_url,
          documentType: ext.document_type,
          applicableRole: ext.applicable_role,
          confidence: ext.confidence,
          holderName: ext.holder_name,
          dateOfBirth: ext.date_of_birth,
          sirbNumber: ext.sirb_number,
          passportNumber: ext.passport_number,
          nationality: ext.nationality,
          rank: ext.rank,
          // Hydrate JSON back from strings
          fields: JSON.parse(ext.fields_json || "[]"),
          validity: JSON.parse(ext.validity_json || "{}"),
          medicalData: JSON.parse(ext.medical_data_json || "{}"),
          flags: JSON.parse(ext.flags_json || "[]"),
          summary: ext.summary
        },
        completedAt: job.completed_at
      });
    }

    if (job.status === "FAILED") {
      return res.status(200).json({
        jobId: job.id,
        status: "FAILED",
        error: job.error_code,
        message: job.error_message,
        failedAt: job.completed_at,
        retryable: true
      });
    }

  } catch (error) {
    console.error("Job routing error:", error);
    return res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected server error" });
  }
});

export default router;