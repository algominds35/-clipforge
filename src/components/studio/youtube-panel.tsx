"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HighlightCandidate, ProjectRecord } from "@/lib/db/types";

function statusLabel(status: ProjectRecord["sourceStatus"]): string {
  switch (status) {
    case "youtube_metadata_only":
      return "YouTube metadata only";
    case "video_analysis_available":
      return "Highlights ready";
    case "source_media_available":
      return "Source file ready";
    case "editing_in_progress":
      return "Editing";
    case "finished_exports_available":
      return "Export ready";
  }
}

export function YoutubePanel({
  selectedVideoId,
  initialUrl = "",
}: {
  selectedVideoId: string | null;
  initialUrl?: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const started = useRef(false);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [geminiReady, setGeminiReady] = useState<boolean | null>(null);

  async function lookupUrl(nextUrl: string) {
    setBusy(true);
    setError(null);
    setNote(null);
    const response = await fetch("/api/youtube", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: nextUrl }),
    });
    const body = (await response.json()) as {
      project?: ProjectRecord;
      geminiConfigured?: boolean;
      sourceRequired?: string;
      error?: string;
    };
    setBusy(false);
    if (!response.ok || !body.project) {
      setError(body.error ?? "Could not read that link");
      return;
    }
    setProject(body.project);
    setGeminiReady(body.geminiConfigured ?? false);
    setNote(body.sourceRequired ?? null);
  }

  useEffect(() => {
    if (!initialUrl || started.current) return;
    started.current = true;
    void lookupUrl(initialUrl);
  }, [initialUrl]);

  function lookup(event: React.FormEvent) {
    event.preventDefault();
    void lookupUrl(url);
  }

  async function analyze() {
    if (!project) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/projects/${project.id}/analyze`, { method: "POST" });
    const body = (await response.json()) as { project?: ProjectRecord; error?: string };
    setBusy(false);
    if (!response.ok || !body.project) {
      setError(body.error ?? "Analysis failed");
      return;
    }
    setProject(body.project);
  }

  async function attach() {
    if (!project || !selectedVideoId) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/projects/${project.id}/source`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: selectedVideoId }),
    });
    const body = (await response.json()) as { project?: ProjectRecord; error?: string };
    setBusy(false);
    if (!response.ok || !body.project) {
      setError(body.error ?? "Could not attach that file");
      return;
    }
    setProject(body.project);
    setNote("Source file attached. Rendering can use this upload. The YouTube link is still only a reference.");
  }

  async function renderBlocked() {
    if (!project) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/projects/${project.id}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startSeconds: 10, endSeconds: 25 }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) setError(body.error ?? "Render did not start");
  }

  const highlights: HighlightCandidate[] = project?.analysis?.highlights ?? [];

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>YouTube link</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={lookup} className="flex flex-col gap-3 sm:flex-row">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="youtube">Public video URL</Label>
            <Input
              id="youtube"
              value={url}
              placeholder="https://www.youtube.com/watch?v=..."
              onChange={(event) => setUrl(event.target.value)}
              required
            />
          </div>
          <Button className="sm:self-end" type="submit" disabled={busy}>
            Preview
          </Button>
        </form>
        {project?.youtube ? (
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            {project.youtube.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="h-24 w-40 rounded-md object-cover" src={project.youtube.thumbnailUrl} alt="" />
            ) : (
              <div className="flex h-24 w-40 items-center justify-center rounded-md border border-border text-xs text-muted-foreground">
                No thumbnail
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{project.youtube.title ?? project.youtube.videoId}</p>
                <Badge variant="outline">{statusLabel(project.sourceStatus)}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{project.youtube.author ?? "Creator unavailable"}</p>
              <p className="text-sm text-muted-foreground">
                {project.youtube.durationSeconds ? `${project.youtube.durationSeconds}s` : "Duration needs a YouTube Data API key"}
              </p>
            </div>
          </div>
        ) : null}
        {project ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy || geminiReady === false} onClick={() => void analyze()}>
              Find highlights
            </Button>
            <Button type="button" variant="outline" disabled={busy || !selectedVideoId} onClick={() => void attach()}>
              Use selected upload as source
            </Button>
            {!project.sourceVideoId ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void renderBlocked()}>
                Try render
              </Button>
            ) : null}
          </div>
        ) : null}
        {geminiReady === false ? (
          <p className="text-sm text-muted-foreground">Highlight detection needs GEMINI_API_KEY on the server. No analysis was invented.</p>
        ) : null}
        {highlights.length > 0 ? (
          <ul className="grid gap-2 text-sm">
            {highlights.map((item) => (
              <li key={`${item.startSeconds}-${item.title}`} className="rounded-lg border border-border px-3 py-2">
                <span className="font-medium">
                  {item.startSeconds.toFixed(1)}s–{item.endSeconds.toFixed(1)}s · {item.title}
                </span>
                <span className="mt-1 block text-muted-foreground">{item.description}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
