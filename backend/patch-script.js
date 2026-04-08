const fs = require('fs');
const content = fs.readFileSync('backend/src/routes/sessions.ts', 'utf8');

const getSessionsCode = `
// GET /api/sessions
router.get('/', async (req, res) => {
  try {
    const sessionsRes = await pool.query('SELECT * FROM sessions ORDER BY created_at DESC');
    
    // Attempt to gather candidate names from initial extractions for display
    const namesRes = await pool.query(\`
      SELECT session_id, holder_name, applicable_role 
      FROM extractions 
      ORDER BY created_at ASC
    \`);

    const namesMap = {};
    const rolesMap = {};
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
`;

let newContent = content.replace("const router = express.Router();", "const router = express.Router();\n" + getSessionsCode);

fs.writeFileSync('backend/src/routes/sessions.ts', newContent);
console.log('patched sessions');
