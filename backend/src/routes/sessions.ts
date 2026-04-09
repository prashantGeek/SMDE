import { Router } from "express";
import { SessionController } from "../controllers/SessionController";

const router = Router();
const sessionController = new SessionController();

router.get("/", sessionController.listSessions);
router.get("/:sessionId", sessionController.getSession);
router.post("/:sessionId/validate", sessionController.validateSession);
router.get("/:sessionId/report", sessionController.getReport);
router.delete("/:sessionId", sessionController.deleteSession);

export default router;
