import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[11px] font-medium tracking-[0.22em] text-indigo-200/80">BILLING</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Pricing</h1>
      <p className="mt-4 text-base leading-7 text-zinc-300">
        Billing is not open. This page has no checkout, and ClipForge does not publish plan limits yet.
      </p>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        You can still sign in, upload a source file, and render a timestamp cut in the studio.
      </p>
      <Link
        href="/studio"
        className="mt-8 inline-flex h-11 items-center rounded-full bg-gradient-to-r from-[#5b6cff] to-[#7c4dff] px-5 text-sm font-semibold text-white"
      >
        Open the studio
      </Link>
    </main>
  );
}
