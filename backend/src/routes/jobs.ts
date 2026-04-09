import { Router } from "express";
import { JobController } from "../controllers/JobController";

const router = Router();
const jobController = new JobController();

/**
 * @swagger
 * /api/jobs/{jobId}:
 *   get:
 *     tags:
 *       - Jobs
 *     summary: Get async extraction job status
 *     description: Returns the current status of a background extraction job and the final extraction payload when complete.
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job identifier returned from /api/extract when using async mode.
 *     responses:
 *       200:
 *         description: Job status response.
 *       404:
 *         description: Job not found.
 *       500:
 *         description: Unexpected server error.
 */

router.get("/:jobId", jobController.getJobStatus);

export default router;
