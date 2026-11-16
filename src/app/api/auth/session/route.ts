import { cookies } from "next/headers";
import { signSession, sessionCookieName } from "@/lib/auth/session";
import { supabaseConfigured } from "@/lib/config";
import { getStore } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/http/current-user";
import { rateLimit } from "@/lib/http/rate-limit";
import { modeSchema, sessionSchema } from "@/lib/validation/schemas";

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  return Response.json({
    user,
    auth: supabaseConfigured() ? "supabase" : "local-dev",
  });
}

export async function POST(request: Request) {
  if (supabaseConfigured()) {
    return jsonError("This server uses Supabase Auth. Local development sign-in is disabled.", 409);
  }
  if (!rateLimit("dev-session", 20)) return jsonError("Too many sign-in attempts. Wait a minute.", 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Send a JSON body", 400);
  }
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) return jsonError("Enter a display name and choose streamer or clipper", 400);

  const user = await getStore().createUser(parsed.data);
  const jar = await cookies();
  jar.set(sessionCookieName, signSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return Response.json({ user, auth: "local-dev" }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Send a JSON body", 400);
  }
  const parsed = modeSchema.safeParse(body);
  if (!parsed.success) return jsonError("Choose streamer or clipper", 400);
  const updated = await getStore().updateMode(user.id, parsed.data.mode);
  if (!updated) return jsonError("Account not found", 404);
  return Response.json({ user: updated });
}
