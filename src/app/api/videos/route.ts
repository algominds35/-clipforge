import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { maxUploadBytes } from "@/lib/config";
import { getStore } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/http/current-user";
import { rateLimit } from "@/lib/http/rate-limit";
import { localObjectPath, writeLocalObject } from "@/lib/storage/local";
import { assertAllowedVideoFilename } from "@/lib/storage/paths";
import { inspectVideo } from "@/lib/video/engine";

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  const videos = await getStore().listVideos(user.id);
  return Response.json({ videos });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  if (!rateLimit(`upload:${user.id}`, 10)) return jsonError("Too many uploads. Wait a minute.", 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Upload the video as form data", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Choose a video file", 400);
  if (file.size < 1) return jsonError("That file is empty", 400);
  if (file.size > maxUploadBytes()) {
    return jsonError(`That file is larger than the ${maxUploadBytes()} byte upload limit`, 413);
  }

  let filename: string;
  try {
    filename = assertAllowedVideoFilename(file.name);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unsupported file", 400);
  }

  const videoId = randomUUID();
  const storageKey = `uploads/${user.id}/${videoId}/source.${filename.split(".").pop()}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const fullPath = await writeLocalObject(storageKey, bytes);

  try {
    const info = await inspectVideo(fullPath);
    const video = await getStore().createVideo(user.id, {
      originalFilename: filename,
      storageKey,
      durationSeconds: info.durationSeconds,
      width: info.width,
      height: info.height,
      videoCodec: info.videoCodec,
      audioCodec: info.audioCodec,
      sizeBytes: info.sizeBytes || file.size,
    });
    return Response.json({ video }, { status: 201 });
  } catch (error) {
    await unlink(localObjectPath(storageKey)).catch(() => undefined);
    return jsonError(error instanceof Error ? error.message : "Could not read that video", 400);
  }
}
