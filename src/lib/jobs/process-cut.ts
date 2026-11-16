import { mkdir } from "node:fs/promises";
import { dataDir } from "@/lib/config";
import { getStore } from "@/lib/db";
import { LocalStore } from "@/lib/db/local-store";
import { resolveInside } from "@/lib/storage/paths";
import { cutVideo } from "@/lib/video/engine";

export interface JobDeps {
  store: LocalStore;
  storageRoot: string;
}

function defaultDeps(): JobDeps {
  return { store: getStore(), storageRoot: dataDir() };
}

function publicError(storageRoot: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "Render failed";
  return message.replaceAll(storageRoot, "[storage]").slice(0, 1500);
}

export async function processCutJob(jobId: string, deps: JobDeps = defaultDeps()): Promise<void> {
  const claimed = await deps.store.claimJob(jobId);
  if (!claimed) return;

  let outputPath: string | null = null;
  try {
    const video = await deps.store.getVideo(claimed.userId, claimed.videoId);
    if (!video) throw new Error("Source video is no longer available");
    const inputPath = resolveInside(deps.storageRoot, video.storageKey);
    const renderKey = `renders/${claimed.userId}/${claimed.id}.mp4`;
    outputPath = resolveInside(deps.storageRoot, renderKey);
    await deps.store.markJobProgress(claimed.id, 35);
    const rendered = await cutVideo({
      inputPath,
      outputPath,
      startSeconds: claimed.payload.startSeconds,
      endSeconds: claimed.payload.endSeconds,
    });
    await deps.store.markJobProgress(claimed.id, 90);
    await deps.store.completeJob({
      jobId: claimed.id,
      render: {
        userId: claimed.userId,
        projectId: claimed.projectId,
        jobId: claimed.id,
        storageKey: renderKey,
        durationSeconds: rendered.durationSeconds,
        width: rendered.width,
        height: rendered.height,
        videoCodec: rendered.videoCodec,
        audioCodec: rendered.audioCodec,
        sizeBytes: rendered.sizeBytes,
      },
      usage: {
        userId: claimed.userId,
        jobId: claimed.id,
        kind: "video_seconds_rendered",
        quantity: rendered.durationSeconds,
        estimatedCostUsd: null,
      },
    });
  } catch (error) {
    if (outputPath) {
      const { unlink } = await import("node:fs/promises");
      await unlink(outputPath).catch(() => undefined);
    }
    await deps.store.failJob(claimed.id, publicError(deps.storageRoot, error));
  }
}

export async function processQueuedJobs(deps: JobDeps = defaultDeps()): Promise<number> {
  await mkdir(deps.storageRoot, { recursive: true });
  const ids = await deps.store.listQueuedJobIds();
  for (const id of ids) {
    await processCutJob(id, deps);
  }
  return ids.length;
}
