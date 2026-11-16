import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfigured } from "@/lib/config";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !supabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  return createBrowserClient(url, key);
}
