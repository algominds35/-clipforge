import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.cwd(), "package.json"));

function fromPackage(name: "ffmpeg-static" | "ffprobe-static"): string | null {
  try {
    const loaded = require(name) as string | { path?: string } | null;
    const candidate = typeof loaded === "string" ? loaded : loaded?.path;
    if (candidate && existsSync(candidate)) return candidate;
  } catch {
    return null;
  }
  return null;
}

export function resolveFfmpeg(): string {
  const override = process.env.FFMPEG_PATH;
  if (override) {
    if (!existsSync(override)) throw new Error(`FFMPEG_PATH does not exist: ${override}`);
    return override;
  }
  return fromPackage("ffmpeg-static") ?? "ffmpeg";
}

export function resolveFfprobe(): string {
  const override = process.env.FFPROBE_PATH;
  if (override) {
    if (!existsSync(override)) throw new Error(`FFPROBE_PATH does not exist: ${override}`);
    return override;
  }
  return fromPackage("ffprobe-static") ?? "ffprobe";
}
