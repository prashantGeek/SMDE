import express from 'express';
import pool from '../db';
import { validateSessionDocuments } from '../services/llm';

const router = express.Router();

// GET /api/sessions
router.get('/', async (req, res) => {
  try {
    const sessionsRes = await pool.query('SELECT * FROM sessions ORDER BY created_at DESC');
    
    // Attempt to gather candidate names from initial extractions for display
    const namesRes = await pool.query(`
      SELECT session_id, holder_name, applicable_role 
      FROM extractions 
      ORDER BY created_at ASC
    `);

    const namesMap: Record<string, string> = {};
    const rolesMap: Record<string, string> = {};
    for (const row of namesRes.rows) {
      if (!namesMap[row.session_id] && row.holder_name) namesMap[row.session_id] = row.holder_name;
      if (!rolesMap[row.session_id] && row.applicable_role && row.applicable_role !== 'BOTH' && row.applicable_role !== 'N/A') rolesMap[row.session_id] = row.applicable_role;
    }

    const sessionsList = sessionsRes.rows.map(row => ({
      id: row.id,
      createdAt: row.created_at,
      candidateName: namesMap[row.id] || 'Unknown Candidate',
      role: rolesMap[row.id] || 'Unknown'
    }));

    res.json(sessionsList);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected server error' });
  }
});


