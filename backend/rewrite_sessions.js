const fs = require('fs');
const file = '/Users/prashant/Desktop/smde/backend/src/routes/sessions.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
`      let flagCount = 0;
      let criticalFlagCount = 0;
      let parsedFlags = [];
      let parsedFields = [];

      try {
        if (row.fields_json) {
           parsedFields = JSON.parse(row.fields_json) || [];
        }`,
`      let flagCount = 0;
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
`
);

code = code.replace(
`        if (row.validity_json) {
           const val = JSON.parse(row.validity_json) || {};
           if (val.isExpired) isExpired = true;
           if (val.daysUntilExpiry !== null && val.daysUntilExpiry <= 90 && val.daysUntilExpiry > 0) {
               if (overallHealth !== 'CRITICAL') overallHealth = 'WARN';
           }
        }`,
`        if (row.validity_json) {
           validity = JSON.parse(row.validity_json) || {};
           if (validity.isExpired) isExpired = true;
           if (validity.daysUntilExpiry !== null && validity.daysUntilExpiry <= 90 && validity.daysUntilExpiry > 0) {
               if (overallHealth !== 'CRITICAL') overallHealth = 'WARN';
           }
        }`
);

code = code.replace(
`      return {
        id: row.id,
        fileName: row.file_name,
        documentType: row.document_type,
        applicableRole: row.applicable_role,
        holderName: row.holder_name,
        confidence: row.confidence,
        isExpired,
        flagCount,
        criticalFlagCount,
        fields: parsedFields,
        createdAt: row.created_at
      };`,
`      return {
        id: row.id,
        fileName: row.file_name,
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
      };`
);

fs.writeFileSync(file, code);
console.log("Rewrote sessions.ts!");
