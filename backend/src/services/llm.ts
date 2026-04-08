import OpenAI from "openai";
import dotenv from "dotenv";
const PDFParser = require("pdf2json");

function parsePdfBuffer(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    let handled = false;
    const timeout = setTimeout(() => {
      if (!handled) {
        handled = true;
        reject(new Error("PDF Parsing Timeout"));
      }
    }, 15000); // 15 seconds max for PDF parsing internally

    try {
      const pdfParser = new PDFParser(null, 1);
      pdfParser.on("pdfParser_dataError", (errData: any) => {
        if (!handled) {
           handled = true;
           clearTimeout(timeout);
           reject(errData.parserError);
        }
      });
      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        if (!handled) {
           handled = true;
           clearTimeout(timeout);
           resolve(pdfParser.getRawTextContent());
        }
      });
      pdfParser.parseBuffer(buffer);
    } catch (error) {
      if (!handled) {
        handled = true;
        clearTimeout(timeout);
        reject(error);
      }
    }
  });
}

dotenv.config();

const provider = process.env.LLM_PROVIDER || "OPENAI";

let openai: OpenAI;

if (provider === "OPENAI") {
  openai = new OpenAI({
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID,
    baseURL: process.env.OPENAI_API_URL !== "otito" ? process.env.OPENAI_API_URL : undefined, // fallback since "otito" is not a valid URL
  });
}

const BASE_PROMPT = `
You are an expert maritime document analyst with deep knowledge of STCW, MARINA, IMO, and international seafarer certification standards.

A document has been provided. Perform the following in a single pass:
1. IDENTIFY the document type from the taxonomy below
2. DETERMINE if this belongs to a DECK officer, ENGINE officer, BOTH, or is role-agnostic (N/A)
3. EXTRACT all fields that are meaningful for this specific document type. ONLY extract objects and information that are explicitly stated in the provided document. Do not hallucinate, guess, or include any information that is not present in the document. 
IMPORTANT: The "fields" array should ONLY contain fields that actually exist and have values in the document. Do NOT generate standard placeholder fields with "N/A" or "MISSING" or null values just because they are typical for this document type. If a field is not found in the document text/image, omit it entirely from the output array.
4. FLAG any compliance issues, anomalies, or concerns

CRITICAL INSTRUCTION: You MUST NOT invent, guess, or hallucinate any data. If the document is blank, blurry, or missing a specific field (like a name, date, or ID number), you MUST output \`null\` for that specific field (for top-level holder/validity/medicalData keys). For the \`fields\` array, simply omit missing fields completely. Never output placeholder names like "John Doe".

Document type taxonomy (use these exact codes):
COC | COP_BT | COP_PSCRB | COP_AFF | COP_MEFA | COP_MECA | COP_SSO | COP_SDSD |
ECDIS_GENERIC | ECDIS_TYPE | SIRB | PASSPORT | PEME | DRUG_TEST | YELLOW_FEVER |
ERM | MARPOL | SULPHUR_CAP | BALLAST_WATER | HATCH_COVER | BRM_SSBT |
TRAIN_TRAINER | HAZMAT | FLAG_STATE | OTHER

Return ONLY a valid JSON object. No markdown. No code fences. No preamble.

{
  "detection": {
    "documentType": "SHORT_CODE",
    "documentName": "Full human-readable document name",
    "category": "IDENTITY | CERTIFICATION | STCW_ENDORSEMENT | MEDICAL | TRAINING | FLAG_STATE | OTHER",
    "applicableRole": "DECK | ENGINE | BOTH | N/A",
    "isRequired": true,
    "confidence": "HIGH | MEDIUM | LOW",
    "detectionReason": "One sentence explaining how you identified this document"
  },
  "holder": {
    "fullName": "string or null",
    "dateOfBirth": "DD/MM/YYYY or null",
    "nationality": "string or null",
    "passportNumber": "string or null",
    "sirbNumber": "string or null",
    "rank": "string or null",
    "photo": "PRESENT | ABSENT"
  },
  "fields": [
    {
      "key": "snake_case_key",
      "label": "Dynamic field name found in document",
      "value": "Actual extracted value",
      "importance": "CRITICAL | HIGH | MEDIUM | LOW",
      "status": "OK | EXPIRED | WARNING"
    }
  ],
  "validity": {
    "dateOfIssue": "string or null",
    "dateOfExpiry": "string | 'No Expiry' | 'Lifetime' | null",
    "isExpired": false,
    "daysUntilExpiry": null,
    "revalidationRequired": null
  },
  "compliance": {
    "issuingAuthority": "string",
    "regulationReference": "e.g. STCW Reg VI/1 or null",
    "imoModelCourse": "e.g. IMO 1.22 or null",
    "recognizedAuthority": true,
    "limitations": "string or null"
  },
  "medicalData": {
    "fitnessResult": "FIT | UNFIT | N/A",
    "drugTestResult": "NEGATIVE | POSITIVE | N/A",
    "restrictions": "string or null",
    "specialNotes": "string or null",
    "expiryDate": "string or null"
  },
  "flags": [
    {
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "message": "Description of issue or concern"
    }
  ],
  "summary": "Two-sentence plain English summary of what this document confirms about the holder."
}
`;

function extractJson(rawText: string): any {
  // Find outermost { and }
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found");
  }
  const cleanString = rawText.substring(start, end + 1);
  return JSON.parse(cleanString);
}

