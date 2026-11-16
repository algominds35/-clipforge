"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import type { JobRecord, RenderRecord } from "@/lib/db/types";

interface JobResponse {
  job: JobRecord;
  render: RenderRecord | null;
}

const examples = [
  { title: "Sample Short layout", tone: "from-[#243056] to-[#12182b]" },
  { title: "Sample reaction layout", tone: "from-[#2a2458] to-[#14182c]" },
  { title: "Sample gameplay layout", tone: "from-[#1d3a4d] to-[#12182b]" },
];

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function ClipResults({ onRevise }: { onRevise?: (title: string) => void }) {
  const [items, setItems] = useState<JobResponse[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const session = await fetch("/api/auth/session");
      if (!session.ok) {
        setReady(true);
        return;
      }
      const jobsResponse = await fetch("/api/jobs");
      if (!jobsResponse.ok) {
        setReady(true);
        return;
      }
      const body = (await jobsResponse.json()) as { jobs: JobRecord[] };
      const finished = body.jobs.filter((job) => job.renderId).slice(0, 6);
      const details = await Promise.all(
        finished.map(async (job) => {
          const response = await fetch(`/api/jobs/${job.id}`);
          if (!response.ok) return null;
          return (await response.json()) as JobResponse;
        }),
      );
      setItems(details.filter((item): item is JobResponse => Boolean(item?.render)));
      setReady(true);
    })();
  }, []);

  return (
    <section className="mt-16" aria-labelledby="results-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="results-heading" className="text-2xl font-semibold tracking-tight text-white">
            Finished clips
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
            Playable MP4s from your account show up here after a render finishes.
          </p>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ job, render }) => {
            if (!render) return null;
            const title = `Cut ${job.payload.startSeconds}s–${job.payload.endSeconds}s`;
            return (
              <article key={render.id} className="overflow-hidden rounded-3xl border border-white/10 bg-[#101828]">
                <div className="bg-black">
                  <video
                    className="aspect-[9/16] max-h-[420px] w-full bg-black object-contain"
                    controls
                    playsInline
                    preload="metadata"
                    src={`/api/renders/${render.id}/file`}
                  />
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium text-white">{title}</h3>
                    <p className="text-sm text-zinc-400">{clock(render.durationSeconds)}</p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{job.status}</p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[#0b1020]"
                      href={`/api/renders/${render.id}/file?download=1`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download MP4
                    </a>
                    {onRevise ? (
                      <button
                        type="button"
                        onClick={() => onRevise(title)}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/5"
                      >
                        Revise with AI
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : !ready ? (
        <p className="mt-6 text-sm text-zinc-400">Checking your exports…</p>
      ) : (
        <div className="mt-6">
          <p className="text-sm text-zinc-400">No finished exports yet. These cards are layout examples.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {examples.map((example) => (
              <article key={example.title} className="overflow-hidden rounded-3xl border border-white/10 bg-[#101828]">
                <div className={`flex aspect-[9/16] items-end bg-gradient-to-b p-4 ${example.tone}`}>
                  <span className="rounded-full border border-white/20 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-zinc-200">Example</span>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-medium text-white">{example.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">Layout only. Not a rendered video.</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
