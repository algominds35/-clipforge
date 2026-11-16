import { after } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/http/current-user";
import { rateLimit } from "@/lib/http/rate-limit";
import { processCutJob } from "@/lib/jobs/process-cut";
import { cutSchema } from "@/lib/validation/schemas";
import { assertCutRange } from "@/lib/video/engine";

function idempotencyKey(request: Request): string | null {
  const value = request.headers.get("idempotency-key");
  if (!value) return null;
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(value)) {
    throw new Error("Idempotency-Key must be 8 to 80 letters, numbers, underscores, or hyphens");
  }
  return value;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  const jobs = await getStore().listJobs(user.id);
  return Response.json({ jobs });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  if (!rateLimit(`cut:${user.id}`, 15)) return jsonError("Too many cut requests. Wait a minute.", 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Send a JSON body", 400);
  }
  const parsed = cutSchema.safeParse(body);
  if (!parsed.success) return jsonError("Provide a video id, start time, and end time", 400);

  let key: string | null;
  try {
    key = idempotencyKey(request);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid idempotency key", 400);
  }

  const video = await getStore().getVideo(user.id, parsed.data.videoId);
  if (!video) return jsonError("That video was not found on your account", 404);

  try {
    assertCutRange(video.durationSeconds, parsed.data.startSeconds, parsed.data.endSeconds);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid cut range", 400);
  }

  const created = await getStore().createCutProject({
    userId: user.id,
    title: video.originalFilename,
    mode: user.mode,
    videoId: video.id,
    startSeconds: parsed.data.startSeconds,
    endSeconds: parsed.data.endSeconds,
    idempotencyKey: key,
  });

  if (created.job.status === "queued") {
    after(() => {
      void processCutJob(created.job.id);
    });
  }

  return Response.json({ job: created.job, project: created.project }, { status: created.job.status === "queued" ? 202 : 200 });
}
