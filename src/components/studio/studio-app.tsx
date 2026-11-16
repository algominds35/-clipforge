"use client";

import { Download, Loader2, Scissors, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { YoutubePanel } from "@/components/studio/youtube-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreatorMode, JobRecord, RenderRecord, UserRecord, VideoRecord } from "@/lib/db/types";

interface SessionResponse {
  user: UserRecord;
}

interface JobResponse {
  job: JobRecord;
  render: RenderRecord | null;
}

function formatSeconds(value: number): string {
  return `${value.toFixed(2)}s`;
}

export function StudioApp() {
  const params = useSearchParams();
  const initialUrl = params.get("url") ?? "";
  const prompt = params.get("prompt");
  const format = params.get("format");
  const output = params.get("output");
  const captions = params.get("captions") === "1";
  const requestedVideoId = params.get("videoId");
  const [user, setUser] = useState<UserRecord | null>(null);
  const [checking, setChecking] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<CreatorMode>("streamer");
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [start, setStart] = useState("10");
  const [end, setEnd] = useState("25");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [render, setRender] = useState<RenderRecord | null>(null);

  const selected = videos.find((video) => video.id === selectedId) ?? null;

  async function loadVideos() {
    const response = await fetch("/api/videos");
    if (!response.ok) return;
    const body = (await response.json()) as { videos: VideoRecord[] };
    setVideos(body.videos);
    setSelectedId((current) => {
      if (current && body.videos.some((video) => video.id === current)) return current;
      if (requestedVideoId && body.videos.some((video) => video.id === requestedVideoId)) return requestedVideoId;
      return body.videos[0]?.id ?? null;
    });
  }

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/auth/session");
      if (response.ok) {
        const body = (await response.json()) as SessionResponse;
        setUser(body.user);
        setMode(body.user.mode);
        await loadVideos();
      }
      setChecking(false);
    })();
  }, []);

  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "running")) return;
    const timer = window.setInterval(() => {
      void (async () => {
        const response = await fetch(`/api/jobs/${job.id}`);
        if (!response.ok) return;
        const body = (await response.json()) as JobResponse;
        setJob(body.job);
        setRender(body.render);
        if (body.job.status === "succeeded") setMessage("Cut complete. The MP4 is ready.");
        if (body.job.status === "failed") setError(body.job.error ?? "The cut failed");
      })();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [job]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, mode }),
    });
    const body = (await response.json()) as SessionResponse & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Could not start a session");
      return;
    }
    setUser(body.user);
  }

  async function switchMode(next: CreatorMode) {
    setMode(next);
    if (!user) return;
    const response = await fetch("/api/auth/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as SessionResponse;
    setUser(body.user);
  }

  async function upload(file: File) {
    setError(null);
    setMessage(null);
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/videos", { method: "POST", body: form });
    const body = (await response.json()) as { video?: VideoRecord; error?: string };
    setBusy(false);
    if (!response.ok || !body.video) {
      setError(body.error ?? "Upload failed");
      return;
    }
    setVideos((current) => [body.video!, ...current]);
    setSelectedId(body.video.id);
    setMessage(`Uploaded ${body.video.originalFilename}. Duration ${formatSeconds(body.video.durationSeconds)}.`);
  }

  async function cut(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    setMessage(null);
    setRender(null);
    setBusy(true);
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: selected.id,
        startSeconds: Number(start),
        endSeconds: Number(end),
      }),
    });
    const body = (await response.json()) as { job?: JobRecord; error?: string };
    setBusy(false);
    if (!response.ok || !body.job) {
      setError(body.error ?? "Could not start the cut");
      return;
    }
    setJob(body.job);
    setMessage("Cut queued. FFmpeg is rendering a new MP4. The original file stays unchanged.");
  }

  if (checking) {
    return <p className="p-8 text-muted-foreground">Loading studio…</p>;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">ClipForge</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Are you a streamer or a clipper?</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Both modes use the same editor. This local session is for development until Supabase Auth is configured.
        </p>
        <form onSubmit={signIn} className="mt-8 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["streamer", "clipper"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={`rounded-xl border px-4 py-4 text-left ${mode === option ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <span className="block font-medium capitalize">{option}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {option === "streamer" ? "Cut your own recordings." : "Edit footage you have permission to use."}
                </span>
              </button>
            ))}
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue
          </Button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[280px_1fr]">
      <aside className="border-b border-border p-5 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold">Library</p>
        <p className="mt-1 text-sm text-muted-foreground">{user.displayName}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["streamer", "clipper"] as const).map((option) => (
            <Button key={option} type="button" variant={user.mode === option ? "default" : "outline"} size="sm" onClick={() => switchMode(option)}>
              {option}
            </Button>
          ))}
        </div>
        <div className="mt-8">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Uploads</p>
          <div className="mt-3 grid gap-2">
            {videos.length === 0 ? <p className="text-sm text-muted-foreground">No videos yet.</p> : null}
            {videos.map((video) => (
              <button
                key={video.id}
                type="button"
                onClick={() => setSelectedId(video.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${selectedId === video.id ? "border-primary" : "border-border"}`}
              >
                <span className="block truncate">{video.originalFilename}</span>
                <span className="text-muted-foreground">{formatSeconds(video.durationSeconds)}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
      <main className="px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Cut a clip</h1>
          <Badge>{user.mode}</Badge>
        </div>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Paste a public YouTube link for a preview, or upload a source video and cut an exact range. A link alone cannot be rendered.
        </p>
        {prompt ? <p className="mt-4 max-w-2xl text-sm text-muted-foreground">Request: {prompt}</p> : null}
        {output || format ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Format: {[output, format, captions ? "Captions requested" : null].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <YoutubePanel selectedVideoId={selectedId} initialUrl={initialUrl} />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Source</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-sm">
                <Upload className="h-4 w-4" />
                {busy ? "Working…" : "Upload mp4, mov, webm, or mkv"}
                <input
                  className="sr-only"
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
              </Label>
              {selected ? (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd>{formatSeconds(selected.durationSeconds)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Frame size</dt>
                    <dd>
                      {selected.width}×{selected.height}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Video</dt>
                    <dd>{selected.videoCodec}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Audio</dt>
                    <dd>{selected.audioCodec ?? "none"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Upload a video to inspect its metadata.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Timestamp cut</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={cut} className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="start">Start (seconds)</Label>
                    <Input id="start" inputMode="decimal" value={start} onChange={(event) => setStart(event.target.value)} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="end">End (seconds)</Label>
                    <Input id="end" inputMode="decimal" value={end} onChange={(event) => setEnd(event.target.value)} required />
                  </div>
                </div>
                <Button type="submit" disabled={!selected || busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                  Render MP4
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        {message ? <p className="mt-6 text-sm text-foreground">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        {job ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Job {job.status} · {job.progress}%
          </p>
        ) : null}
        {render ? (
          <div className="mt-6 max-w-3xl">
            <video className="w-full rounded-xl border border-border bg-black" controls playsInline src={`/api/renders/${render.id}/file`} />
            <a className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary" href={`/api/renders/${render.id}/file?download=1`}>
              <Download className="h-4 w-4" />
              Download MP4 ({formatSeconds(render.durationSeconds)})
            </a>
          </div>
        ) : null}
      </main>
    </div>
  );
}
