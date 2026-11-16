import { mkdir } from "node:fs/promises";
import path from "node:path";
import { resolveFfmpeg, resolveFfprobe } from "@/lib/video/binaries";
import { runProcess } from "@/lib/video/process";

export interface MediaInfo {
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string | null;
  formatName: string;
  sizeBytes: number;
  frameRate: number | null;
  videoFrames: number | null;
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  nb_read_frames?: string;
}

interface FfprobeJson {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
    format_name?: string;
    size?: string;
  };
}

function parseFrameRate(value: string | undefined): number | null {
  if (!value || value === "0/0") return null;
  const [num, den] = value.split("/").map(Number);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

function parseProbe(json: FfprobeJson): MediaInfo {
  const video = json.streams?.find((stream) => stream.codec_type === "video");
  const audio = json.streams?.find((stream) => stream.codec_type === "audio");
  const duration = Number(json.format?.duration);
  if (!video?.codec_name || !Number.isFinite(duration) || duration <= 0) {
    throw new Error("File does not contain a readable video stream");
  }
  const frames = video.nb_read_frames ? Number(video.nb_read_frames) : null;
  return {
    durationSeconds: duration,
    width: video.width ?? 0,
    height: video.height ?? 0,
    videoCodec: video.codec_name,
    audioCodec: audio?.codec_name ?? null,
    formatName: json.format?.format_name ?? "",
    sizeBytes: Number(json.format?.size ?? 0),
    frameRate: parseFrameRate(video.avg_frame_rate),
    videoFrames: frames !== null && Number.isFinite(frames) ? frames : null,
  };
}

export async function inspectVideo(filePath: string, countFrames = false): Promise<MediaInfo> {
  const args = ["-v", "error", "-print_format", "json", "-show_format", "-show_streams"];
  if (countFrames) {
    args.push("-count_frames");
  }
  args.push(filePath);
  const { stdout } = await runProcess(resolveFfprobe(), args);
  let parsed: FfprobeJson;
  try {
    parsed = JSON.parse(stdout) as FfprobeJson;
  } catch {
    throw new Error("FFprobe returned unreadable metadata");
  }
  return parseProbe(parsed);
}

export function assertCutRange(durationSeconds: number, startSeconds: number, endSeconds: number): void {
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
    throw new Error("Timestamps must be finite numbers");
  }
  if (startSeconds < 0) throw new Error("Start must be zero or greater");
  if (!(endSeconds > startSeconds)) throw new Error("End must be after start");
  if (endSeconds - startSeconds > 60 * 60) throw new Error("A single cut cannot be longer than 60 minutes");
  if (endSeconds > durationSeconds + 0.05) {
    throw new Error(
      `End ${endSeconds.toFixed(3)}s is past the video duration of ${durationSeconds.toFixed(3)}s`,
    );
  }
}

export async function cutVideo(options: {
  inputPath: string;
  outputPath: string;
  startSeconds: number;
  endSeconds: number;
}): Promise<MediaInfo> {
  const source = await inspectVideo(options.inputPath);
  assertCutRange(source.durationSeconds, options.startSeconds, options.endSeconds);
  await mkdir(path.dirname(options.outputPath), { recursive: true });

  const length = options.endSeconds - options.startSeconds;
  const args = [
    "-hide_banner",
    "-y",
    "-i",
    options.inputPath,
    "-ss",
    options.startSeconds.toFixed(3),
    "-t",
    length.toFixed(3),
    "-map",
    "0:v:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
  ];
  if (source.audioCodec) {
    args.push("-map", "0:a:0", "-c:a", "aac", "-b:a", "128k");
  }
  args.push("-movflags", "+faststart", options.outputPath);

  await runProcess(resolveFfmpeg(), args);
  const rendered = await inspectVideo(options.outputPath, true);
  if (!rendered.formatName.includes("mp4") || rendered.videoCodec !== "h264" || rendered.durationSeconds <= 0) {
    throw new Error("FFmpeg finished, but the output is not a valid H.264 MP4");
  }
  if (rendered.videoFrames !== null && rendered.videoFrames < 1) {
    throw new Error("Rendered MP4 contains no video frames");
  }
  return rendered;
}

export async function generateSampleVideo(outputPath: string, durationSeconds: number): Promise<void> {
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 120) {
    throw new Error("Sample duration must be an integer from 1 to 120 seconds");
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await runProcess(resolveFfmpeg(), [
    "-hide_banner",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc=size=1280x720:rate=30:duration=${durationSeconds}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:sample_rate=48000:duration=${durationSeconds}`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}
