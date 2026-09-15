import { VideoGenerationJob, GenerationProgress, VideoGenerationRequest } from "./types";

// In-memory store for video generation jobs
// In production, use a database
const jobs = new Map<string, VideoGenerationJob>();

export const videoStore = {
  createJob: (request: VideoGenerationRequest, ownerId: string): VideoGenerationJob => {
    const id = `job-${crypto.randomUUID()}`;
    const job: VideoGenerationJob = {
      id,
      ownerId,
      request,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      progress: {
        status: "pending",
      },
    };
    jobs.set(id, job);
    return job;
  },

  getJob: (id: string): VideoGenerationJob | undefined => {
    return jobs.get(id);
  },

  // Another user's job reads as missing, so job ids can't be probed.
  getJobForOwner: (id: string, ownerId: string): VideoGenerationJob | undefined => {
    const job = jobs.get(id);
    return job?.ownerId === ownerId ? job : undefined;
  },

  updateProgress: (id: string, progress: Partial<GenerationProgress>) => {
    const job = jobs.get(id);
    if (job) {
      job.progress = { ...job.progress, ...progress };
      job.updatedAt = new Date();

      // Update status based on progress
      if (progress.status) {
        job.status = progress.status as any;
      }
    }
  },

  listJobs: (): VideoGenerationJob[] => {
    return Array.from(jobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  },

  deleteJob: (id: string) => {
    jobs.delete(id);
  },
};
