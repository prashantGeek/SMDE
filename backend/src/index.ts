import express from "express";
import cors from "cors";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import "reflect-metadata";

import extractRouter from "./routes/extract.js";
import jobsRouter from "./routes/jobs.js";
import sessionsRouter from "./routes/sessions.js";
import { AppDataSource } from "./db/data-source";
import initSchema from "./db/schema";
import "./queue"; // Initialize BullMQ queue & worker

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const swaggerDefinition = {
	openapi: "3.0.0",
	info: {
		title: "Backend API",
		version: "1.0.0",
		description: "API documentation for the backend service"
	},
	servers: [
		{
			url: "https://smde.stackvise.in",
			description: "Production"
		},
		{
			url: `http://localhost:${port}`,
			description: "Local development"
		}
	],
	paths: {
		"/health": {
			get: {
				tags: ["System"],
				summary: "Health check endpoint",
				responses: {
					"200": {
						description: "Service is healthy",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: {
											type: "string",
											example: "ok"
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
};

const swaggerSpec = swaggerJsdoc({
	definition: swaggerDefinition,
	apis: ["src/index.ts", "src/routes/**/*.ts"]
});

/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - System
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Service is healthy.
 */
app.get("/health", (_req, res) => {
	res.status(200).json({ status: "ok" });
});

app.use("/api/extract", extractRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/sessions", sessionsRouter);

/**
 * @swagger
 * /openapi.json:
 *   get:
 *     tags:
 *       - System
 *     summary: Get the OpenAPI specification JSON
 *     responses:
 *       200:
 *         description: OpenAPI document.
 */
app.get("/openapi.json", (_req, res) => {
	res.status(200).json(swaggerSpec);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
/**
 * @swagger
 * /api-docs:
 *   get:
 *     tags:
 *       - System
 *     summary: Redirect to Swagger UI
 *     responses:
 *       302:
 *         description: Redirects to /docs.
 */
app.get("/api-docs", (_req, res) => {
	res.redirect(302, "/docs");
});

/**
 * @swagger
 * /:
 *   get:
 *     tags:
 *       - System
 *     summary: Backend landing endpoint
 *     responses:
 *       200:
 *         description: Backend is running.
 */
app.get("/", (_req, res) => {
	res.status(200).send("Backend is running");
});

AppDataSource.initialize().then(async () => {
        console.log("TypeORM Data Source has been initialized!");
        
        await initSchema(); // Optional: We can phase this out once Entities and Sync are active

        app.listen(port, host, () => {
                console.log(`Backend service running at http://localhost:${port}`);
		console.log(`Swagger docs available at http://localhost:${port}/docs`);
        });
}).catch((err) => {
        console.error("Error during Data Source initialization", err);
});
