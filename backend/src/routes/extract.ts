import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { uploadMiddleware } from "../middleware/upload";
import { ExtractionController } from "../controllers/ExtractionController";

const router = Router();
const extractionController = new ExtractionController();

/**
 * @swagger
 * /api/extract:
 *   post:
 *     tags:
 *       - Extraction
 *     summary: Upload and extract a document
 *     description: Accepts a PDF or image file, stores it, and either processes it synchronously or queues it for async extraction.
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [sync, async]
 *         required: false
 *         description: Extraction mode. Defaults to async when omitted.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *               sessionId:
 *                 type: string
 *                 description: Existing session ID to append the document to.
 *     responses:
 *       200:
 *         description: Document extracted successfully or deduplicated.
 *       202:
 *         description: Document queued for async processing.
 *       400:
 *         description: Bad request or unsupported upload.
 *       413:
 *         description: File too large.
 *       422:
 *         description: Extraction failed but raw response was stored.
 *       429:
 *         description: Rate limited.
 *       500:
 *         description: Unexpected server error.
 */

// Rate limiter for POST /api/extract
const extractLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per `window` (here, per minute)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next, options) => {
    return res.status(429).json({
      error: "RATE_LIMITED",
      message: "Too many requests, please try again later.",
      retryAfterMs: options.windowMs,
    });
  },
});

// Wrap multer to handle errors gracefully as per spec
const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  uploadMiddleware.single("document")(req, res, (err: any) => {
    if (err) {
      if (err.message === "UNSUPPORTED_FORMAT") {
        return res.status(400).json({ error: "UNSUPPORTED_FORMAT", message: "File type not accepted (only jpeg, png, pdf allowed)." });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "FILE_TOO_LARGE", message: "File exceeds 10MB limit." });
      }
      return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
    next();
  });
};

router.post("/", extractLimiter, handleUpload, async (req: Request, res: Response) => {
  return extractionController.handleUpload(req, res);
});

export default router;
