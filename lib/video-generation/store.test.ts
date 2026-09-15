import { describe, expect, it } from "vitest";
import { videoStore } from "./store";
import { videoGenerationSchema } from "./types";

const request = videoGenerationSchema.parse({
  content: "A video about photosynthesis",
  format: "explainer",
  style: "whiteboard",
});

describe("videoStore ownership", () => {
  it("returns a job to its owner", () => {
    const job = videoStore.createJob(request, "user-a");
    expect(videoStore.getJobForOwner(job.id, "user-a")?.id).toBe(job.id);
  });

  it("hides a job from another user", () => {
    const job = videoStore.createJob(request, "user-a");
    expect(videoStore.getJobForOwner(job.id, "user-b")).toBeUndefined();
  });

  it("treats an unknown id as missing", () => {
    expect(videoStore.getJobForOwner("job-unknown", "user-a")).toBeUndefined();
  });
});
