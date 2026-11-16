import { Suspense } from "react";
import { StudioApp } from "@/components/studio/studio-app";

export default function StudioPage() {
  return (
    <Suspense fallback={<p className="p-8 text-zinc-400">Loading studio…</p>}>
      <StudioApp />
    </Suspense>
  );
}