// GET /api/sessions/:sessionId
router.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const sessionRes = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    if (sessionRes.rowCount === 0) {
       res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Session ID does not exist' });
       return;
    }

    const extRes = await pool.query('SELECT * FROM extractions WHERE session_id = $1 ORDER BY created_at DESC', [sessionId]);
    
    // Derived values
    let overallHealth = 'OK';
    let detectedRole = 'N/A';
    
    const documents = extRes.rows.map(row => {
      let isExpired = row.is_expired === 1;
      let flagCount = 0;
      let criticalFlagCount = 0;
      let parsedFlags = [];
      let parsedFields = [];
      let validity = null;
      let medicalData = null;
      let compliance = null;

      try {
        if (row.fields_json) {
           parsedFields = JSON.parse(row.fields_json) || [];
        }
        if (row.medical_data_json) {
           medicalData = JSON.parse(row.medical_data_json) || null;
        }
        // If there's a compliance column check, handle it here -- wait, schema has no compliance_json?
        // Let's ignore it for now or pull from fields if relevant

        if (row.flags_json) {
           parsedFlags = JSON.parse(row.flags_json) || [];
           flagCount = parsedFlags.length;
           criticalFlagCount = parsedFlags.filter((f: any) => f.severity === 'CRITICAL').length;
        }
        
        if (row.validity_json) {
           validity = JSON.parse(row.validity_json) || {};
           if (validity.isExpired) isExpired = true;
           if (validity.daysUntilExpiry !== null && validity.daysUntilExpiry <= 90 && validity.daysUntilExpiry > 0) {
               if (overallHealth !== 'CRITICAL') overallHealth = 'WARN';
           }
        }
      } catch(e) {}

      if (isExpired || criticalFlagCount > 0) {
        overallHealth = 'CRITICAL';
      } else if (flagCount > 0 && overallHealth !== 'CRITICAL') {
         const hasHighMedium = parsedFlags.filter((f: any) => f.severity === 'HIGH' || f.severity === 'MEDIUM').length > 0;
         if (hasHighMedium) overallHealth = 'WARN';
      }

      if (row.applicable_role && row.applicable_role !== 'N/A' && row.applicable_role !== 'BOTH') {
        detectedRole = row.applicable_role; // naive aggregate
      }

      return {
        id: row.id,
        fileName: row.file_name,
        s3Url: row.s3_url,
        documentType: row.document_type,
        applicableRole: row.applicable_role,
        category: row.category || 'OTHER',
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

    const jobsRes = await pool.query('SELECT id, status FROM jobs WHERE session_id = $1 AND status IN ($2, $3)', [sessionId, 'QUEUED', 'PROCESSING']);

    // Fetch the latest validation/compliance report if it exists
    const validationRes = await pool.query('SELECT result_json FROM validations WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1', [sessionId]);
    const latestValidation = validationRes.rowCount !== null && validationRes.rowCount > 0 && validationRes.rows[0].result_json 
      ? JSON.parse(validationRes.rows[0].result_json) 
      : null;

    res.json({
      sessionId,
      documentCount: documents.length,
      detectedRole,
      overallHealth,
      documents,
      pendingJobs: jobsRes.rows.map(r => ({ id: r.id, status: r.status })),
      validationResult: latestValidation
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected server error' });
  }
});

// POST /api/sessions/:sessionId/validate
router.post('/:sessionId/validate', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const sessionRes = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    if (sessionRes.rowCount === 0) {
       res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Session ID does not exist' });
       return;
    }

    const docsRes = await pool.query('SELECT * FROM extractions WHERE session_id = $1 AND status = $2', [sessionId, 'COMPLETE']);
    
    if ((docsRes.rowCount || 0) < 2) {
      res.status(400).json({ error: 'INSUFFICIENT_DOCUMENTS', message: 'Validate called with fewer than 2 documents' });
      return;
    }

    // Call LLM validation
    const payloads = docsRes.rows.map(row => ({
       documentType: row.document_type,
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
       res.status(422).json({ error: 'LLM_JSON_PARSE_FAIL', message: 'LLM returned unparseable response after retry' });
       return;
    }

    const output = result.parsedObject;
    output.validatedAt = new Date().toISOString();

    // Store validation result
    const valId = `val_${Date.now()}`;
    await pool.query(
      'INSERT INTO validations (id, session_id, result_json) VALUES ($1, $2, $3)',
      [valId, sessionId, JSON.stringify(output)]
    );

    res.json(output);
  } catch (error) {
    console.error('Error validating session:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected server error' });
  }
});

// GET /api/sessions/:sessionId/report
router.get('/:sessionId/report', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const sessionRes = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    if (sessionRes.rowCount === 0) {
       res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Session ID does not exist' });
       return;
    }

    const docsRes = await pool.query('SELECT * FROM extractions WHERE session_id = $1 AND status = $2', [sessionId, 'COMPLETE']);
    const extDocs = docsRes.rows;

    const valRes = await pool.query('SELECT result_json, created_at FROM validations WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1', [sessionId]);
    
    let latestValidation = null;
    let validatedAt = null;
    if ((valRes.rowCount || 0) > 0) {
       try {
         latestValidation = JSON.parse(valRes.rows[0].result_json);
         validatedAt = valRes.rows[0].created_at;
       } catch(e) {}
    }

    const report = {
      sessionId,
      reportGeneratedAt: new Date().toISOString(),
      validationStatus: latestValidation ? latestValidation.overallStatus : 'PENDING_VALIDATION',
      overallScore: latestValidation?.overallScore || null,
      summary: latestValidation?.summary || 'Session documents have not been cross-validated yet.',
      candidate: {
         name: latestValidation?.holderProfile?.name || extDocs.find(d => d.holder_name)?.holder_name || 'UNKNOWN',
         nationality: latestValidation?.holderProfile?.nationality || 'UNKNOWN',
         role: extDocs.find(d => d.applicable_role && d.applicable_role !== 'N/A')?.applicable_role || 'UNKNOWN'
      },
      documentMatrix: extDocs.map(d => {
         let isExp = d.is_expired === 1;
         let vDays = null;
         try {
            if (d.validity_json) {
              const vj = JSON.parse(d.validity_json);
              isExp = vj.isExpired || false;
              vDays = vj.daysUntilExpiry;
            }
         } catch(e){}
         return {
            fileName: d.file_name,
            documentType: d.document_type || 'UNKNOWN',
            status: isExp ? 'EXPIRED' : (vDays !== null && vDays < 90 ? 'EXPIRING_SOON' : 'VALID'),
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
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected server error' });
  }
});


// DELETE /api/sessions/:sessionId
router.delete('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    await pool.query('BEGIN');
    
    // Delete in order to respect foreign key constraints
    await pool.query('DELETE FROM validations WHERE session_id = $1', [sessionId]);
    await pool.query('DELETE FROM jobs WHERE session_id = $1', [sessionId]);
    await pool.query('DELETE FROM extractions WHERE session_id = $1', [sessionId]);
    const deleteRes = await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    
    await pool.query('COMMIT');

    if (deleteRes.rowCount === 0) {
       res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Session ID does not exist' });
       return;
    }

    res.status(200).json({ message: 'Session deleted successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected server error' });
  }
});

export default router;
