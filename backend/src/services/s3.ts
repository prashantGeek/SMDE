import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const uploadToS3 = async (buffer: Buffer, originalName: string, mimeType: string, sessionId: string): Promise<string | null> => {
  try {
    const s3Key = `sessions/${sessionId}/${crypto.randomUUID()}-${originalName}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME || "sdmebucket",
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
    });
    
    await s3Client.send(command);
    return `https://${process.env.AWS_S3_BUCKET_NAME || "sdmebucket"}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${s3Key}`;
  } catch (error) {
    console.error("S3 Upload Error:", error);
    return null;
  }
};