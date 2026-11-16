"use client";

import { Link2, Loader2, Paperclip, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ClipResults } from "@/components/home/clip-results";
import type { VideoRecord } from "@/lib/db/types";

const outputs = [
  { id: "youtube-shorts", label: "YouTube Shorts" },
  { id: "tiktok", label: "TikTok" },
  { id: "instagram-reels", label: "Instagram Reels" },
] as const;

const examples = [
  "Find the 5 funniest GTA 6 moments.",
  "Turn the best police chases into Shorts.",
  "Make 3 clips with animated captions and reaction zooms.",
  "Find the craziest fails in this stream.",
];

type OutputId = (typeof outputs)[number]["id"];

export function CreateHome() {
  const router = useRouter();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState<OutputId>("youtube-shorts");
  const [captions, setCaptions] = useState(true);
  const [uploaded, setUploaded] = useState<VideoRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const outputLabel = outputs.find((item) => item.id === output)?.label ?? "YouTube Shorts";

  function openStudio(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    const url = videoUrl.trim();
    const request = prompt.trim();
    if (url) params.set("url", url);
    if (request) params.set("prompt", request);
    if (uploaded) params.set("videoId", uploaded.id);
    params.set("format", "9:16");
    params.set("output", outputLabel);
    if (captions) params.set("captions", "1");
    if (!url && !request && !uploaded) {
      setFormError("Add a link, a request, or a source file.");
      return;
    }
    setFormError(null);
    router.push(`/studio?${params.toString()}`);
  }

  async function uploadFile(file: File) {
    setUploadError(null);
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/videos", { method: "POST", body: form });
    const body = (await response.json()) as { video?: VideoRecord; error?: string };
    setUploading(false);
    if (response.status === 401) {
      setUploadError("Sign in before uploading a source file.");
      return;
    }
    if (!response.ok || !body.video) {
      setUploadError(body.error ?? "Upload failed");
      return;
    }
    setUploaded(body.video);
  }

  function useExample(text: string) {
    setPrompt(text);
    promptRef.current?.focus();
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(124,77,255,0.28),transparent_58%),radial-gradient(ellipse_50%_40%_at_80%_20%,rgba(91,108,255,0.16),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-40 [background-image:linear-gradient(rgba(148,163,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,255,0.08)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <main className="relative mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <section className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-medium tracking-[0.22em] text-indigo-200/80">BUILT FOR GTA 6 CREATORS</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
            The AI Clipper Built for GTA 6.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium leading-7 text-zinc-200 sm:text-xl">
            Turn hours of GTA 6 gameplay into professional Shorts in minutes.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
            Paste a video link, tell ClipForge what moments you want, and let AI find highlights, add animated captions, and create ready-to-post Shorts.
          </p>
          <p className="mt-5 text-xs tracking-[0.16em] text-zinc-500 uppercase">Streamers and professional clippers</p>
        </section>

        <form onSubmit={openStudio} className="mx-auto mt-8 max-w-3xl rounded-[28px] border border-white/10 bg-[#101828]/95 p-3 shadow-[0_24px_80px_rgba(4,8,20,0.45)] sm:p-4">
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-400">
            <Link2 className="h-4 w-4 shrink-0" />
            <span className="sr-only">YouTube link</span>
            <input
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="Paste a gameplay or stream link..."
              className="w-full bg-transparent text-zinc-100 outline-none placeholder:text-zinc-500"
              inputMode="url"
              autoComplete="off"
            />
          </label>
          <label className="sr-only" htmlFor="clip-request">
            Clip request
          </label>
          <textarea
            id="clip-request"
            ref={promptRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            placeholder="Tell ClipForge which moments to cut..."
            className="mt-3 w-full resize-none bg-transparent px-3 py-2 text-base leading-7 text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <div className="mt-2 flex flex-col gap-3 border-t border-white/10 px-1 pt-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  {uploaded ? uploaded.originalFilename : "Upload source"}
                  <input
                    className="sr-only"
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadFile(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                <span className="sr-only">Output format</span>
                {outputs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={output === item.id}
                    onClick={() => setOutput(item.id)}
                    className={`rounded-full px-3 py-2 text-sm transition-colors ${
                      output === item.id ? "bg-white text-[#0b1020]" : "border border-white/10 text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Caption preference">
                <button
                  type="button"
                  aria-pressed={captions}
                  onClick={() => setCaptions(true)}
                  className={`rounded-full px-3 py-1.5 text-sm ${captions ? "bg-indigo-500/20 text-indigo-100" : "text-zinc-400 hover:bg-white/5"}`}
                >
                  Captions on
                </button>
                <button
                  type="button"
                  aria-pressed={!captions}
                  onClick={() => setCaptions(false)}
                  className={`rounded-full px-3 py-1.5 text-sm ${!captions ? "bg-indigo-500/20 text-indigo-100" : "text-zinc-400 hover:bg-white/5"}`}
                >
                  Captions off
                </button>
                <p className="text-xs text-zinc-500">This choice is sent with the request. 9:16.</p>
              </div>
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#5b6cff] to-[#7c4dff] px-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(91,108,255,0.35)] transition hover:brightness-110 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              Generate My Shorts
            </button>
          </div>
          {uploadError ? (
            <p className="mt-3 px-2 text-sm text-rose-300" role="alert">
              {uploadError}{" "}
              {uploadError.includes("Sign in") ? (
                <Link href="/studio" className="underline">
                  Sign in
                </Link>
              ) : null}
            </p>
          ) : null}
          {formError ? (
            <p className="mt-3 px-2 text-sm text-rose-300" role="alert">
              {formError}
            </p>
          ) : null}
        </form>

        <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => useExample(example)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
            >
              {example}
            </button>
          ))}
        </div>

        <ClipResults
          onRevise={(title) => {
            setPrompt(`Revise ${title}. Keep the ${outputLabel} framing.`);
            promptRef.current?.focus();
            promptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      </main>
    </div>
  );
}
