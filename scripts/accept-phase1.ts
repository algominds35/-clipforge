import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateSampleVideo, inspectVideo } from "../src/lib/video/engine";

const base = process.env.CLIPFORGE_URL ?? "http://127.0.0.1:3000";

function cookieHeader(response: Response): string {
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const header = cookies.map((value) => value.split(";")[0]).join("; ");
  if (!header) throw new Error("Sign-in did not set a session cookie");
  return header;
}

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), "clipforge-http-"));
  const sample = path.join(dir, "sample.mp4");
  await generateSampleVideo(sample, 30);
  const bytes = await readFile(sample);

  const signIn = await fetch(`${base}/api/auth/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: "Ada", mode: "streamer" }),
  });
  if (!signIn.ok) throw new Error(`Sign-in failed: ${await signIn.text()}`);
  const cookie = cookieHeader(signIn);

  const form = new FormData();
  form.set("file", new Blob([bytes], { type: "video/mp4" }), "sample.mp4");
  const uploaded = await fetch(`${base}/api/videos`, { method: "POST", headers: { cookie }, body: form });
  if (!uploaded.ok) throw new Error(`Upload failed: ${await uploaded.text()}`);
  const uploadBody = (await uploaded.json()) as { video: { id: string; durationSeconds: number } };
  if (uploadBody.video.durationSeconds < 29) throw new Error("Uploaded video is shorter than the sample");

  const other = await fetch(`${base}/api/auth/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: "Bea", mode: "clipper" }),
  });
  if (!other.ok) throw new Error(`Second sign-in failed: ${await other.text()}`);
  const otherCookie = cookieHeader(other);
  const hidden = await fetch(`${base}/api/videos`, { headers: { cookie: otherCookie } });
  const hiddenBody = (await hidden.json()) as { videos: Array<{ id: string }> };
  if (hiddenBody.videos.some((video) => video.id === uploadBody.video.id)) {
    throw new Error("Another user can see the uploaded video");
  }

  const queued = await fetch(`${base}/api/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ videoId: uploadBody.video.id, startSeconds: 10, endSeconds: 25 }),
  });
  if (queued.status !== 202) throw new Error(`Cut was not queued: ${queued.status} ${await queued.text()}`);
  const queuedBody = (await queued.json()) as { job: { id: string } };

  let renderId: string | null = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const status = await fetch(`${base}/api/jobs/${queuedBody.job.id}`, { headers: { cookie } });
    const statusBody = (await status.json()) as {
      job: { status: string; error: string | null };
      render: { id: string } | null;
    };
    if (statusBody.job.status === "failed") throw new Error(statusBody.job.error ?? "Cut failed");
    if (statusBody.job.status === "succeeded" && statusBody.render) {
      renderId = statusBody.render.id;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!renderId) throw new Error("Cut did not finish");

  const blocked = await fetch(`${base}/api/renders/${renderId}/file`, { headers: { cookie: otherCookie } });
  if (blocked.status !== 404) throw new Error(`Expected another user to get 404, got ${blocked.status}`);

  const download = await fetch(`${base}/api/renders/${renderId}/file?download=1`, { headers: { cookie } });
  if (!download.ok) throw new Error(`Download failed: ${download.status}`);
  const output = path.join(dir, "cut.mp4");
  await writeFile(output, Buffer.from(await download.arrayBuffer()));
  const info = await inspectVideo(output, true);
  if (info.videoCodec !== "h264" || info.audioCodec !== "aac" || !info.formatName.includes("mp4")) {
    throw new Error(`Output is not a playable H.264/AAC MP4: ${JSON.stringify(info)}`);
  }
  if (info.durationSeconds < 14.7 || info.durationSeconds > 15.3) {
    throw new Error(`Expected about 15 seconds, got ${info.durationSeconds}`);
  }
  console.log(
    JSON.stringify({
      ok: true,
      durationSeconds: info.durationSeconds,
      videoCodec: info.videoCodec,
      audioCodec: info.audioCodec,
      frames: info.videoFrames,
      bytes: info.sizeBytes,
      output,
    }),
  );
}

void main();
