const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export interface NormalizedYoutube {
  videoId: string;
  url: string;
}

function videoIdFrom(value: string | null): string | null {
  if (!value || !VIDEO_ID.test(value)) return null;
  return value;
}

export function normalizeYoutubeUrl(input: string): NormalizedYoutube {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error("Paste a full YouTube link, including https://");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("YouTube links must start with http or https");
  }
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  let videoId: string | null = null;
  if (host === "youtu.be") {
    videoId = videoIdFrom(parsed.pathname.split("/").filter(Boolean)[0] ?? null);
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (parsed.pathname === "/watch") videoId = videoIdFrom(parsed.searchParams.get("v"));
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (!videoId && (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live")) {
      videoId = videoIdFrom(parts[1] ?? null);
    }
  }
  if (!videoId) throw new Error("That link is not a public YouTube video URL");
  return { videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
}
