import { getStore } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/http/current-user";
import { videoFileResponse } from "@/lib/http/video-file";
import { localObjectPath } from "@/lib/storage/local";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  const { id } = await context.params;
  const render = await getStore().getRender(user.id, id);
  if (!render) return jsonError("That render was not found on your account", 404);
  try {
    return await videoFileResponse(localObjectPath(render.storageKey), request, "clipforge-cut.mp4");
  } catch {
    return jsonError("The rendered file is missing from storage", 404);
  }
}
