import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CreatorMode,
  DatabaseShape,
  JobRecord,
  ProjectRecord,
  RenderRecord,
  UsageEvent,
  UserRecord,
  VideoAnalysis,
  VideoRecord,
  YoutubeReference,
} from "@/lib/db/types";

function emptyDb(): DatabaseShape {
  return { users: [], videos: [], projects: [], jobs: [], renders: [], usage: [] };
}

async function withFileLock<T>(lockPath: string, task: () => Promise<T>): Promise<T> {
  const started = Date.now();
  for (;;) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.close();
      try {
        return await task();
      } finally {
        await unlink(lockPath).catch(() => undefined);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      const info = await stat(lockPath).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 30_000) {
        await unlink(lockPath).catch(() => undefined);
        continue;
      }
      if (Date.now() - started > 30_000) {
        throw new Error("Timed out waiting for the database lock");
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}

export class LocalStore {
  constructor(private readonly filePath: string) {}

  private lockPath(): string {
    return `${this.filePath}.lock`;
  }

  private async read(): Promise<DatabaseShape> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const db = JSON.parse(raw) as DatabaseShape;
      for (const project of db.projects) {
        project.youtube ??= null;
        project.analysis ??= null;
        if (project.sourceVideoId === undefined) {
          project.sourceVideoId = project.timeline[0]?.videoId ?? null;
        }
      }
      return db;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyDb();
      throw error;
    }
  }

  private async write(db: DatabaseShape): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(db), "utf8");
    await rename(temp, this.filePath);
  }

  private async mutate<T>(task: (db: DatabaseShape) => T): Promise<T> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    return withFileLock(this.lockPath(), async () => {
      const db = await this.read();
      const result = task(db);
      await this.write(db);
      return result;
    });
  }

  async createUser(input: { displayName: string; mode: CreatorMode }): Promise<UserRecord> {
    const user: UserRecord = {
      id: randomUUID(),
      displayName: input.displayName,
      mode: input.mode,
      createdAt: new Date().toISOString(),
    };
    await this.mutate((db) => {
      db.users.push(user);
    });
    return user;
  }

  async getUser(userId: string): Promise<UserRecord | null> {
    const db = await this.read();
    return db.users.find((user) => user.id === userId) ?? null;
  }

  async updateMode(userId: string, mode: CreatorMode): Promise<UserRecord | null> {
    return this.mutate((db) => {
      const user = db.users.find((item) => item.id === userId);
      if (!user) return null;
      user.mode = mode;
      return { ...user };
    });
  }

  async createVideo(
    userId: string,
    input: Omit<VideoRecord, "id" | "userId" | "createdAt">,
  ): Promise<VideoRecord> {
    const video: VideoRecord = {
      ...input,
      id: randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
    };
    await this.mutate((db) => {
      db.videos.push(video);
    });
    return video;
  }

  async getVideo(userId: string, videoId: string): Promise<VideoRecord | null> {
    const db = await this.read();
    const video = db.videos.find((item) => item.id === videoId);
    if (!video || video.userId !== userId) return null;
    return video;
  }

  async listVideos(userId: string): Promise<VideoRecord[]> {
    const db = await this.read();
    return db.videos.filter((video) => video.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createCutProject(input: {
    userId: string;
    title: string;
    mode: CreatorMode;
    videoId: string;
    startSeconds: number;
    endSeconds: number;
    idempotencyKey: string | null;
  }): Promise<{ project: ProjectRecord; job: JobRecord }> {
    return this.mutate((db) => {
      if (input.idempotencyKey) {
        const existing = db.jobs.find(
          (job) => job.userId === input.userId && job.idempotencyKey === input.idempotencyKey,
        );
        if (existing) {
          const project = db.projects.find((item) => item.id === existing.projectId);
          if (!project) throw new Error("Existing job is missing its project");
          return { project, job: existing };
        }
      }

      const now = new Date().toISOString();
      const project: ProjectRecord = {
        id: randomUUID(),
        userId: input.userId,
        title: input.title,
        mode: input.mode,
        sourceStatus: "editing_in_progress",
        timeline: [
          {
            id: randomUUID(),
            videoId: input.videoId,
            startSeconds: input.startSeconds,
            endSeconds: input.endSeconds,
            label: "Cut",
          },
        ],
        revision: 1,
        youtube: null,
        analysis: null,
        sourceVideoId: input.videoId,
        createdAt: now,
        updatedAt: now,
      };
      const job: JobRecord = {
        id: randomUUID(),
        userId: input.userId,
        projectId: project.id,
        videoId: input.videoId,
        type: "cut",
        status: "queued",
        progress: 0,
        payload: { startSeconds: input.startSeconds, endSeconds: input.endSeconds },
        error: null,
        idempotencyKey: input.idempotencyKey,
        renderId: null,
        createdAt: now,
        updatedAt: now,
      };
      db.projects.push(project);
      db.jobs.push(job);
      return { project, job };
    });
  }

  async claimJob(jobId: string): Promise<JobRecord | null> {
    return this.mutate((db) => {
      const job = db.jobs.find((item) => item.id === jobId);
      if (!job || job.status !== "queued") return null;
      job.status = "running";
      job.progress = 10;
      job.updatedAt = new Date().toISOString();
      return { ...job, payload: { ...job.payload } };
    });
  }

  async listQueuedJobIds(): Promise<string[]> {
    const db = await this.read();
    return db.jobs.filter((job) => job.status === "queued").map((job) => job.id);
  }

  async getJob(userId: string, jobId: string): Promise<JobRecord | null> {
    const db = await this.read();
    const job = db.jobs.find((item) => item.id === jobId);
    if (!job || job.userId !== userId) return null;
    return job;
  }

  async readJob(jobId: string): Promise<JobRecord | null> {
    const db = await this.read();
    return db.jobs.find((item) => item.id === jobId) ?? null;
  }

  async markJobProgress(jobId: string, progress: number): Promise<void> {
    await this.mutate((db) => {
      const job = db.jobs.find((item) => item.id === jobId);
      if (!job) return;
      job.progress = progress;
      job.updatedAt = new Date().toISOString();
    });
  }

  async completeJob(input: {
    jobId: string;
    render: Omit<RenderRecord, "id" | "createdAt">;
    usage: Omit<UsageEvent, "id" | "createdAt">;
  }): Promise<RenderRecord> {
    const render: RenderRecord = {
      ...input.render,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await this.mutate((db) => {
      const job = db.jobs.find((item) => item.id === input.jobId);
      const project = db.projects.find((item) => item.id === input.render.projectId);
      if (!job || !project) throw new Error("Job or project disappeared before completion");
      job.status = "succeeded";
      job.progress = 100;
      job.renderId = render.id;
      job.error = null;
      job.updatedAt = render.createdAt;
      project.sourceStatus = "finished_exports_available";
      project.updatedAt = render.createdAt;
      db.renders.push(render);
      db.usage.push({ ...input.usage, id: randomUUID(), createdAt: render.createdAt });
    });
    return render;
  }

  async failJob(jobId: string, error: string): Promise<void> {
    await this.mutate((db) => {
      const job = db.jobs.find((item) => item.id === jobId);
      if (!job) return;
      job.status = "failed";
      job.error = error;
      job.updatedAt = new Date().toISOString();
      const project = db.projects.find((item) => item.id === job.projectId);
      if (project && project.sourceStatus === "editing_in_progress") {
        project.sourceStatus = "source_media_available";
        project.updatedAt = job.updatedAt;
      }
    });
  }

  async getRender(userId: string, renderId: string): Promise<RenderRecord | null> {
    const db = await this.read();
    const render = db.renders.find((item) => item.id === renderId);
    if (!render || render.userId !== userId) return null;
    return render;
  }

  async listUsage(userId: string): Promise<UsageEvent[]> {
    const db = await this.read();
    return db.usage.filter((event) => event.userId === userId);
  }

  async listJobs(userId: string): Promise<JobRecord[]> {
    const db = await this.read();
    return db.jobs.filter((job) => job.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getProject(userId: string, projectId: string): Promise<ProjectRecord | null> {
    const db = await this.read();
    const project = db.projects.find((item) => item.id === projectId);
    if (!project || project.userId !== userId) return null;
    return project;
  }

  async listProjects(userId: string): Promise<ProjectRecord[]> {
    const db = await this.read();
    return db.projects
      .filter((project) => project.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createYoutubeProject(input: {
    userId: string;
    mode: CreatorMode;
    youtube: YoutubeReference;
  }): Promise<ProjectRecord> {
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: randomUUID(),
      userId: input.userId,
      title: input.youtube.title ?? `YouTube ${input.youtube.videoId}`,
      mode: input.mode,
      sourceStatus: "youtube_metadata_only",
      timeline: [],
      revision: 1,
      youtube: input.youtube,
      analysis: null,
      sourceVideoId: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.mutate((db) => {
      db.projects.push(project);
    });
    return project;
  }

  async saveAnalysis(userId: string, projectId: string, analysis: VideoAnalysis): Promise<ProjectRecord | null> {
    return this.mutate((db) => {
      const project = db.projects.find((item) => item.id === projectId && item.userId === userId);
      if (!project) return null;
      project.analysis = analysis;
      if (!project.sourceVideoId) project.sourceStatus = "video_analysis_available";
      project.updatedAt = analysis.analyzedAt;
      db.usage.push({
        id: randomUUID(),
        userId,
        jobId: null,
        kind: "gemini_video_analysis",
        quantity: 1,
        estimatedCostUsd: null,
        createdAt: analysis.analyzedAt,
      });
      return { ...project, analysis: { ...analysis, highlights: analysis.highlights.map((item) => ({ ...item })) } };
    });
  }

  async queueCut(input: {
    userId: string;
    projectId: string;
    startSeconds: number;
    endSeconds: number;
    idempotencyKey: string | null;
  }): Promise<{ project: ProjectRecord; job: JobRecord } | null> {
    return this.mutate((db) => {
      const project = db.projects.find((item) => item.id === input.projectId && item.userId === input.userId);
      if (!project?.sourceVideoId) return null;
      if (input.idempotencyKey) {
        const existing = db.jobs.find(
          (job) => job.userId === input.userId && job.idempotencyKey === input.idempotencyKey,
        );
        if (existing) return { project, job: existing };
      }
      const now = new Date().toISOString();
      project.timeline = [
        ...project.timeline,
        {
          id: randomUUID(),
          videoId: project.sourceVideoId,
          startSeconds: input.startSeconds,
          endSeconds: input.endSeconds,
          label: "Cut",
        },
      ];
      project.revision += 1;
      project.sourceStatus = "editing_in_progress";
      project.updatedAt = now;
      const job: JobRecord = {
        id: randomUUID(),
        userId: input.userId,
        projectId: project.id,
        videoId: project.sourceVideoId,
        type: "cut",
        status: "queued",
        progress: 0,
        payload: { startSeconds: input.startSeconds, endSeconds: input.endSeconds },
        error: null,
        idempotencyKey: input.idempotencyKey,
        renderId: null,
        createdAt: now,
        updatedAt: now,
      };
      db.jobs.push(job);
      return { project: { ...project, timeline: project.timeline.map((clip) => ({ ...clip })) }, job };
    });
  }

  async attachSource(userId: string, projectId: string, videoId: string): Promise<ProjectRecord | null> {
    return this.mutate((db) => {
      const project = db.projects.find((item) => item.id === projectId && item.userId === userId);
      const video = db.videos.find((item) => item.id === videoId && item.userId === userId);
      if (!project || !video) return null;
      project.sourceVideoId = video.id;
      project.sourceStatus = "source_media_available";
      project.updatedAt = new Date().toISOString();
      return { ...project };
    });
  }
}
