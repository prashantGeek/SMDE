const fs = require('fs');
let code = fs.readFileSync('src/routes/sessions.ts', 'utf8');
const lines = code.split('\n');
const firstExport = lines.indexOf('export default router;');
if (firstExport !== -1 && lines.lastIndexOf('export default router;') !== firstExport) {
    lines.splice(firstExport, 1);
    fs.writeFileSync('src/routes/sessions.ts', lines.join('\n'));
}
