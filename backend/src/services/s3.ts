import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION?.trim() || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() || "",
  },
});

export const uploadToS3 = async (buffer: Buffer, originalName: string, mimeType: string, sessionId: string): Promise<string | null> => {
  try {
    const bucketName = process.env.AWS_S3_BUCKET_NAME?.trim() || "smdebucket";
    const region = process.env.AWS_REGION?.trim() || "ap-south-1";
    
    if (!bucketName) throw new Error("Bucket name not configured.");
    
    const s3Key = `sessions/${sessionId}/${crypto.randomUUID()}-${originalName}`;
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
    });
    
    await s3Client.send(command);
    return `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;
  } catch (error: any) {
    console.error("S3 Upload Error:", error);
    return null;
  }
};