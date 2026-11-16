import { geminiConfigured } from "@/lib/config";
import { getStore } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/http/current-user";
import { rateLimit } from "@/lib/http/rate-limit";
import { youtubeSchema } from "@/lib/validation/schemas";
import { fetchYoutubeMetadata } from "@/lib/youtube/metadata";
import { normalizeYoutubeUrl } from "@/lib/youtube/url";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return jsonError("Sign in required", 401);
  if (!rateLimit(`youtube:${user.id}`, 20)) return jsonError("Too many YouTube lookups. Wait a minute.", 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Send a JSON body", 400);
  }
  const parsed = youtubeSchema.safeParse(body);
  if (!parsed.success) return jsonError("Paste a YouTube video link", 400);

  let normalized;
  try {
    normalized = normalizeYoutubeUrl(parsed.data.url);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid YouTube link", 400);
  }

  let youtube;
  try {
    youtube = await fetchYoutubeMetadata(normalized);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not read YouTube metadata", 502);
  }

  const project = await getStore().createYoutubeProject({
    userId: user.id,
    mode: user.mode,
    youtube,
  });
  return Response.json(
    {
      project,
      geminiConfigured: geminiConfigured(),
      sourceRequired:
        "Gemini does not download this video. Upload the original file you have permission to edit before rendering.",
    },
    { status: 201 },
  );
}
