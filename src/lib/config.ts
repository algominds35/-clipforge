import path from "node:path";

export function dataDir(): string {
  const configured = process.env.CLIPFORGE_DATA_DIR;
  if (configured) return path.resolve(/*turbopackIgnore: true*/ configured);
  return path.join(process.cwd(), "data");
}

export function maxUploadBytes(): number {
  const raw = process.env.MAX_UPLOAD_BYTES;
  if (!raw) return 200 * 1024 * 1024;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("MAX_UPLOAD_BYTES must be a positive number");
  }
  return parsed;
}

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function geminiVideoModel(): string {
  return process.env.GEMINI_VIDEO_MODEL || "gemini-3.5-flash";
}

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

export function sessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 16 characters in production");
  }
  return "clipforge-dev-session-secret";
}
