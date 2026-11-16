import { getStore } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/http/current-user";
import { sourceLinkSchema } from "@/lib/validation/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Send a JSON body", 400);
  }
  const parsed = sourceLinkSchema.safeParse(body);
  if (!parsed.success) return jsonError("Choose one of your uploaded videos", 400);
  const project = await getStore().attachSource(user.id, id, parsed.data.videoId);
  if (!project) return jsonError("That project or video was not found on your account", 404);
  return Response.json({ project });
}
