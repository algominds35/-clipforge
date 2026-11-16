import { getStore } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/http/current-user";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  const { id } = await context.params;
  const job = await getStore().getJob(user.id, id);
  if (!job) return jsonError("That job was not found on your account", 404);
  const render = job.renderId ? await getStore().getRender(user.id, job.renderId) : null;
  return Response.json({ job, render });
}
