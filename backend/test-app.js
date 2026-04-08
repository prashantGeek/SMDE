require("dotenv").config();
const { uploadToS3 } = require("./dist/services/s3");
async function run() {
  const res = await uploadToS3(Buffer.from("test"), "test.jpg", "image/jpeg", "session-123");
  console.log("Result:", res);
}
run();
