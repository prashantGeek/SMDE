import FormData from 'form-data';
import axios from 'axios';

// 1x1 transparent PNG
const pngBytes = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');

async function test() {
  const form = new FormData();
  form.append('document', pngBytes, { filename: 'test.png', contentType: 'image/png' });
  form.append('sessionId', 'test-session-real');
  
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
