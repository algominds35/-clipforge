import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { LocalStore } from "@/lib/db/local-store";
import { analyzeYoutubeVideo } from "@/lib/gemini/analyze-youtube";
import { parseIsoDuration } from "@/lib/youtube/metadata";
import { assertSourceMedia, SOURCE_REQUIRED_MESSAGE } from "@/lib/youtube/source";
import { normalizeYoutubeUrl } from "@/lib/youtube/url";

const scratch = await mkdtemp(path.join(tmpdir(), "clipforge-youtube-"));
afterAll(async () => {
  await rm(scratch, { recursive: true, force: true });
});

describe("youtube links", () => {
  it("normalizes public watch, short, and youtu.be links", () => {
    const id = "dQw4w9WgXcQ";
    expect(normalizeYoutubeUrl(`https://www.youtube.com/watch?v=${id}`).url).toBe(`https://www.youtube.com/watch?v=${id}`);
    expect(normalizeYoutubeUrl(`https://youtu.be/${id}`).videoId).toBe(id);
    expect(normalizeYoutubeUrl(`https://www.youtube.com/shorts/${id}`).videoId).toBe(id);
    expect(() => normalizeYoutubeUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toThrow(/YouTube/);
  });

  it("parses YouTube duration metadata", () => {
    expect(parseIsoDuration("PT15M3S")).toBe(903);
    expect(parseIsoDuration("PT1H2M")).toBe(3720);
  });

  it("blocks rendering when a YouTube project has no source file", async () => {
    const store = new LocalStore(path.join(scratch, "db.json"));
    const user = await store.createUser({ displayName: "Ada", mode: "clipper" });
    const project = await store.createYoutubeProject({
      userId: user.id,
      mode: user.mode,
      youtube: {
        videoId: "dQw4w9WgXcQ",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Example",
        author: "Example",
        thumbnailUrl: null,
        durationSeconds: null,
      },
    });
    expect(project.sourceStatus).toBe("youtube_metadata_only");
    expect(() => assertSourceMedia(project)).toThrow(SOURCE_REQUIRED_MESSAGE);
    const stranger = await store.createUser({ displayName: "Bea", mode: "streamer" });
    expect(await store.getProject(stranger.id, project.id)).toBeNull();
  });

  it("keeps only Gemini timestamps that fit the known duration", async () => {
    const analysis = await analyzeYoutubeVideo({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      durationSeconds: 30,
      client: {
        interactions: {
          async create() {
            return {
              output_text: JSON.stringify({
                highlights: [
                  {
                    startSeconds: 2,
                    endSeconds: 12,
                    title: "Chase",
                    description: "The chase builds and then the crash pays off.",
                    category: "police_chase",
                    confidence: 0.8,
                    treatment: "Keep the buildup and add captions.",
                  },
                  {
                    startSeconds: 40,
                    endSeconds: 50,
                    title: "Too late",
                    description: "This range is past the known video.",
                    category: "other",
                    confidence: 0.4,
                    treatment: "Ignore.",
                  },
                ],
              }),
            };
          },
        },
      },
    });
    expect(analysis.provider).toBe("gemini");
    expect(analysis.highlights).toHaveLength(1);
    expect(analysis.highlights[0]?.title).toBe("Chase");
  });
});
