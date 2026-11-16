import type { YoutubeReference } from "@/lib/db/types";
import type { NormalizedYoutube } from "@/lib/youtube/url";

interface OEmbedPayload {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

interface DataApiPayload {
  items?: Array<{
    snippet?: { title?: string; channelTitle?: string; thumbnails?: { high?: { url?: string } } };
    contentDetails?: { duration?: string };
  }>;
}

export function parseIsoDuration(value: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

export async function fetchYoutubeMetadata(
  video: NormalizedYoutube,
  fetchImpl: typeof fetch = fetch,
): Promise<YoutubeReference> {
  const reference: YoutubeReference = {
    videoId: video.videoId,
    url: video.url,
    title: null,
    author: null,
    thumbnailUrl: null,
    durationSeconds: null,
  };

  const oembed = new URL("https://www.youtube.com/oembed");
  oembed.searchParams.set("url", video.url);
  oembed.searchParams.set("format", "json");
  const preview = await fetchImpl(oembed, { signal: AbortSignal.timeout(15_000) });
  if (preview.ok) {
    const body = (await preview.json()) as OEmbedPayload;
    reference.title = body.title ?? null;
    reference.author = body.author_name ?? null;
    reference.thumbnailUrl = body.thumbnail_url ?? null;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    const dataApi = new URL("https://www.googleapis.com/youtube/v3/videos");
    dataApi.searchParams.set("part", "snippet,contentDetails");
    dataApi.searchParams.set("id", video.videoId);
    dataApi.searchParams.set("key", apiKey);
    const details = await fetchImpl(dataApi, { signal: AbortSignal.timeout(15_000) });
    if (details.ok) {
      const body = (await details.json()) as DataApiPayload;
      const item = body.items?.[0];
      reference.title = item?.snippet?.title ?? reference.title;
      reference.author = item?.snippet?.channelTitle ?? reference.author;
      reference.thumbnailUrl = item?.snippet?.thumbnails?.high?.url ?? reference.thumbnailUrl;
      const duration = item?.contentDetails?.duration ? parseIsoDuration(item.contentDetails.duration) : null;
      reference.durationSeconds = duration;
    }
  }

  return reference;
}
