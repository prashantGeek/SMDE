import FormData from 'form-data';
import axios from 'axios';
import fs from 'fs';

async function test() {
  const form = new FormData();
  form.append('document', fs.createReadStream('../peme_medical_certificate.pdf'));
  form.append('sessionId', 'test-session-peme-' + Date.now()); // New session ID doesn't clear deduplication because file hash is same if session is different, wait, deduplication is per session or global?
  
  try {
    console.log("Uploading peme_medical_certificate.pdf...");
    const res = await axios.post('http://localhost:8000/api/extract?mode=sync', form, {
      headers: form.getHeaders()
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error("Error:", e.response ? e.response.data : e.message);
  }
}
test();
