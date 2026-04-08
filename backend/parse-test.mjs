import fs from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const buffer = fs.readFileSync('../peme_medical_certificate.pdf');
pdf(buffer).then(data => {
  console.log("Extracted text:", data.text);
}).catch(err => {
  console.error(err);
});
