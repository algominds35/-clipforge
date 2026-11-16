export const creatorModes = ["streamer", "clipper"] as const;
export type CreatorMode = (typeof creatorModes)[number];

export const sourceStatuses = [
  "youtube_metadata_only",
  "video_analysis_available",
  "source_media_available",
  "editing_in_progress",
  "finished_exports_available",
] as const;
export type SourceStatus = (typeof sourceStatuses)[number];

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface UserRecord {
  id: string;
  displayName: string;
  mode: CreatorMode;
  createdAt: string;
}

export interface VideoRecord {
  id: string;
  userId: string;
  originalFilename: string;
  storageKey: string;
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string | null;
  sizeBytes: number;
  createdAt: string;
}

export interface TimelineClip {
  id: string;
  videoId: string;
  startSeconds: number;
  endSeconds: number;
  label: string;
}

export const highlightCategories = [
  "funny_crash",
  "police_chase",
  "gameplay_fail",
  "streamer_reaction",
  "npc_behavior",
  "intense_action",
  "surprising_moment",
  "entertaining_conversation",
  "other",
] as const;
export type HighlightCategory = (typeof highlightCategories)[number];

export interface HighlightCandidate {
  startSeconds: number;
  endSeconds: number;
  title: string;
  description: string;
  category: HighlightCategory;
  confidence: number;
  treatment: string;
}

export interface YoutubeReference {
  videoId: string;
  url: string;
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
}

export interface VideoAnalysis {
  provider: "gemini";
  model: string;
  highlights: HighlightCandidate[];
  analyzedAt: string;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  title: string;
  mode: CreatorMode;
  sourceStatus: SourceStatus;
  timeline: TimelineClip[];
  revision: number;
  youtube: YoutubeReference | null;
  analysis: VideoAnalysis | null;
  sourceVideoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CutPayload {
  startSeconds: number;
  endSeconds: number;
}

export interface JobRecord {
  id: string;
  userId: string;
  projectId: string;
  videoId: string;
  type: "cut";
  status: JobStatus;
  progress: number;
  payload: CutPayload;
  error: string | null;
  idempotencyKey: string | null;
  renderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RenderRecord {
  id: string;
  userId: string;
  projectId: string;
  jobId: string;
  storageKey: string;
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string | null;
  sizeBytes: number;
  createdAt: string;
}

export interface UsageEvent {
  id: string;
  userId: string;
  jobId: string | null;
  kind: "video_seconds_rendered" | "gemini_video_analysis";
  quantity: number;
  /** Null until worker, storage, and provider costs have been measured. */
  estimatedCostUsd: number | null;
  createdAt: string;
}

export interface DatabaseShape {
  users: UserRecord[];
  videos: VideoRecord[];
  projects: ProjectRecord[];
  jobs: JobRecord[];
  renders: RenderRecord[];
  usage: UsageEvent[];
}
