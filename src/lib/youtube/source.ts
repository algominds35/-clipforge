import type { ProjectRecord } from "@/lib/db/types";

export const SOURCE_REQUIRED_MESSAGE =
  "This YouTube link does not include a downloadable source file. Gemini can suggest timestamps for a public video, but ClipForge cannot render an MP4 until you upload the original recording you have permission to edit.";

export function assertSourceMedia(project: ProjectRecord): string {
  if (!project.sourceVideoId) throw new Error(SOURCE_REQUIRED_MESSAGE);
  return project.sourceVideoId;
}
