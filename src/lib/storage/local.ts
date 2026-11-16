import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "@/lib/config";
import { resolveInside } from "@/lib/storage/paths";

export async function writeLocalObject(key: string, bytes: Buffer): Promise<string> {
  const full = resolveInside(dataDir(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return full;
}

export function localObjectPath(key: string): string {
  return resolveInside(dataDir(), key);
}
