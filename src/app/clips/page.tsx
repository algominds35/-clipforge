"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipResults } from "@/components/home/clip-results";
import type { VideoRecord } from "@/lib/db/types";

export default function ClipsPage() {
  const [videos, setVideos] = useState<VideoRecord[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/videos");
      if (response.status === 401) {
        setSignedOut(true);
        setVideos([]);
        return;
      }
      if (!response.ok) {
        setVideos([]);
        return;
      }
      const body = (await response.json()) as { videos: VideoRecord[] };
      setVideos(body.videos);
    })();
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-white">My Clips</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Source uploads and finished MP4s from your account.</p>
      {signedOut ? (
        <p className="mt-8 text-sm text-zinc-300">
          <Link href="/studio" className="text-white underline">
            Sign in
          </Link>{" "}
          to see your clips.
        </p>
      ) : null}
      <section className="mt-8" aria-labelledby="uploads-heading">
        <h2 id="uploads-heading" className="text-lg font-medium text-white">
          Uploads
        </h2>
        {videos === null ? <p className="mt-3 text-sm text-zinc-400">Loading uploads…</p> : null}
        {videos && videos.length === 0 && !signedOut ? <p className="mt-3 text-sm text-zinc-400">No source files yet.</p> : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {videos?.map((video) => (
            <article key={video.id} className="rounded-2xl border border-white/10 bg-[#101828] p-4">
              <h3 className="truncate font-medium text-white">{video.originalFilename}</h3>
              <p className="mt-1 text-sm text-zinc-400">
                {video.durationSeconds.toFixed(1)}s · {video.width}×{video.height}
              </p>
              <Link href={`/studio?videoId=${video.id}`} className="mt-3 inline-flex text-sm text-indigo-200 hover:text-white">
                Open in studio
              </Link>
            </article>
          ))}
        </div>
      </section>
      <ClipResults />
    </main>
  );
}
