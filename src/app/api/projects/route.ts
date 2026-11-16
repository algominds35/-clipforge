import { getStore } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/http/current-user";

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  const projects = await getStore().listProjects(user.id);
  return Response.json({ projects });
}