export async function extractDocumentData(
  base64Data: string,
  mimeType: string,
  fileName: string,
  isRetry = false
): Promise<{ rawResponse: string, parsedObject?: any, error?: string }> {
  
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  
  let instructionsMessage = BASE_PROMPT;
  if (isRetry) {
    instructionsMessage += `\n\nRetry Notice: Your previous extraction attempt yielded LOW confidence. Please re-evaluate this image carefully. Hint: The original file name is "${fileName}" and type is ${mimeType}, which might help in identification.`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120-second timeout

  try {
    let messageContent: any[] = [{ type: "text", text: instructionsMessage }];
    if (mimeType === "application/pdf") {
       try {
         const pdfBuffer = Buffer.from(base64Data, "base64");
         const parsedText = await parsePdfBuffer(pdfBuffer);
         messageContent.push({ type: "text", text: "--- PDF EXTRACTED TEXT ---\n" + parsedText });
       } catch (err) {
         console.error("PDF Parsing Failed:", err);
         messageContent.push({ type: "text", text: "Failed to read PDF text. Proceeding with file metadata only." });
       }
    } else {
       messageContent.push({
         type: "image_url",
         image_url: {
           url: `data:${mimeType};base64,${base64Data}`,
           detail: "high"
         }
       });
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: messageContent
        }
      ]
    }, { signal: controller.signal as any });

    clearTimeout(timeoutId);

    const rawResponse = response.choices[0]?.message?.content || "";
    
    try {
      let parsedObject = extractJson(rawResponse);
      
      // Handle LOW confidence retry immediately internally
      if (!isRetry && parsedObject?.detection?.confidence === "LOW") {
        return extractDocumentData(base64Data, mimeType, fileName, true);
      }

      return { rawResponse, parsedObject };
    } catch (parseError: any) {
      // Parse failure recovery
      return attemptJsonRepair(rawResponse);
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError" || error.code === 'ECONNABORTED') {
      return { rawResponse: "", error: "LLM_TIMEOUT" };
    }
    return { rawResponse: "", error: error.message };
  }
}

async function attemptJsonRepair(rawResponse: string): Promise<{ rawResponse: string, parsedObject?: any, error?: string }> {
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  try {
    const repairResponse = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a JSON repair utility. You will receive malformed JSON output. Return ONLY the corrected, valid JSON matching the exact schema required, without markdown blocks." },
        { role: "user", content: rawResponse }
      ]
    });
    
    const secondRaw = repairResponse.choices[0]?.message?.content || "";
    try {
      const parsedObject = extractJson(secondRaw);
      return { rawResponse: secondRaw, parsedObject };
    } catch (e) {
      return { rawResponse, error: "LLM_JSON_PARSE_FAIL" };
    }
  } catch (e: any) {
    return { rawResponse, error: e.message };
  }
}

export async function validateSessionDocuments(sessionId: string, payloads: any[]): Promise<{ rawResponse: string, parsedObject?: any, error?: string }> {
  try {
    const prompt = `
You are an expert maritime compliance officer. You are tasked with performing cross-document compliance validation for a single seafarer candidate's session.

You will receive an array of JSON objects representing data extracted from multiple maritime documents (e.g. COC, Passport, Medical Certificates).

Analyze this collection of documents holistically and RETURN ONLY A VALID JSON OBJECT.

Your objectives:
1. HOLDER PROFILE: Synthesize the candidate's canonical name, date of birth, nationality, and detected roles (DECK/ENGINE) from across the documents.
2. CONSISTENCY CHECKS: Check if fields like Name, Date of Birth, Passport Number, and SIRB align exactly across all provided records. Find discrepancies.
3. MISSING DOCUMENTS: Based on standard international STCW norms, what core documents are noticeably absent? (e.g., if there's a COC, but no Medical Certificate or Passport).
4. EXPIRY: Flag any document that is currently expired or expires within 90 days.
5. MEDICAL FLAGS: Surface any 'UNFIT' results, positive drug tests, or problematic restriction notes.
6. OVERALL ASSESSMENT: Give an overallStatus of "APPROVED" (all clear), "CONDITIONAL" (missing non-critical docs, or minor flags), or "REJECTED" (expired core certs, critical consistency failure, unfit medical).

Use exactly this JSON format. No markdown, no code blocks:
{
  "sessionId": "${sessionId}",
  "holderProfile": {
    "name": "string",
    "dateOfBirth": "string",
    "nationality": "string",
    "roles": ["string"]
  },
  "consistencyChecks": [
    {
      "field": "Name",
      "isConsistent": true,
      "message": "Names match across all documents"
    }
  ],
  "missingDocuments": ["Medical Certificate"],
  "expiringDocuments": [
    {
      "documentType": "COC",
      "daysUntilExpiry": 45
    }
  ],
  "medicalFlags": [],
  "overallStatus": "CONDITIONAL",
  "overallScore": 85,
  "summary": "Candidate is fit for duty but requires a new COC within 45 days.",
  "recommendations": ["Renew COC immediately", "Provide Passport copy"]
}

Input Documents:
${JSON.stringify(payloads, null, 2)}
    `;

    if (!openai) {
      console.warn("OpenAI not initialized... skipping validation mock");
      // mock
      return { rawResponse: '{"mock":"true"}', parsedObject: { sessionId }};
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await openai.chat.completions.create(
      {
        model: process.env.LLM_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      },
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    const text = response.choices[0]?.message?.content || "";
    try {
      const parsed = extractJson(text);
      return { rawResponse: text, parsedObject: parsed };
    } catch (e) {
      console.error("Failed to parse validation JSON, raw:", text);
      return { rawResponse: text, error: "PARSE_ERROR" };
    }
  } catch (error) {
    console.error("Validation LLM call failed:", error);
    return { rawResponse: "", error: "LLM_ERROR" };
  }
}
