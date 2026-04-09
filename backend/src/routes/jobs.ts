import { Router } from "express";
import { JobController } from "../controllers/JobController";

const router = Router();
const jobController = new JobController();

router.get("/:jobId", jobController.getJobStatus);

export default router;
