import { z } from "zod";
import { creatorModes } from "@/lib/db/types";

export const sessionSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  mode: z.enum(creatorModes),
});

export const modeSchema = z.object({
  mode: z.enum(creatorModes),
});

export const cutSchema = z.object({
  videoId: z.string().uuid(),
  startSeconds: z.number().finite().min(0),
  endSeconds: z.number().finite().positive(),
});

export const youtubeSchema = z.object({
  url: z.string().trim().min(12).max(500),
});

export const sourceLinkSchema = z.object({
  videoId: z.string().uuid(),
});

export const rangeSchema = z.object({
  startSeconds: z.number().finite().min(0),
  endSeconds: z.number().finite().positive(),
});
