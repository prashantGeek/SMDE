import { Request, Response } from "express";
import { SessionRepository } from "../repositories/SessionRepository";
import { ExtractionRepository } from "../repositories/ExtractionRepository";
import { JobRepository } from "../repositories/JobRepository";
import { validateSessionDocuments } from "../services/llm";

type ValidationCheck = {
  isConsistent?: boolean;
  severity?: string;
};

const toSingleParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value || "";

export class SessionController {
  constructor(
    private readonly sessionRepository = new SessionRepository(),
    private readonly extractionRepository = new ExtractionRepository(),
    private readonly jobRepository = new JobRepository()
  ) {}

  listSessions = async (_req: Request, res: Response) => {
    try {
      const sessionsRes = await this.sessionRepository.getAllSessions();
      const namesRes = await this.extractionRepository.getAllExtractionsNamesAndRoles();

      const namesMap: Record<string, string> = {};
      const rolesMap: Record<string, string> = {};

      for (const row of namesRes.rows) {
        if (!namesMap[row.session_id] && row.holder_name) namesMap[row.session_id] = row.holder_name;
        if (!rolesMap[row.session_id] && row.applicable_role && row.applicable_role !== "BOTH" && row.applicable_role !== "N/A") {
          rolesMap[row.session_id] = row.applicable_role;
        }
      }

      const sessionsList = sessionsRes.rows.map((row: any) => ({
        id: row.id,
        createdAt: row.created_at,
        candidateName: namesMap[row.id] || "Unknown Candidate",
        role: rolesMap[row.id] || "Unknown"
      }));

      res.json(sessionsList);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected server error" });
    }
  };

  getSession = async (req: Request, res: Response) => {
    const sessionId = toSingleParam(req.params.sessionId);

    try {
      const sessionRes = await this.sessionRepository.getSessionById(sessionId);
      if (!sessionRes) {
        res.status(404).json({ error: "SESSION_NOT_FOUND", message: "Session ID does not exist" });
        return;
      }

      const extRes = await this.sessionRepository.getSessionData(sessionId);

      let overallHealth = "OK";
      let detectedRole = "N/A";

      const documents = extRes.rows.map((row: any) => {
        let isExpired = row.is_expired === 1;
        let flagCount = 0;
        let criticalFlagCount = 0;
        let parsedFlags: ValidationCheck[] = [];
        let parsedFields: any[] = [];
        let validity: any = null;
        let medicalData: any = null;
        let compliance = null;

        try {
          if (row.fields_json) {
            parsedFields = JSON.parse(row.fields_json) || [];
          }
          if (row.medical_data_json) {
            medicalData = JSON.parse(row.medical_data_json) || null;
          }

          if (row.flags_json) {
            parsedFlags = JSON.parse(row.flags_json) || [];
            flagCount = parsedFlags.length;
            criticalFlagCount = parsedFlags.filter((flag: ValidationCheck) => flag.severity === "CRITICAL").length;
          }

          if (row.validity_json) {
            validity = JSON.parse(row.validity_json) || {};
            if (validity.isExpired) isExpired = true;
            if (validity.daysUntilExpiry !== null && validity.daysUntilExpiry <= 90 && validity.daysUntilExpiry > 0) {
              if (overallHealth !== "CRITICAL") overallHealth = "WARN";
            }
          }
        } catch (e) {}

        if (isExpired || criticalFlagCount > 0) {
          overallHealth = "CRITICAL";
        } else if (flagCount > 0 && overallHealth !== "CRITICAL") {
          const hasHighMedium = parsedFlags.filter((flag: ValidationCheck) => flag.severity === "HIGH" || flag.severity === "MEDIUM").length > 0;
          if (hasHighMedium) overallHealth = "WARN";
        }

        if (row.applicable_role && row.applicable_role !== "N/A" && row.applicable_role !== "BOTH") {
          detectedRole = row.applicable_role;
        }

        return {
          id: row.id,
          fileName: row.file_name,
          s3Url: row.s3_url,
          documentType: row.document_type,
          applicableRole: row.applicable_role,
          category: row.category || "OTHER",
          holderName: row.holder_name,
          dateOfBirth: row.date_of_birth,
          sirbNumber: row.sirb_number,
          passportNumber: row.passport_number,
          nationality: row.nationality,
          rank: row.rank,
          confidence: row.confidence,
          isExpired,
          flagCount,
          criticalFlagCount,
          fields: parsedFields,
          validity,
          medicalData,
          flags: parsedFlags,
          summary: row.summary,
          compliance,
          createdAt: row.created_at
        };
      });

      const validationRes = await this.sessionRepository.getLatestValidation(sessionId);
      const latestValidation = validationRes.rowCount !== null && validationRes.rowCount > 0 && validationRes.rows[0].result_json
        ? JSON.parse(validationRes.rows[0].result_json)
        : null;

      res.json({
        sessionId,
        documentCount: documents.length,
        detectedRole,
        overallHealth,
        documents,
        pendingJobs: (await this.jobRepository.getActiveJobsForSession(sessionId)).rows.map((r: any) => ({ id: r.id, status: r.status })),
        validationResult: latestValidation
      });
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected server error" });
    }
  };

