import { Router } from "express";
import { SessionController } from "../controllers/SessionController";

const router = Router();
const sessionController = new SessionController();

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     tags:
 *       - Sessions
 *     summary: List all sessions
 *     description: Returns a compact list of candidate sessions with latest known candidate name and role.
 *     responses:
 *       200:
 *         description: Array of sessions.
 *       500:
 *         description: Unexpected server error.
 */
router.get("/", sessionController.listSessions);

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   get:
 *     tags:
 *       - Sessions
 *     summary: Get a session with extracted documents
 *     description: Returns the session summary, extracted documents, pending jobs, and latest validation report.
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session identifier.
 *     responses:
 *       200:
 *         description: Session payload.
 *       404:
 *         description: Session not found.
 *       500:
 *         description: Unexpected server error.
 */
router.get("/:sessionId", sessionController.getSession);

/**
 * @swagger
 * /api/sessions/{sessionId}/validate:
 *   post:
 *     tags:
 *       - Sessions
 *     summary: Run compliance validation for a session
 *     description: Cross-validates all documents in a session and persists the resulting report.
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session identifier.
 *     responses:
 *       200:
 *         description: Validation completed successfully.
 *       400:
 *         description: Not enough documents to validate.
 *       404:
 *         description: Session not found.
 *       422:
 *         description: LLM returned unparseable validation output.
 *       500:
 *         description: Unexpected server error.
 */
router.post("/:sessionId/validate", sessionController.validateSession);

/**
 * @swagger
 * /api/sessions/{sessionId}/report:
 *   get:
 *     tags:
 *       - Sessions
 *     summary: Get a human-readable compliance report
 *     description: Returns the latest validation summary and document matrix for a session.
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session identifier.
 *     responses:
 *       200:
 *         description: Compliance report payload.
 *       404:
 *         description: Session not found.
 *       500:
 *         description: Unexpected server error.
 */
router.get("/:sessionId/report", sessionController.getReport);

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   delete:
 *     tags:
 *       - Sessions
 *     summary: Delete a session and all related data
 *     description: Removes the session along with its associated documents, jobs, and validations.
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session identifier.
 *     responses:
 *       200:
 *         description: Session deleted successfully.
 *       404:
 *         description: Session not found.
 *       500:
 *         description: Unexpected server error.
 */
router.delete("/:sessionId", sessionController.deleteSession);

export default router;
