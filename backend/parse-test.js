const fs = require('fs');
const pdf = require('pdf-parse');

const buffer = fs.readFileSync('../peme_medical_certificate.pdf');
pdf(buffer).then(data => {
  console.log("Extracted text:", data.text);
}).catch(err => {
  console.error(err);
});