  validateSession = async (req: Request, res: Response) => {
    const sessionId = toSingleParam(req.params.sessionId);

    const normalizeValidationDocumentType = (documentType: string | null | undefined) => {
      const type = String(documentType || "").toUpperCase();
      if (type === "PEME") {
        return {
          documentType: "MEDICAL_CERTIFICATE",
          documentName: "Medical Certificate (PEME)",
          sourceDocumentType: "PEME",
        };
      }

      return {
        documentType: type || "OTHER",
        documentName: type || "OTHER",
        sourceDocumentType: type || "OTHER",
      };
    };

    try {
      const sessionRes = await this.sessionRepository.getSessionById(sessionId);
      if (!sessionRes) {
        res.status(404).json({ error: "SESSION_NOT_FOUND", message: "Session ID does not exist" });
        return;
      }

      const docsRes = await this.extractionRepository.getCompleteExtractionsBySessionId(sessionId);

      if ((docsRes.rowCount || 0) < 2) {
        res.status(400).json({ error: "INSUFFICIENT_DOCUMENTS", message: "Validate called with fewer than 2 documents" });
        return;
      }

      const payloads = docsRes.rows.map((row: any) => ({
        ...normalizeValidationDocumentType(row.document_type),
        holderName: row.holder_name,
        dateOfBirth: row.date_of_birth,
        sirbNumber: row.sirb_number,
        passportNumber: row.passport_number,
        validity: row.validity_json ? JSON.parse(row.validity_json) : null,
        medicalData: row.medical_data_json ? JSON.parse(row.medical_data_json) : null,
        flags: row.flags_json ? JSON.parse(row.flags_json) : []
      }));

      const result = await validateSessionDocuments(sessionId, payloads);

      if (!result.parsedObject) {
        res.status(422).json({ error: "LLM_JSON_PARSE_FAIL", message: "LLM returned unparseable response after retry" });
        return;
      }

      const output = result.parsedObject;
      output.validatedAt = new Date().toISOString();

      const valId = `val_${Date.now()}`;
      await this.sessionRepository.saveValidation(valId, sessionId, output);

      res.json(output);
    } catch (error) {
      console.error("Error validating session:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected server error" });
    }
  };

  getReport = async (req: Request, res: Response) => {
    const sessionId = toSingleParam(req.params.sessionId);

    try {
      const sessionRes = await this.sessionRepository.getSessionById(sessionId);
      if (!sessionRes) {
        res.status(404).json({ error: "SESSION_NOT_FOUND", message: "Session ID does not exist" });
        return;
      }

      const docsRes = await this.extractionRepository.getCompleteExtractionsBySessionId(sessionId);
      const extDocs = docsRes.rows;

      const valRes = await this.sessionRepository.getLatestValidation(sessionId);

      let latestValidation = null;
      if ((valRes.rowCount || 0) > 0) {
        try {
          latestValidation = JSON.parse(valRes.rows[0].result_json);
        } catch (e) {}
      }

      const report = {
        sessionId,
        reportGeneratedAt: new Date().toISOString(),
        validationStatus: latestValidation ? latestValidation.overallStatus : "PENDING_VALIDATION",
        overallScore: latestValidation?.overallScore || null,
        summary: latestValidation?.summary || "Session documents have not been cross-validated yet.",
        candidate: {
          name: latestValidation?.holderProfile?.name || extDocs.find((d: any) => d.holder_name)?.holder_name || "UNKNOWN",
          nationality: latestValidation?.holderProfile?.nationality || "UNKNOWN",
          role: extDocs.find((d: any) => d.applicable_role && d.applicable_role !== "N/A")?.applicable_role || "UNKNOWN"
        },
        documentMatrix: extDocs.map((d: any) => {
          let isExp = d.is_expired === 1;
          let vDays = null;
          try {
            if (d.validity_json) {
              const vj = JSON.parse(d.validity_json);
              isExp = vj.isExpired || false;
              vDays = vj.daysUntilExpiry;
            }
          } catch (e) {}
          return {
            fileName: d.file_name,
            documentType: d.document_type || "UNKNOWN",
            status: isExp ? "EXPIRED" : (vDays !== null && vDays < 90 ? "EXPIRING_SOON" : "VALID"),
            daysUntilExpiry: vDays
          };
        }),
        actionableItems: {
          missing: latestValidation?.missingDocuments || [],
          discrepancies: latestValidation?.consistencyChecks?.filter((c: any) => !c.isConsistent) || [],
          medicalConcerns: latestValidation?.medicalFlags || [],
          recommendations: latestValidation?.recommendations || []
        }
      };

      res.json(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected server error" });
    }
  };

  deleteSession = async (req: Request, res: Response) => {
    const sessionId = toSingleParam(req.params.sessionId);

    try {
      const deleteRes = await this.sessionRepository.deleteSessionCascade(sessionId);

      if (deleteRes.rowCount === 0) {
        res.status(404).json({ error: "SESSION_NOT_FOUND", message: "Session ID does not exist" });
        return;
      }

      res.status(200).json({ message: "Session deleted successfully" });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected server error" });
    }
  };
}
