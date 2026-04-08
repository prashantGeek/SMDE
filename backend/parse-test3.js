const fs = require('fs');
const PDFParser = require('pdf2json');

const pdfParser = new PDFParser(this, 1);
pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
pdfParser.on("pdfParser_dataReady", pdfData => {
  console.log("Extracted:", pdfParser.getRawTextContent());
});
pdfParser.loadPDF("../peme_medical_certificate.pdf");
