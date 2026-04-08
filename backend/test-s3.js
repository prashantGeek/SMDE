require("dotenv").config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const client = new S3Client({
  region: process.env.AWS_REGION?.trim() || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() || ""
  }
});
async function run() {
  const bucketName = process.env.AWS_S3_BUCKET_NAME?.trim();
  console.log("Bucket:", bucketName, "Region:", process.env.AWS_REGION?.trim());
  const cmd = new PutObjectCommand({ Bucket: bucketName, Key: "test.txt", Body: "hello world" });
  try {
    await client.send(cmd);
    console.log("Success!");
  } catch (err) {
    console.error("Error:", err.message, err.name);
  }
}
run();
