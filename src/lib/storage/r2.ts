import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Configured } from "@/lib/config";

function requireR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Cloudflare R2 is not configured");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function createR2Client(): { client: S3Client; bucket: string } {
  const config = requireR2();
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return { client, bucket: config.bucket };
}

export async function presignR2Upload(key: string, contentType: string): Promise<string> {
  if (!r2Configured()) throw new Error("Cloudflare R2 is not configured");
  const { client, bucket } = createR2Client();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 },
  );
}

export async function presignR2Download(key: string): Promise<string> {
  if (!r2Configured()) throw new Error("Cloudflare R2 is not configured");
  const { client, bucket } = createR2Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: 3600 },
  );
}
