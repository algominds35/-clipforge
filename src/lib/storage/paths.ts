import path from "node:path";

export function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[\u0000-\u001f]/g, "");
  const cleaned = base.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 120) || "video.mp4";
}

export function extensionOf(filename: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(sanitizeFilename(filename));
  return match ? match[1].toLowerCase() : "";
}

const ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "webm", "mkv"]);

export function assertAllowedVideoFilename(filename: string): string {
  const safe = sanitizeFilename(filename);
  const extension = extensionOf(safe);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Upload a video that ends in .mp4, .mov, .webm, or .mkv");
  }
  return safe;
}

export function resolveInside(root: string, key: string): string {
  if (!key || key.includes("\0")) {
    throw new Error("Invalid storage key");
  }
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("Invalid storage key");
  }
  const rootResolved = path.resolve(root);
  const full = path.resolve(rootResolved, ...normalized.split("/"));
  const relative = path.relative(rootResolved, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes storage root");
  }
  return full;
}
