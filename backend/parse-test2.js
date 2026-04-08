const fs = require('fs');
const pdf = require('pdf-parse');

const buffer = fs.readFileSync('../peme_medical_certificate.pdf');
pdf(buffer).then(data => {
  console.log("Extracted text len:", data.text.length);
  console.log("Extracted text summary:", data.text.substring(0, 200));
}).catch(err => {
  console.error(err);
});
