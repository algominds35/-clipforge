"use client";

import { Menu, Play, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { UserRecord } from "@/lib/db/types";

const links = [
  { href: "/projects", label: "Projects" },
  { href: "/clips", label: "My Clips" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [accountReady, setAccountReady] = useState(false);

  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/auth/session");
      if (!response.ok) {
        setUser(null);
        setAccountReady(true);
        return;
      }
      const body = (await response.json()) as { user: UserRecord };
      setUser(body.user);
      setAccountReady(true);
    })();
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#5b6cff] to-[#7c4dff] text-white shadow-sm">
            <Play className="h-3.5 w-3.5 fill-current" />
          </span>
          ClipForge
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                pathname === link.href ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {!accountReady ? (
            <span className="inline-block h-8 w-16" aria-hidden="true" />
          ) : user ? (
            <div className="relative">
              <button
                type="button"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                onClick={() => setAccountOpen((value) => !value)}
                className="max-w-40 truncate rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
              >
                {user.displayName}
              </button>
              {accountOpen ? (
                <div role="menu" className="absolute right-0 mt-2 w-52 rounded-2xl border border-white/10 bg-[#12182b] p-2 text-sm shadow-2xl">
                  <p className="px-3 py-2 text-zinc-400 capitalize">{user.mode}</p>
                  <Link role="menuitem" href="/studio" className="block rounded-xl px-3 py-2 text-white hover:bg-white/5">
                    Open studio
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <Link href="/studio" className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[#0b1020] hover:bg-zinc-200">
              Sign in
            </Link>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-white/10 px-4 py-3 md:hidden" aria-label="Mobile">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="block rounded-xl px-3 py-3 text-sm text-zinc-100 hover:bg-white/5">
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
