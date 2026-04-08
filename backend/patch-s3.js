const fs = require('fs');
let code = fs.readFileSync('src/services/s3.ts', 'utf8');
code = code.replace('console.error("S3 Upload Error:", error);', 'console.error("S3 Upload Error:", error); require("fs").appendFileSync("s3-error.log", error.name + ": " + error.message + "\\n");');
fs.writeFileSync('src/services/s3.ts', code);
