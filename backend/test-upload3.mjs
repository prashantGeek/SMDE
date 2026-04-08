import FormData from 'form-data';
import axios from 'axios';

async function test() {
  const form = new FormData();
  form.append('document', Buffer.from('abc' + Math.random()), { filename: 'test.pdf', contentType: 'application/pdf' });
  form.append('sessionId', 'test-session-' + Math.random());
  
  try {
    const res = await axios.post('http://localhost:8000/api/extract?mode=sync', form, {
      headers: form.getHeaders()
    });
    console.log(res.data);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
