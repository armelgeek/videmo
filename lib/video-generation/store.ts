import { VideoGenerationJob, GenerationProgress, VideoGenerationRequest } from "./types";

// In-memory store for video generation jobs
// In production, use a database
const jobs = new Map<string, VideoGenerationJob>();

export const videoStore = {
  createJob: (request: VideoGenerationRequest): VideoGenerationJob => {
    const id = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job: VideoGenerationJob = {
      id,
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
