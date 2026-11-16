import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { LocalStore } from "@/lib/db/local-store";
import { processCutJob } from "@/lib/jobs/process-cut";
import { resolveInside } from "@/lib/storage/paths";
import { cutVideo, generateSampleVideo, inspectVideo } from "@/lib/video/engine";

const scratch = await mkdtemp(path.join(tmpdir(), "clipforge-cut-"));

afterAll(async () => {
  await rm(scratch, { recursive: true, force: true });
});

describe("ffmpeg cut", () => {
  it("cuts seconds 10-25 into a playable 15 second MP4", async () => {
    const sample = path.join(scratch, "sample.mp4");
    const output = path.join(scratch, "cut.mp4");
    await generateSampleVideo(sample, 30);
    const source = await inspectVideo(sample, true);
    expect(source.durationSeconds).toBeGreaterThan(29);
    expect(source.videoCodec).toBe("h264");

    const rendered = await cutVideo({
      inputPath: sample,
      outputPath: output,
      startSeconds: 10,
      endSeconds: 25,
    });

    expect(rendered.formatName).toContain("mp4");
    expect(rendered.videoCodec).toBe("h264");
    expect(rendered.audioCodec).toBe("aac");
    expect(rendered.durationSeconds).toBeGreaterThan(14.7);
    expect(rendered.durationSeconds).toBeLessThan(15.3);
    expect(rendered.videoFrames ?? 0).toBeGreaterThan(400);
    expect(rendered.width).toBe(1280);
    expect(rendered.height).toBe(720);
  });

  it("keeps the source file, attributes usage, and hides the render from other users", async () => {
    const root = path.join(scratch, "account");
    const store = new LocalStore(path.join(root, "db.json"));
    const owner = await store.createUser({ displayName: "Owner", mode: "streamer" });
    const stranger = await store.createUser({ displayName: "Stranger", mode: "clipper" });
    const sample = path.join(scratch, "owned-source.mp4");
    await generateSampleVideo(sample, 30);
    const info = await inspectVideo(sample);
    const storageKey = `uploads/${owner.id}/source.mp4`;
    const storedSource = resolveInside(root, storageKey);
    await mkdir(path.dirname(storedSource), { recursive: true });
    await copyFile(sample, storedSource);
    const before = await readFile(storedSource);
    const video = await store.createVideo(owner.id, {
      originalFilename: "owned-source.mp4",
      storageKey,
      durationSeconds: info.durationSeconds,
      width: info.width,
      height: info.height,
      videoCodec: info.videoCodec,
      audioCodec: info.audioCodec,
      sizeBytes: before.byteLength,
    });
    const { job } = await store.createCutProject({
      userId: owner.id,
      title: video.originalFilename,
      mode: owner.mode,
      videoId: video.id,
      startSeconds: 10,
      endSeconds: 25,
      idempotencyKey: null,
    });

    await processCutJob(job.id, { store, storageRoot: root });

    const finished = await store.getJob(owner.id, job.id);
    expect(finished?.status).toBe("succeeded");
    expect(finished?.renderId).toBeTruthy();
    const render = await store.getRender(owner.id, finished!.renderId!);
    expect(render).not.toBeNull();
    const rendered = await inspectVideo(resolveInside(root, render!.storageKey), true);
    expect(rendered.durationSeconds).toBeGreaterThan(14.7);
    expect(rendered.durationSeconds).toBeLessThan(15.3);
    expect(rendered.videoCodec).toBe("h264");
    const after = await readFile(storedSource);
    expect(Buffer.compare(before, after)).toBe(0);

    expect(await store.getVideo(stranger.id, video.id)).toBeNull();
    expect(await store.getJob(stranger.id, job.id)).toBeNull();
    expect(await store.getRender(stranger.id, render!.id)).toBeNull();
    const usage = await store.listUsage(owner.id);
    expect(usage).toHaveLength(1);
    expect(usage[0]?.userId).toBe(owner.id);
    expect(usage[0]?.kind).toBe("video_seconds_rendered");
    expect(usage[0]?.quantity).toBeGreaterThan(14.7);
    expect(usage[0]?.estimatedCostUsd).toBeNull();
    expect(await store.listUsage(stranger.id)).toEqual([]);
  });
});
