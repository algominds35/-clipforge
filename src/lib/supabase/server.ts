import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfigured } from "@/lib/config";

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !supabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
          void headers;
        } catch {
          // Server Components cannot always write cookies. src/proxy.ts refreshes the session.
        }
      },
    },
  });
}
