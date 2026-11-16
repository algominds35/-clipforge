import { getStore } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/http/current-user";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  const { id } = await context.params;
  const project = await getStore().getProject(user.id, id);
  if (!project) return jsonError("That project was not found on your account", 404);
  return Response.json({ project });
}
