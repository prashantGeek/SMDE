import FormData from 'form-data';
import axios from 'axios';
import fs from 'fs';

async function test() {
  const form = new FormData();
  form.append('document', Buffer.from('test string'), { filename: 'test.pdf', contentType: 'application/pdf' });
  form.append('sessionId', '1199200d-d2ea-4264-954c-656a60a739bb');
  
  try {
    const res = await axios.post('http://localhost:8000/api/extract?mode=async', form, {
      headers: form.getHeaders()
    });
    console.log("Response:", res.status, res.headers['x-deduplicated']);
    console.log(res.data);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
