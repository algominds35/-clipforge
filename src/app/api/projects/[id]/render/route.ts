import { after } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/http/current-user";
import { rateLimit } from "@/lib/http/rate-limit";
import { processCutJob } from "@/lib/jobs/process-cut";
import { rangeSchema } from "@/lib/validation/schemas";
import { assertCutRange } from "@/lib/video/engine";
import { assertSourceMedia, SOURCE_REQUIRED_MESSAGE } from "@/lib/youtube/source";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  if (!rateLimit(`render:${user.id}`, 10)) return jsonError("Too many render requests. Wait a minute.", 429);
  const { id } = await context.params;
  const project = await getStore().getProject(user.id, id);
  if (!project) return jsonError("That project was not found on your account", 404);

  let sourceVideoId: string;
  try {
    sourceVideoId = assertSourceMedia(project);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : SOURCE_REQUIRED_MESSAGE, 409);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Send a JSON body", 400);
  }
  const parsed = rangeSchema.safeParse(body);
  if (!parsed.success) return jsonError("Provide a start time and an end time", 400);
  const video = await getStore().getVideo(user.id, sourceVideoId);
  if (!video) return jsonError("The linked source video is missing", 404);
  try {
    assertCutRange(video.durationSeconds, parsed.data.startSeconds, parsed.data.endSeconds);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid cut range", 400);
  }

  const queued = await getStore().queueCut({
    userId: user.id,
    projectId: project.id,
    startSeconds: parsed.data.startSeconds,
    endSeconds: parsed.data.endSeconds,
    idempotencyKey: null,
  });
  if (!queued) return jsonError(SOURCE_REQUIRED_MESSAGE, 409);
  after(() => {
    void processCutJob(queued.job.id);
  });
  return Response.json({ job: queued.job, project: queued.project }, { status: 202 });
}
