import path from "node:path";
import { dataDir } from "@/lib/config";
import { LocalStore } from "@/lib/db/local-store";

let cached: { file: string; store: LocalStore } | null = null;

export function getStore(): LocalStore {
  const file = path.join(dataDir(), "db.json");
  if (!cached || cached.file !== file) {
    cached = { file, store: new LocalStore(file) };
  }
  return cached.store;
}
