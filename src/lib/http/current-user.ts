import { cookies } from "next/headers";
import { readSession, sessionCookieName } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import type { UserRecord } from "@/lib/db/types";

export async function currentUser(): Promise<UserRecord | null> {
  const jar = await cookies();
  const userId = readSession(jar.get(sessionCookieName)?.value);
  if (!userId) return null;
  return getStore().getUser(userId);
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
