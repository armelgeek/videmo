import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILT_IN_FORMATS } from "@/lib/storyboard/formats";
import { BUILT_IN_VISUAL_STYLES } from "@/lib/storyboard/visual-styles/built-in";
import type { ProjectParams } from "@/lib/storyboard/schema";

const listVideoFormats = vi.fn();
const listVisualStyles = vi.fn();
vi.mock("@/actions/video-formats/list-video-formats", () => ({ listVideoFormats }));
vi.mock("@/actions/visual-styles/list-visual-styles", () => ({ listVisualStyles }));

const { PromptWizard } = await import("./prompt-wizard");

const params: ProjectParams = {
  visualStyle: "doodle",
  format: "explainer",
  aspectRatio: "16:9",
  language: "en",
  duration: "3-5 minutes",
  targetAudience: "general",
  tone: "professional",
};

function mount(over: { brief?: string; onParamsChange?: (p: ProjectParams) => void } = {}) {
  listVideoFormats.mockResolvedValue({ success: true, data: [...BUILT_IN_FORMATS] });
  listVisualStyles.mockResolvedValue({ success: true, data: [...BUILT_IN_VISUAL_STYLES] });
  return render(
    createElement(PromptWizard, {
      brief: over.brief ?? "",
      onBriefChange: vi.fn(),
      params,
      onParamsChange: over.onParamsChange ?? vi.fn(),
      voice: "nova",
      onVoiceChange: vi.fn(),
      onPreviewVoice: vi.fn(),
      previewingVoice: null,
      onGenerate: vi.fn(),
    }),
  );
}

const next = () => fireEvent.click(screen.getByRole("button", { name: /^Next/ }));

afterEach(cleanup);

describe("PromptWizard", () => {
  it("asks the kind of video first", () => {
    mount();
    expect(screen.getByText(/question 1 of 4/i)).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Video type" })).toBeTruthy();
  });

  it("offers every format the database returns", async () => {
    mount();
    await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(BUILT_IN_FORMATS.length));
  });

  it("lets you leave the type step before there is a brief", () => {
    // The brief did not exist yet when the type is picked: gating this step on
    // it would make the first question a dead end.
    mount();
    expect((screen.getByRole("button", { name: /^Next/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("holds the brief step until something is written", () => {
    mount();
    next();
    expect(screen.getByText(/question 2 of 4/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^Next/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("no longer asks for the video type inside the brief step", () => {
    mount();
    next();
    expect(screen.queryByRole("radiogroup", { name: "Video type" })).toBeNull();
  });

  it("stores the chosen type", async () => {
    const onParamsChange = vi.fn();
    mount({ onParamsChange });

    await waitFor(() => expect(screen.getByRole("radio", { name: /Tutorial/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("radio", { name: /Tutorial/ }));

    expect(onParamsChange).toHaveBeenCalledWith(expect.objectContaining({ format: "tutorial" }));
  });

  it("shows the drawing styles on the third question, and stores the pick", async () => {
    const onParamsChange = vi.fn();
    mount({ brief: "A video about coffee", onParamsChange });

    next();
    next();

    expect(screen.getByText(/question 3 of 4/i)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getAllByRole("radio")).toHaveLength(BUILT_IN_VISUAL_STYLES.length),
    );
    fireEvent.click(screen.getByRole("radio", { name: /Marker/ }));

    expect(onParamsChange).toHaveBeenCalledWith(expect.objectContaining({ visualStyle: "marker" }));
  });

  it("does not talk about the pen: the visual step is about the drawing", () => {
    mount({ brief: "A video about coffee" });
    next();
    next();
    expect(screen.queryByText(/hand/i)).toBeNull();
    expect(screen.queryByText(/animation/i)).toBeNull();
  });
});
