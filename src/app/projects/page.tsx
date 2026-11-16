"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProjectRecord } from "@/lib/db/types";

const statusLabel: Record<ProjectRecord["sourceStatus"], string> = {
  youtube_metadata_only: "YouTube metadata only",
  video_analysis_available: "Highlights ready",
  source_media_available: "Source file ready",
  editing_in_progress: "Editing",
  finished_exports_available: "Export ready",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/projects");
      if (response.status === 401) {
        setSignedOut(true);
        setProjects([]);
        return;
      }
      if (!response.ok) {
        setProjects([]);
        return;
      }
      const body = (await response.json()) as { projects: ProjectRecord[] };
      setProjects(body.projects);
    })();
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Projects</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Each project is a cut or a YouTube preview saved on your account.</p>
      {signedOut ? (
        <p className="mt-8 text-sm text-zinc-300">
          <Link href="/studio" className="text-white underline">
            Sign in
          </Link>{" "}
          to see your projects.
        </p>
      ) : null}
      {projects === null ? <p className="mt-8 text-sm text-zinc-400">Loading projects…</p> : null}
      {projects && projects.length === 0 && !signedOut ? (
        <p className="mt-8 text-sm text-zinc-400">No projects yet. Upload a source file in the studio and render a range.</p>
      ) : null}
      <div className="mt-6 grid gap-3">
        {projects?.map((project) => (
          <article key={project.id} className="rounded-2xl border border-white/10 bg-[#101828] px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-medium text-white">{project.title}</h2>
                <p className="mt-1 text-sm text-zinc-400">{statusLabel[project.sourceStatus]}</p>
              </div>
              <Link
                href={project.sourceVideoId ? `/studio?videoId=${project.sourceVideoId}` : "/studio"}
                className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/5"
              >
                Open in studio
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
