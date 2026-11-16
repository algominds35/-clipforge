import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { geminiConfigured, geminiVideoModel } from "@/lib/config";
import { highlightCategories, type HighlightCandidate, type VideoAnalysis } from "@/lib/db/types";

const responseSchema = {
  type: "object",
  properties: {
    highlights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          startSeconds: { type: "number", description: "Inclusive start time in seconds." },
          endSeconds: { type: "number", description: "Exclusive end time in seconds." },
          title: { type: "string" },
          description: { type: "string" },
          category: { type: "string", enum: [...highlightCategories] },
          confidence: { type: "number", description: "0 to 1 estimate of how useful this moment is." },
          treatment: { type: "string", description: "Suggested edit, such as caption style or reaction zoom." },
        },
        required: ["startSeconds", "endSeconds", "title", "description", "category", "confidence", "treatment"],
      },
    },
  },
  required: ["highlights"],
} as const;

const parsedSchema = z.object({
  highlights: z
    .array(
      z.object({
        startSeconds: z.number().finite().min(0),
        endSeconds: z.number().finite(),
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().min(1).max(600),
        category: z.enum(highlightCategories),
        confidence: z.number().finite().min(0).max(1),
        treatment: z.string().trim().min(1).max(240),
      }),
    )
    .max(12),
});

export interface GeminiInteractionClient {
  interactions: {
    create(request: {
      model: string;
      input: Array<{ type: "text"; text: string } | { type: "video"; uri: string }>;
      response_format: { type: "text"; mime_type: "application/json"; schema: typeof responseSchema };
      store: false;
    }): Promise<{ output_text?: string }>;
  };
}

function keepHighlight(item: HighlightCandidate, durationSeconds: number | null): boolean {
  const length = item.endSeconds - item.startSeconds;
  if (!(length >= 2 && length <= 180)) return false;
  if (durationSeconds !== null && item.endSeconds > durationSeconds + 0.5) return false;
  return true;
}

export async function analyzeYoutubeVideo(input: {
  url: string;
  durationSeconds: number | null;
  client?: GeminiInteractionClient;
}): Promise<VideoAnalysis> {
  if (!input.client && !geminiConfigured()) {
    throw new Error("Set GEMINI_API_KEY before asking ClipForge to watch a YouTube video.");
  }
  const model = geminiVideoModel();
  const client =
    input.client ??
    new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const interaction = await client.interactions.create({
    model,
    store: false,
    input: [
      {
        type: "text",
        text: [
          "Watch this public YouTube video and propose up to eight highlight clips.",
          "Prefer GTA moments: funny crashes, police chases, gameplay fails, streamer reactions, funny NPC behavior, intense action, surprises, and entertaining conversation.",
          "Each clip must include the buildup and the payoff, not a single frame.",
          "Use timestamps from the video you actually watched. If you cannot see or hear the video, return an empty highlights array.",
        ].join(" "),
      },
      { type: "video", uri: input.url },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: responseSchema,
    },
  });
  if (!interaction.output_text) throw new Error("Gemini returned no highlight text");
  const parsed = parsedSchema.parse(JSON.parse(interaction.output_text));
  const highlights = parsed.highlights.filter((item) => keepHighlight(item, input.durationSeconds));
  if (highlights.length === 0) {
    throw new Error("Gemini did not return highlight timestamps that fit this video");
  }
  return {
    provider: "gemini",
    model,
    highlights,
    analyzedAt: new Date().toISOString(),
  };
}
