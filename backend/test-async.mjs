import FormData from 'form-data';
import axios from 'axios';
import fs from 'fs';

async function test() {
  const form = new FormData();
  form.append('document', Buffer.from('test string'), { filename: 'test.pdf', contentType: 'application/pdf' });
  
  try {
    const res = await axios.post('http://localhost:8000/api/extract?mode=async', form, {
      headers: form.getHeaders()
    });
    console.log("Job created:", res.data);
    const { jobId } = res.data;
    
    setTimeout(async () => {
       const jobRes = await axios.get(`http://localhost:8000/api/jobs/${jobId}`);
       console.log("Job Poll:", jobRes.data);
    }, 1000);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
