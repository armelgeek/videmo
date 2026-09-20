"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import { WhiteboardExportDialog } from "@/lib/whiteboard-animation/components/whiteboard-export-dialog";
import { SketchHint } from "@/components/molecules/sketch-hint";
import { Hint } from "@/components/molecules/hint";
import {
  RENDER_CHANGED_EVENT,
  parseStoredRender,
} from "@/components/organisms/export/global-export-indicator";
import { toRenderProject } from "@/lib/whiteboard-animation/server/to-render-project";
import { ShortcutsModal } from "@/lib/editor/components/shortcuts-modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Save,
  Trash2,
  X,
  AlertTriangle,
  Info,
  Check,
  Wand2,
  Layers,
  Settings,
  Film,
  Loader2,
  RefreshCw,
  Download,
  Copy,
  Plus,
  Pencil,
  ImageIcon,
  ChevronDown,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";
import { HandArrow } from "@/components/organisms/landing/sketch/hand-arrow";
import { PromptWizard } from "@/components/organisms/storyboard/prompt-wizard";
import { appConfig } from "@/lib/config";
import { ArrowDown, ArrowLeft, ArrowUp, Keyboard, Lock, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useProjectSync } from "@/lib/storyboard/use-project-sync";
import { SignOutMenuItem } from "@/lib/app-shell/sign-out-menu-item";
import { notifyCreditsChanged } from "@/lib/billing/billing-notice";
import { showBillingNotice } from "@/lib/billing/show-billing-notice";
import { VOICES, normalizeVoice } from "@/lib/speech/speech-generator";
import {
  type ScriptBeat,
  type ScriptScene,
  sceneDuration,
  sceneNarration,
} from "@/lib/storyboard/script-generation";
import { useToastContext } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { AppShell } from "@/lib/app-shell";
import { DevPanel } from "@/lib/dev-panel";
import { useRouter } from "next/navigation";
import {
  useStoryboardStore,
  normalizeWorkflowStep,
} from "@/lib/storyboard/store";
import { panelsToStepState } from "@/lib/storyboard/storyboard-clips";
import { narrationJobs } from "@/lib/storyboard/narration-jobs";
import {
  adoptPlannedAnnotations,
  transcriptFromPanels,
} from "@/lib/storyboard/annotation-adoption";
import { measureImageSize } from "@/lib/storyboard/image-size";
import { measureSubjectCandidates } from "@/lib/storyboard/image-subjects";
import { narrationParts } from "@/lib/speech/narration-track";
import { scheduleParts } from "@/lib/whiteboard-animation/audio/narration-schedule";
import { canvasSize } from "@/lib/whiteboard-animation/canvas-size";
import { WhiteboardEditorStep } from "@/lib/whiteboard-animation/components/whiteboard-editor-step";
import { AudioPanel } from "@/lib/whiteboard-animation/components/audio-panel";

const STEPS = [
  { key: "prompt", label: "Prompt", icon: Wand2 },
  { key: "storyboard", label: "Storyboard", icon: Layers },
  { key: "whiteboard", label: "Whiteboard", icon: Settings },
] as const;

/**
 * The voices actually available, in catalogue order.
 *
 * The screen used to show 18 made-up personas sorted by language (Ron,
 * Pierre, Takeshi...): the choice was made on a fiction, and two personas
 * could produce the same sound. These voices are multilingual (the same one
 * reads French and English), so sorting by language makes no sense, and no
 * timbre description is given: the audio preview is the only honest source.
 */
const VOICE_INITIALS: Record<string, string> = {
  alloy: "A",
  ash: "As",
  ballad: "B",
  coral: "C",
  echo: "E",
  fable: "F",
  nova: "N",
  onyx: "O",
  sage: "S",
  shimmer: "Sh",
  verse: "V",
};

/** The language the voice will read the script in, as we name it. */
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  fr: "French",
};

/**
 * What the preview says when the script is still empty.
 *
 * It was hardcoded in French: on an English project, a voice was judged on
 * a sentence that was not in the language it will read.
 */
const PREVIEW_FALLBACK: Record<string, string> = {
  en: "Hi! This is how I'll narrate your video.",
  fr: "Bonjour ! Voici comment je vais raconter votre vidéo.",
  es: "¡Hola! Así es como narraré tu vídeo.",
  de: "Hallo! So werde ich dein Video erzählen.",
  it: "Ciao! Ecco come racconterò il tuo video.",
  pt: "Olá! É assim que vou narrar o seu vídeo.",
  zh: "你好！我会这样为你的视频配音。",
  ja: "こんにちは！この声であなたの動画をナレーションします。",
};

/**
 * The share of the progress bar that goes to synthesis. The rest goes to
 * annotation placement, which follows within the same wait: two bars
 * restarting from zero felt like a stuck step.
 */
const NARRATION_SHARE = 70;

export default function StoryboardPage() {
  const { toast } = useToastContext();
  const router = useRouter();

  // Zustand Workflow Store
  const {
    step,
    setStep,
    projectTitle,
    promptContent,
    setPromptContent,
    projectParams,
    setProjectParams,
    scriptTitle,
    setScriptTitle,
    scriptText,
    setScriptText,
    storyboardPanels,
    setStoryboardPanels,
    updatePanel,
    selectedVoice,
    setSelectedVoice,
    whiteboardConfig,
    setWhiteboardConfig,
    setTranscript,
    setAudioTrack,
    setNarrationParts,
    setNarrationTranscription,
    loadDemoData,
    resetWorkflow,
  } = useStoryboardStore();

  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState<
    "idle" | "init" | "audio" | "video" | "encoding" | "complete"
  >("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const renderJobIdRef = useRef<string | null>(null);
  const [editableClips, setEditableClips] = useState<any[]>([]);

  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [generatingClipIndex, setGeneratingClipIndex] = useState<number | null>(null);
  const [generatingProgress, setGeneratingProgress] = useState({
    current: 0,
    total: 0,
  });
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [isGeneratingNarration, setIsGeneratingNarration] = useState(false);
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  // The field being edited, for the selected scene: `${index}:field`.
  const [editingField, setEditingField] = useState<string | null>(null);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [isPlanningAnnotations, setIsPlanningAnnotations] = useState(false);
  const [narrationProgress, setNarrationProgress] = useState(0);

  // The project lives in the database: useProjectSync loads (or creates) it,
  // holds the editing lease and writes every store change.
  const projectSync = useProjectSync();

  // The render runs on the server; only its id lives here, so a reload can pick it back up.
  const renderStorageKey = projectSync.projectId
    ? `sketchpilot:render:${projectSync.projectId}`
    : null;
  const rememberRender = (jobId: string | null) => {
    if (!renderStorageKey) return;
    try {
      if (jobId) {
        localStorage.setItem(
          renderStorageKey,
          JSON.stringify({ jobId, title: projectTitle || "Untitled project" })
        );
      } else {
        localStorage.removeItem(renderStorageKey);
      }
      window.dispatchEvent(new Event(RENDER_CHANGED_EVENT));
    } catch {}
  };

  const trackRender = async (jobId: string) => {
    renderJobIdRef.current = jobId;
    setIsExporting(true);
    setExportPhase("encoding");
    try {
      // Polling rather than a websocket: a render lasts minutes, one second
      // of latency on a progress bar goes unnoticed.
      for (;;) {
        await new Promise((r) => setTimeout(r, 1000));
        if (renderJobIdRef.current !== jobId) return;
        const r = await fetch(`/api/whiteboard/render/${jobId}`);
        // On a 404 the body is {error}: without this check the loop spun
        // forever, the bar frozen at 0%.
        if (!r.ok) {
          throw new Error(
            r.status === 404
              ? "The render was lost by the server"
              : `Could not track the render (${r.status})`
          );
        }
        const s = await r.json();
        setExportProgress(s.progress ?? 0);
        if (s.status === "done") {
          rememberRender(null);
          setDownloadUrl(`/api/whiteboard/render/${jobId}/file`);
          setExportPhase("complete");
          // The user may have closed the dialog to keep editing.
          setIsExportModalOpen(true);
          toast.success("Your video is ready");
          return;
        }
        if (s.status === "error") {
          throw new Error(s.error || "The render failed");
        }
        if (s.status === "cancelled") {
          rememberRender(null);
          setExportPhase("idle");
          return;
        }
      }
    } catch (err) {
      rememberRender(null);
      toast.error(err instanceof Error ? err.message : "Export failed");
      setExportPhase("idle");
    } finally {
      if (renderJobIdRef.current === jobId) setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!renderStorageKey || renderJobIdRef.current) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(renderStorageKey);
    } catch {}
    const stored = parseStoredRender(saved);
    if (stored) void trackRender(stored.jobId);
    // trackRender only uses setters and refs; re-running on its identity would restart polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderStorageKey]);

  const scriptWordCount = scriptText.trim()
    ? scriptText.trim().split(/\s+/).length
    : 0;

  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // The script is written by the agent from the prompt and parameters. The
  // guard on already-present scenes avoids regenerating (and so paying for
  // another model call) when coming back to this step from the storyboard.
  const generateScript = async (content = promptContent) => {
    if (!content.trim() || isGeneratingScript) return;
    setIsGeneratingScript(true);
    setScriptError(null);
    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, ...projectParams }),
      });
      const body = await response.json();
      if (!response.ok) {
        showBillingNotice(response.status, body);
        setScriptError(body.error ?? `HTTP ${response.status}`);
        return;
      }
      notifyCreditsChanged();
      setScriptTitle(body.title ?? "");
      setScriptText(body.text ?? "");
    } catch (error) {
      setScriptError(error instanceof Error ? error.message : "Network error");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const syncClipsToStore = (clipsToSync: any[], imagesToSync: string[]) => {
    const panels = clipsToSync
      .filter((clip) => !clip.isSection)
      .map((clip, i) => {
        // A missing image stays missing: replacing it with a demo visual
        // saved it to the database as if it had been produced.
        const image = imagesToSync[i] || clip.imageUrl || "";
        const prompt = clip.visualPrompt || clip.summary || clip.title || `Clip ${i + 1}`;
        return {
          id: clip.id || `sb-clip-${i}`,
          title: clip.title || `Clip ${i + 1}`,
          clipType: clip.clipType || "content",
          imageUrl: image,
          prompt,
          narration: clip.summary || clip.narration || "",
          visualPrompt: clip.visualPrompt || clip.summary || prompt,
          duration: typeof clip.duration === "number" ? clip.duration : 5,
          isGenerating: false,
          // The voice, per image and per beat: without these two fields it was
          // produced then lost on the first save.
          audioUrl: clip.audioUrl,
          audioDurationMs: clip.audioDurationMs,
          beats: clip.beats,
          // Annotations live per image: that is what the editor and the render
          // read, whiteboardConfig.annotations being only a fallback shared by
          // all of them.
          annotations: clip.annotations,
        };
      });
    setStoryboardPanels(panels);
    return panels;
  };

  /**
   * Rebuilds the clips and their images from what is saved.
   *
   * No step guard: these are just the project's panels read differently,
   * and the current step has no say in whether we know them. The former
   * `step !== "storyboard"` guard left `generatedImages` empty everywhere
   * else, yet the voice step only renders when it is filled, so a reload on
   * the voice step gave a BLANK page, and going back was blocked too
   * (canNavigateToStep depends on it).
   *
   * Local state must decide nothing here: the old code fell back to
   * DEMO_FINAL_SEQUENCE as soon as a session variable was missing, then wrote
   * those demo panels into the store, and the next keystroke saved them over
   * the real project.
   */
  useEffect(() => {
    if (editableClips.length > 0) return;

    const { clips, images } = panelsToStepState(storyboardPanels);
    if (clips.length === 0) return;

    setEditableClips(clips);
    setGeneratedImages(images);
  }, [storyboardPanels, editableClips.length]);

  const updateClipField = (index: number, updates: Record<string, any>) => {
    const newClips = [...editableClips];
    newClips[index] = { ...newClips[index], ...updates };
    setEditableClips(newClips);
    syncClipsToStore(newClips, generatedImages);
  };

  const duplicateClip = (index: number) => {
    const sourceClip = editableClips[index];
    const sourceImg = generatedImages[index] || "";
    const newClip = {
      ...sourceClip,
      id: `clip-${Date.now()}`,
      title: `${sourceClip.title || "Clip"} (Copy)`,
    };
    const newClips = [...editableClips];
    newClips.splice(index + 1, 0, newClip);

    const newImages = [...generatedImages];
    newImages.splice(index + 1, 0, sourceImg);

    setEditableClips(newClips);
    setGeneratedImages(newImages);
    syncClipsToStore(newClips, newImages);
    toast.success("Clip duplicated");
  };

  const deleteClip = (index: number) => {
    // Irreversible: the generated image, its narration and its annotations
    // disappear, and autosave records the deletion within the minute.
    // Without confirmation, an accidental click cannot be undone.
    if (!confirm("Delete this clip? This cannot be undone.")) return;
    const newClips = editableClips.filter((_, i) => i !== index);
    const newImages = generatedImages.filter((_, i) => i !== index);
    setEditableClips(newClips);
    setGeneratedImages(newImages);
    syncClipsToStore(newClips, newImages);
    toast.info("Clip deleted");
  };

  const addClip = (afterIndex?: number) => {
    const targetIdx = afterIndex !== undefined ? afterIndex + 1 : editableClips.length;
    const newClip = {
      id: `clip-${Date.now()}`,
      index: editableClips.length,
      clipType: "content" as const,
      title: `Clip ${editableClips.length + 1}`,
      summary: "New clip script narration...",
      visualPrompt: "Visual description for clip...",
      duration: 5,
      isSection: false,
    };
    const newClips = [...editableClips];
    newClips.splice(targetIdx, 0, newClip);

    const newImages = [...generatedImages];
    newImages.splice(targetIdx, 0, "");

    setEditableClips(newClips);
    setGeneratedImages(newImages);
    syncClipsToStore(newClips, newImages);
    toast.success("New clip added");
  };

  const addSection = (afterIndex?: number) => {
    const targetIdx = afterIndex !== undefined ? afterIndex + 1 : editableClips.length;
    const newSection = {
      id: `section-${Date.now()}`,
      index: editableClips.length,
      clipType: "section" as const,
      title: "New Section",
      summary: "",
      visualPrompt: "",
      duration: 0,
      isSection: true,
    };
    const newClips = [...editableClips];
    newClips.splice(targetIdx, 0, newSection);

    setEditableClips(newClips);
    syncClipsToStore(newClips, generatedImages);
    toast.success("New section added");
  };

  const moveClip = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= editableClips.length) return;

    const newClips = [...editableClips];
    [newClips[fromIndex], newClips[toIndex]] = [
      newClips[toIndex],
      newClips[fromIndex],
    ];

    const newImages = [...generatedImages];
    if (fromIndex < newImages.length && toIndex < newImages.length) {
      [newImages[fromIndex], newImages[toIndex]] = [
        newImages[toIndex],
        newImages[fromIndex],
      ];
    }

    setEditableClips(newClips);
    setGeneratedImages(newImages);
    syncClipsToStore(newClips, newImages);
  };

  /**
   * Asks the model for a visual and returns its final URL.
   *
   * The project is identified by its id: the route checks write access
   * BEFORE calling the model, and the image goes to the object bucket (a `data:`
   * URL would be rejected on save).
   */
  const requestVisual = async (
    clip: any,
    sceneIndex: number,
    referenceUrl?: string,
  ) => {
    const response = await fetch("/api/generate-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: projectSync.projectId,
        sceneIndex,
        prompt: clip.visualPrompt || clip.summary || clip.title || "",
        aspectRatio: projectParams.aspectRatio,
        language: projectParams.language,
        referenceUrl,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      showBillingNotice(response.status, body);
      const error = new Error(body.error ?? `HTTP ${response.status}`);
      // 503 = moteur ou bac mal configure, 402 = plus de credits : rien ne changera au clip suivant.
      (error as Error & { fatal?: boolean }).fatal =
        response.status === 503 || response.status === 402;
      throw error;
    }
    notifyCreditsChanged();
    return body.url as string;
  };

  /**
   * Produces the missing visuals.
   *
   * `force` redoes the whole series: that is what the « Regenerate All
   * Visuals » button means, and only it. By default an already-produced image is
   * kept: reopening a finished project and going through this step again fired one
   * model call per image, to replace visuals nothing had made obsolete.
   */
  const generateImagesProgressively = async ({ force = false } = {}) => {
    const clips = editableClips.filter((c) => !c.isSection);
    if (clips.length === 0) return;
    if (!projectSync.projectId) {
      toast.error("Project is still loading");
      return;
    }

    // A working copy: visuals already obtained are kept even if a call fails
    // midway, rather than losing the whole batch.
    const newImages = [...generatedImages];
    // The original index travels with the clip: it is the `sceneIndex` under
    // which the route stores the image, and skipping clips misaligns it from the loop rank.
    const todo = clips
      .map((clip, index) => ({ clip, index }))
      .filter(({ index }) => force || !newImages[index]);

    if (todo.length === 0) {
      toast.info("Visuals already generated");
      return;
    }

    setIsGeneratingImages(true);
    setGeneratingProgress({ current: 0, total: todo.length });

    let failed = 0;
    // The first panel produced serves as reference for the next ones: it is the only
    // way to keep stroke thickness and color range consistent across the series.
    // An existing visual serves as that reference when completing a series,
    // otherwise images added later would drift into another style.
    let reference: string | undefined = force
      ? undefined
      : newImages.find((url) => !!url);

    for (let rank = 0; rank < todo.length; rank++) {
      const { clip, index } = todo[rank];
      setGeneratingClipIndex(index);
      try {
        newImages[index] = await requestVisual(clip, index, reference);
        if (!reference) reference = newImages[index];
        setGeneratedImages([...newImages]);
      } catch (error) {
        failed += 1;
        console.error(`Visual ${index + 1} failed:`, error);
        if (failed === 1) {
          toast.error(
            error instanceof Error ? error.message : "Visual generation failed",
          );
        }
        // No point insisting nine times on a missing configuration.
        if ((error as Error & { fatal?: boolean }).fatal) {
          setGeneratingProgress({ current: todo.length, total: todo.length });
          break;
        }
      }
      setGeneratingProgress({ current: rank + 1, total: todo.length });
    }

    setGeneratingClipIndex(null);
    setIsGeneratingImages(false);
    syncClipsToStore(editableClips, newImages);

    const done = todo.length - failed;
    if (done > 0) toast.success(`Generated ${done} visual${done > 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`${failed} visual${failed > 1 ? "s" : ""} failed`);
  };

  const regenerateImageForClip = async (clipIndex: number) => {
    const clip = editableClips[clipIndex];
    if (!clip || !projectSync.projectId) return;

    setIsGeneratingImages(true);
    setGeneratingProgress({ current: clipIndex, total: clipIndex + 1 });
    setGeneratingClipIndex(clipIndex);

    try {
      const newImages = [...generatedImages];
      // Regenerating a single panel: the first of the series stays the reference,
      // otherwise the redone panel would clash with the others.
      const reference = generatedImages.find(
        (url, i) => i !== clipIndex && !!url,
      );
      newImages[clipIndex] = await requestVisual(clip, clipIndex, reference);
      setGeneratedImages(newImages);
      syncClipsToStore(editableClips, newImages);
      toast.success(`Regenerated visual for clip ${clipIndex + 1}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Visual generation failed",
      );
    } finally {
      setGeneratingClipIndex(null);
    setIsGeneratingImages(false);
    }
  };

  // Arriving on the storyboard draws what is missing, once per arrival:
  // an already-produced visual is kept, and a failure does not retry in a loop.
  const autoVisualsRequested = useRef(false);
  useEffect(() => {
    if (step !== "storyboard") {
      autoVisualsRequested.current = false;
      return;
    }
    if (autoVisualsRequested.current || isGeneratingImages) return;
    if (!projectSync.projectId) return;
    const clips = editableClips.filter((c) => !c.isSection);
    if (clips.length === 0 || clips.every((_, idx) => generatedImages[idx])) return;
    autoVisualsRequested.current = true;
    void generateImagesProgressively();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, projectSync.projectId, editableClips.length]);

  // As soon as all visuals are there, the voice records without waiting for
  // the click: annotation planning needs the images, hence the order.
  const autoNarrationRequested = useRef(false);
  useEffect(() => {
    if (step !== "storyboard") {
      autoNarrationRequested.current = false;
      return;
    }
    if (autoNarrationRequested.current) return;
    if (isGeneratingImages || isGeneratingNarration || !projectSync.projectId) return;
    const clips = editableClips.filter((c) => !c.isSection);
    if (clips.length === 0 || !clips.every((_, idx) => generatedImages[idx])) return;
    if (clips.every((c) => c.audioUrl)) return;
    autoNarrationRequested.current = true;
    void handleVoiceSelected(selectedVoice, { advance: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isGeneratingImages, generatedImages, projectSync.projectId]);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  /**
   * Plays the voice that will actually be used.
   *
   * The preview used the browser's speechSynthesis: we heard a system
   * voice unrelated to the one the engine would produce.
   */
  const playVoicePreview = async (voice: string) => {
    if (!projectSync.projectId || previewingVoice) return;

    previewAudioRef.current?.pause();
    setPreviewingVoice(voice);
    try {
      const response = await fetch("/api/generate-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectSync.projectId,
          sceneIndex: 0,
          voice,
          text: PREVIEW_FALLBACK[projectParams.language] ?? PREVIEW_FALLBACK.en,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (showBillingNotice(response.status, body)) {
          setPreviewingVoice(null);
          return;
        }
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      notifyCreditsChanged();

      const audio = new Audio(body.url);
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewingVoice(null);
      await audio.play();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Preview failed",
      );
      setPreviewingVoice(null);
    }
  };


  const handlePromptSubmit = (content: string) => {
    setPromptContent(content);
    void generateScript(content);
  };

  const [isBreakingDown, setIsBreakingDown] = useState(false);

  /**
   * The script that produced the split currently in place.
   *
   * It tells apart the two clicks on « Approve Script »: the one following a
   * rewrite, which must split again, and the one merely passing through an
   * already-done step, which must redo nothing.
   */
  const brokenDownScript = useRef<string | null>(null);

  // A reopened project already carries its split: it was saved with the
  // script that produced it. Without this seed, the first pass through the
  // script step took it for a missing split and restarted everything.
  useEffect(() => {
    if (projectSync.status === "loading") return;
    if (brokenDownScript.current !== null) return;
    if (storyboardPanels.length === 0) return;
    brokenDownScript.current = scriptText;
  }, [projectSync.status, storyboardPanels.length, scriptText]);

  /**
   * Second stage: the approved text is split into scenes.
   *
   * The call is separate from writing because the user may have rewritten the
   * script in between: splitting on the first generation froze
   * scenes that their corrections no longer reached.
   */
  const handleScriptValidated = async () => {
    if (!scriptText.trim() || isBreakingDown) return;

    // The step is already done and the script has not changed: pass through.
    // Splitting again called the model again, then rewrote clips with empty
    // images (`clips.map(() => "")`) over the project, wiping visuals, voice and
    // annotations already produced.
    if (
      brokenDownScript.current === scriptText &&
      (editableClips.length > 0 || storyboardPanels.length > 0)
    ) {
      setStep("storyboard");
      return;
    }

    setIsBreakingDown(true);
    setScriptError(null);
    try {
      const response = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: scriptText,
          content: promptContent,
          ...projectParams,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        showBillingNotice(response.status, body);
        setScriptError(body.error ?? `HTTP ${response.status}`);
        return;
      }
      notifyCreditsChanged();

      const scenes = (body.scenes ?? []) as ScriptScene[];

      // One image, its narration beats. The duration follows what it carries:
      // a developed idea keeps its drawing on screen longer.
      const clips = scenes.map((scene) => ({
        id: `clip-${scene.index}`,
        index: scene.index,
        clipType: scene.clipType,
        title: scene.title,
        summary: sceneNarration(scene),
        visualPrompt: scene.imagePrompt,
        duration: sceneDuration(scene),
        beats: scene.beats,
        isSection: false,
      }));
      const images = clips.map(() => "");

      setEditableClips(clips);
      setGeneratedImages(images);
      syncClipsToStore(clips, images);
      brokenDownScript.current = scriptText;
      setStep("storyboard");
    } catch (error) {
      setScriptError(
        error instanceof Error ? error.message : "Network error",
      );
    } finally {
      setIsBreakingDown(false);
    }
  };

  /**
   * Locates each image's annotations and aligns them to the produced voice.
   *
   * They are written to `panel.annotations`, not to
   * `whiteboardConfig.annotations`: that is what the editor and the render read
   * first (to-render-project.ts, whiteboard-editor-step.tsx), the latter
   * being only a fallback shared by all images, hence the same drawing
   * everywhere.
   *
   * A failing image lets the others through: better a scene without
   * annotations, adjustable by hand, than a whole batch lost.
   */
  const planClipAnnotations = async (
    clips: any[],
    images: string[],
  ): Promise<any[]> => {
    if (!projectSync.projectId) return clips;

    const canvas = canvasSize(projectParams.aspectRatio);
    const planned = [...clips];
    let failed = 0;

    // `images` is indexed by clips WITHOUT sections: that is how
    // generateImagesProgressively fills it and syncClipsToStore reads it back.
    // This loop, however, ran over ALL clips: as soon as a section
    // preceded a scene, that scene read another's image, or nothing at
    // all, and came back without annotations. Hence silent scenes in
    // the editor while planning claimed to have run.
    let rank = 0;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (clip.isSection) continue;

      const sceneIndex = rank;
      const imageUrl = images[sceneIndex] || "";
      rank += 1;
      if (!imageUrl || !clip.beats?.length) continue;

      try {
        const imageSize = await measureImageSize(imageUrl);
        // Subjects are measured here, on the image: vision locates well but
        // measures poorly, its rectangle only serves to designate which one.
        const candidates = await measureSubjectCandidates(imageUrl, imageSize);
        const response = await fetch("/api/plan-annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: projectSync.projectId,
            imageUrl,
            scene: {
              index: sceneIndex,
              // The route's schema accepts only these three values: an
              // older project sometimes carries something else, which would fail
              // the whole planning with a 400.
              clipType: ["intro", "content", "outro"].includes(clip.clipType)
                ? clip.clipType
                : "content",
              title: clip.title || "",
              imagePrompt: clip.visualPrompt || "",
              beats: clip.beats,
            },
            width: imageSize.width,
            height: imageSize.height,
            candidates,
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);

        planned[i] = {
          ...clip,
          annotations: adoptPlannedAnnotations({
            panelId: clip.id,
            planned: body.annotations,
            imageSize,
            canvas,
            existing: clip.annotations,
          }),
        };
      } catch (error) {
        // A swallowed failure left only a console line: the scene
        // came back without annotations and nothing said so.
        failed += 1;
        console.error(`Annotation planning ${sceneIndex + 1} failed:`, error);
        if (failed === 1) {
          toast.error(
            error instanceof Error ? error.message : "Annotation planning failed",
          );
        }
      }

      setNarrationProgress(
        NARRATION_SHARE + Math.round(((i + 1) / clips.length) * (100 - NARRATION_SHARE)),
      );
    }

    if (failed > 0) {
      toast.error(
        `${failed} scene${failed > 1 ? "s" : ""} left without annotations`,
      );
    }

    return planned;
  };

  /**
   * Synthesizes the narration, beat by beat.
   *
   * Per image, the voice played but was not split: annotations
   * align to the duration of EACH beat, and the split's estimate drifts by
   * 15%. TTS being billed per character, one call per beat costs the same
   * as the same text in a single call.
   *
   * Progress follows the actual batch: it used to be a three-second
   * animation that waited for nothing, and the next step opened on
   * clips without audio.
   */
  const handleVoiceSelected = async (
    voiceId: string,
    { advance = true }: { advance?: boolean } = {},
  ) => {
    if (!projectSync.projectId) return;

    const jobs = narrationJobs(editableClips);
    if (jobs.length === 0) return;

    const voice = normalizeVoice(voiceId);

    // The step is already done, with this same voice: pass through. The
    // script goes in one take, so rerunning redid the ENTIRE track and
    // replaced alignments already measured. Choosing ANOTHER voice remains an
    // order to redo: it is the only way to change it.
    const parlantes = editableClips.filter(
      (c) =>
        !c.isSection &&
        (c.beats?.some((b: { narration?: string }) => b.narration?.trim()) ||
          (c.summary || c.title || "").trim()),
    );
    if (
      voice === selectedVoice &&
      parlantes.length > 0 &&
      parlantes.every((c) => c.audioUrl)
    ) {
      if (advance) setStep("whiteboard");
      return;
    }

    setSelectedVoice(voice);
    setIsGeneratingNarration(true);
    setNarrationProgress(0);

    // A working copy: narrations obtained are kept even if a
    // call fails midway, rather than losing the whole batch.
    const withAudio = [...editableClips];
    let failed = 0;
    // Images for which this batch has already set the first voice. An image can
    // receive several when it is too long for a single call, and its
    // duration sums them, but starting from zero, otherwise it would add
    // to that of a previous batch.
    const startedClips = new Set<number>();
    // What each recording says, word by word: produced to realign the
    // beats, it is kept instead of thrown away.
    const transcription: { url: string; words: { word: string; startMs: number; endMs: number }[] }[] = [];

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      try {
        const response = await fetch("/api/generate-narration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: projectSync.projectId,
            sceneIndex: i,
            text: job.text,
            beats: job.beats,
            language: projectParams.language,
            voice,
          }),
        });
        const body = await response.json();
        if (!response.ok) {
          showBillingNotice(response.status, body);
          const error = new Error(body.error ?? `HTTP ${response.status}`);
          (error as Error & { fatal?: boolean }).fatal =
            response.status === 503 || response.status === 402;
          throw error;
        }
        notifyCreditsChanged();

        // The recording is not split: its beats are LOCATED in it, each
        // receiving the moment it is spoken and the space it occupies (trailing
        // silence included, otherwise the drawing would get ahead of the breath).
        const alignedBeats: { startMs: number; durationMs: number }[] | null =
          Array.isArray(body.beats) ? body.beats : null;

        if (Array.isArray(body.words) && body.words.length > 0) {
          transcription.push({ url: body.url, words: body.words });
        }

        job.places.forEach((place, rank) => {
          const clip = withAudio[place.clipIndex];
          if (!clip) return;

          const aligned = alignedBeats?.[rank];
          // One recording carries several images: each one
          // references it, and its beats say where they sit inside it.
          const alreadyStarted = startedClips.has(place.clipIndex);
          startedClips.add(place.clipIndex);

          const beats = (clip.beats ?? []).map(
            (beat: ScriptBeat, index: number) =>
              index === place.beatIndex
                ? {
                    ...beat,
                    audioUrl: body.url,
                    startMs: aligned?.startMs,
                    audioDurationMs: aligned?.durationMs,
                  }
                : beat,
          );

          withAudio[place.clipIndex] = {
            ...clip,
            audioUrl: alreadyStarted ? clip.audioUrl : body.url,
            // What THIS image occupies in the voice, not the duration of the
            // file: several images share it.
            audioDurationMs:
              (alreadyStarted ? (clip.audioDurationMs ?? 0) : 0) +
                (aligned?.durationMs ?? 0) || undefined,
            beats,
          };
        });
      } catch (error) {
        failed += 1;
        console.error(`Narration ${i + 1} failed:`, error);
        if (failed === 1) {
          toast.error(
            error instanceof Error ? error.message : "Narration failed",
          );
        }
        if ((error as Error & { fatal?: boolean }).fatal) break;
      }
      setNarrationProgress(
        Math.round(((i + 1) / jobs.length) * NARRATION_SHARE),
      );
    }

    // Planning comes AFTER: it needs the measured durations to
    // bring in each annotation when its text is spoken.
    const planned = await planClipAnnotations(withAudio, generatedImages);

    setEditableClips(planned);
    const panels = syncClipsToStore(planned, generatedImages);
    // The link between a narration beat and what is drawn while it
    // is spoken used to be filled in by hand in the editor: planning
    // knows it by construction.
    setTranscript(transcriptFromPanels(panels));
    // The track: one recording per image, placed where it belongs. Nothing left to
    // stitch: each image is spoken in one take.
    setNarrationParts(scheduleParts(narrationParts(panels)));
    setNarrationTranscription(transcription);
    setIsGeneratingNarration(false);

    const done = jobs.length - failed;
    if (done > 0) {
      toast.success(`Narrated ${done} beat${done > 1 ? "s" : ""}`);
      if (advance) setStep("whiteboard");
    }
    if (failed > 0) {
      toast.error(`${failed} beat${failed > 1 ? "s" : ""} failed`);
    }
  };


  /**
   * Re-places the annotations without touching the voice.
   *
   * Planning only consumes ALREADY measured beats and the images:
   * yet it was welded to synthesis, so redoing it meant paying for the
   * whole script again. A scene that came back silent (planning failed,
   * image missing) can now be recovered on its own.
   */
  const replanAnnotations = async () => {
    if (!projectSync.projectId || isPlanningAnnotations) return;

    const avecTemps = editableClips.filter(
      (c) => !c.isSection && c.beats?.length,
    );
    if (avecTemps.length === 0) {
      toast.info("Nothing to plan: the clips carry no narration beats yet");
      return;
    }

    setIsPlanningAnnotations(true);
    try {
      const planned = await planClipAnnotations(editableClips, generatedImages);
      setEditableClips(planned);
      const panels = syncClipsToStore(planned, generatedImages);

      const servies = panels.filter((p) => p.annotations?.length).length;
      toast.success(
        `${servies} of ${panels.length} scenes carry annotations`,
      );
    } finally {
      setIsPlanningAnnotations(false);
    }
  };

  const handleSaveProgress = async () => {
    const ok = await projectSync.saveNow();
    if (ok) {
      toast.success("Project saved");
    } else if (projectSync.status === "read-only") {
      toast.error(
        projectSync.lockedBy
          ? `Read-only: ${projectSync.lockedBy} is editing this project`
          : "Read-only: someone else is editing this project",
      );
    } else {
      toast.error(projectSync.error ?? "Failed to save project");
    }
  };

  const handleClearSession = () => {
    if (confirm("Clear all saved progress? This cannot be undone.")) {
      resetWorkflow();
      setGeneratedImages([]);
      // resetWorkflow restarts from the prompt step: the hook's subscription writes
      // this empty state into the project, so nothing to clear by hand.
      toast.info("Session cleared");
    }
  };

  const getStepIndex = (s: string) => STEPS.findIndex((step) => step.key === s);
  const currentStepIndex = getStepIndex(step);
  const sceneClips = editableClips.filter((c) => !c.isSection);
  const clipSeconds = (c: { audioDurationMs?: number; duration?: number }) =>
    c.audioDurationMs ? c.audioDurationMs / 1000 : Number(c.duration) || 0;
  const formatSeconds = (total: number) =>
    `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")}`;


  const canNavigateToStep = (index: number) => {
    if (index === 0) return true;
    if (index === 1) return !!promptContent;
    if (index === 2) return !!scriptText.trim();
    if (index === 3) return generatedImages.length > 0;
    if (index === 4) return !!selectedVoice;
    return false;
  };

  // Do not render the UI until the project is loaded
  if (projectSync.status === "loading") {
    return (
      <AppShell showSidebar={false} contentClassName="h-screen overflow-hidden">
        <div className="h-full bg-background text-foreground flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </AppShell>
    );
  }

  if (projectSync.status === "error") {
    return (
      <AppShell showSidebar={false} contentClassName="h-screen overflow-hidden">
        <div className="h-full bg-background text-foreground flex flex-col items-center justify-center gap-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div className="text-center">
            <p className="text-sm font-medium">{projectSync.error}</p>
            <Button onClick={() => router.back()} variant="outline" className="mt-4">
              Retour
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell showSidebar={false} contentClassName="h-screen overflow-hidden">
      <div className="sk-paper h-full text-foreground flex flex-col overflow-hidden">
        <DevPanel currentStep={step} />

        {projectSync.status === "read-only" && (
          // Visible until the lease is taken back: without this banner,
          // editing went on in a normal-looking UI while nothing was
          // being saved anymore, and work was silently lost.
          <div className="shrink-0 z-50 border-b border-destructive/30 bg-destructive/10 px-6 py-2 flex items-center justify-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {projectSync.lockedBy
                ? `Read-only — ${projectSync.lockedBy} is currently editing this project.`
                : "Read-only — this project is being edited elsewhere."}{" "}
              Changes are not being saved.
            </span>
          </div>
        )}

        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b-2 border-ink">
          <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 px-5">
            <div className="flex min-w-0 items-center gap-1">
              <Hint label="back to all your projects, changes are saved" side="bottom">
                <Link
                  href="/workspace"
                  aria-label="Back to projects"
                  className="mr-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border-2 border-ink bg-card px-2.5 text-xs font-bold text-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition-all hover:bg-accent hover:-translate-x-px hover:-translate-y-px"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">Projects</span>
                </Link>
              </Hint>
              <Link
                href="/workspace"
                title="Back to projects"
                className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 font-display text-sm font-extrabold text-foreground transition-colors hover:bg-accent"
              >
                <span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-ink bg-highlight" />
                <span className="hidden sm:inline">{appConfig.name}</span>
              </Link>
              <span className="shrink-0 text-muted-foreground/50" aria-hidden="true">/</span>
              <span className="min-w-0 max-w-[16rem] truncate px-1.5 text-sm font-medium text-foreground" title={projectTitle || "Untitled project"}>
                {projectTitle || "Untitled project"}
              </span>
              <span
                role="status"
                title={
                  projectSync.status === "saving"
                    ? "Saving…"
                    : projectSync.status === "read-only"
                      ? "Read-only"
                      : "All changes saved"
                }
                className="grid h-5 w-5 shrink-0 place-items-center text-muted-foreground"
              >
                {projectSync.status === "saving" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : projectSync.status === "read-only" ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                )}
                <span className="sr-only">
                  {projectSync.status === "saving" ? "Saving" : projectSync.status === "read-only" ? "Read-only" : "All changes saved"}
                </span>
              </span>
              <DropdownMenu>
                <Hint label="save now, clear or sign out" side="bottom">
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Project actions"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                </Hint>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={handleSaveProgress}>
                    <Save className="mr-2 h-4 w-4" />
                    Save now
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleClearSession} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear session
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <SignOutMenuItem />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <nav aria-label="Project steps" className="flex items-center gap-1 rounded-full border-2 border-ink bg-card p-1 shadow-[2px_2px_0_hsl(var(--offset))]">
              {STEPS.map((s, i) => {
                const isActive = i === currentStepIndex;
                const isCompleted = i < currentStepIndex;
                const canNavigate = canNavigateToStep(i);
                const Icon = s.icon;
                return (
                  <Fragment key={s.key}>
                    <Hint
                      side="bottom"
                      label={
                        isActive
                          ? "you are here"
                          : s.key === "prompt"
                            ? "back to the script"
                            : s.key === "storyboard"
                              ? "the scenes and their drawings"
                              : "animate and export"
                      }
                    >
                    <button
                      type="button"
                      onClick={() => canNavigate && setStep(s.key as typeof step)}
                      disabled={!canNavigate}
                      aria-current={isActive ? "step" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40",
                        isActive
                          ? "border-2 border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))] font-bold"
                          : isCompleted
                            ? "border-2 border-transparent text-foreground hover:bg-muted/50"
                            : "border-2 border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
                          isActive && "border border-ink bg-card text-foreground",
                          isCompleted && "bg-[hsl(var(--success))] text-white",
                          !isActive && !isCompleted && "border border-current",
                        )}
                      >
                        {isCompleted ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                      </span>
                      <span className="hidden sm:inline">{s.label}</span>
                    </button>
                    </Hint>
                    {i < STEPS.length - 1 && (
                      <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                    )}
                  </Fragment>
                );
              })}
            </nav>

            <div className="flex items-center justify-end gap-1.5">
              {step === "whiteboard" && (
                <>
                  <Hint label="keyboard shortcuts" side="bottom">
                    <button
                      type="button"
                      onClick={() => setIsShortcutsOpen(true)}
                      aria-label="Keyboard shortcuts"
                      className="grid h-8 w-8 place-items-center rounded-lg border-2 border-ink bg-card shadow-[2px_2px_0_hsl(var(--offset))] text-muted-foreground transition-all hover:text-foreground hover:-translate-x-px hover:-translate-y-px"
                    >
                      <Keyboard className="h-4 w-4" />
                    </button>
                  </Hint>
                  {step === "whiteboard" && !isExporting && !downloadUrl && (
                    <SketchHint direction="right" className="mr-1 hidden text-lg xl:flex">
                      done? get your video here
                    </SketchHint>
                  )}
                  <Hint label="turn it into an MP4 (⌘E)" side="bottom">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsExportModalOpen(true)}
                      className="border-2 border-ink shadow-[2px_2px_0_hsl(var(--offset))] font-bold"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </Hint>
                </>
              )}
            </div>
          </div>
        </header>

        <div
          className={cn(
            "flex-1 min-h-0 px-2 py-4",
            step === "whiteboard" ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          {/* Step Content */}
          {step === "prompt" && (
            <div className="px-4 py-8">
              <PromptWizard
                brief={promptContent}
                onBriefChange={setPromptContent}
                params={projectParams}
                onParamsChange={setProjectParams}
                voice={selectedVoice}
                onVoiceChange={setSelectedVoice}
                onPreviewVoice={(v) => void playVoicePreview(v)}
                previewingVoice={previewingVoice}
                onGenerate={handlePromptSubmit}
                isGenerating={isGeneratingScript}
                aside={
                  scriptText || isGeneratingScript || scriptError ? (
                    <>
                  <span className="sk-tape" aria-hidden="true" />
                  <div className="sk-sheet overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
                    <div className="border-b border-border bg-muted/50 px-4 py-3 flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {isGeneratingScript ? "Writing script..." : `Script · ${scriptWordCount} words`}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isGeneratingScript || isBreakingDown}
                        onClick={() => void generateScript()}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Regenerate
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      {isGeneratingScript ? (
                        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <p className="text-sm">Writing your script...</p>
                        </div>
                      ) : scriptError ? (
                        <div className="flex items-start gap-2 text-sm text-destructive">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          {scriptError}
                        </div>
                      ) : (
                        <Textarea
                          value={scriptText}
                          onChange={(e) => setScriptText(e.target.value)}
                          aria-label="Narration script"
                          className="min-h-[50vh] resize-none border-0 bg-transparent p-0 text-sm leading-relaxed focus-visible:ring-0"
                        />
                      )}
                    </div>
                    <div className="border-t border-border px-4 py-3">
                      <Button
                        onClick={() => void handleScriptValidated()}
                        disabled={!scriptText.trim() || isGeneratingScript || isBreakingDown}
                        variant="secondary"
                        className="w-full"
                      >
                        {isBreakingDown ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        {isBreakingDown ? "Building storyboard..." : "Approve script"}
                      </Button>
                    </div>
                  </div>
                    </>
                  ) : undefined
                }
              />
            </div>
          )}


          {step === "storyboard" && (
            <div className="max-w-7xl mx-auto px-4 pt-4 pb-12">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-end gap-4">
                    <div>
                      <h2 className="text-3xl font-extrabold">
                        <span className="sk-marker">Storyboard</span>
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {sceneClips.length} scene{sceneClips.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="hidden md:flex items-end gap-1 pb-1" aria-hidden="true">
                      <span className="w-14 -rotate-6">
                        <HandArrow variant="right" className="sk-hand-arrow" />
                      </span>
                      <span className="sk-scribble -rotate-2">click a scene to edit it</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isGeneratingNarration && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground" />
                        Recording voice · {Math.round(narrationProgress)}%
                      </span>
                    )}
                    <Hint label="redraw every scene from scratch">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void generateImagesProgressively({ force: true })}
                        disabled={isGeneratingImages || isGeneratingNarration}
                        aria-label="Redraw all visuals"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </Hint>
                    {!isGeneratingImages && !isGeneratingNarration && sceneClips.length > 0 && (
                      <SketchHint direction="right" className="hidden text-lg lg:flex">
                        happy with it? bring it to life
                      </SketchHint>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => {
                        syncClipsToStore(editableClips, generatedImages);
                        void handleVoiceSelected(selectedVoice);
                      }}
                      disabled={isGeneratingImages || isGeneratingNarration}
                    >
                      Next: Whiteboard
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isGeneratingImages && (
                  <div className="flex items-center gap-3 py-1 text-sm" aria-live="polite">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    <span className="shrink-0 font-semibold">
                      Drawing scene {Math.min(generatingProgress.current + 1, generatingProgress.total)} of {generatingProgress.total}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-highlight transition-all duration-500"
                        style={{ width: `${(generatingProgress.current / Math.max(1, generatingProgress.total)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-4 items-start">
                  <div className="flex-1 min-w-0 grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {editableClips.map((item, i) => {
                      const selected = i === selectedClipIndex;
                      return item.isSection ? (
                        <button
                          key={item.id || `item-${i}`}
                          type="button"
                          onClick={() => setSelectedClipIndex(i)}
                          className={cn(
                            "col-span-full text-left sk-scribble border-b-2 border-dashed pt-3 pb-1",
                            selected ? "border-ink" : "border-border opacity-80",
                          )}
                        >
                          {item.title || "Untitled section"}
                        </button>
                      ) : (
                        <button
                          key={item.id || `item-${i}`}
                          type="button"
                          onClick={() => setSelectedClipIndex(i)}
                          className={cn(
                            "text-left rounded-md border-2 bg-card overflow-hidden transition-all",
                            selected
                              ? "border-ink shadow-[5px_5px_0_hsl(var(--offset))] -rotate-[0.6deg]"
                              : "border-border hover:border-ink hover:shadow-[3px_3px_0_hsl(var(--offset))]",
                          )}
                        >
                          <div className="relative aspect-video bg-card flex items-center justify-center">
                            {generatedImages[i] ? (
                              <Image src={generatedImages[i]} alt={item.title || `Clip ${i + 1}`} fill className="object-contain" />
                            ) : generatingClipIndex === i ? (
                              <span className="grid justify-items-center gap-1 text-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="sk-scribble text-sm">drawing…</span>
                              </span>
                            ) : isGeneratingImages ? (
                              <span className="grid justify-items-center gap-1 text-muted-foreground/70">
                                <Pencil className="h-4 w-4" />
                                <span className="text-[11px] font-medium uppercase tracking-wide">Queued</span>
                              </span>
                            ) : (
                              <Film className="h-5 w-5 text-muted-foreground/40" />
                            )}
                            <span className="absolute top-1.5 left-1.5 rounded-full border-2 border-ink bg-highlight px-2 text-[11px] font-bold leading-4 text-highlight-foreground">
                              {i + 1}
                            </span>
                          </div>
                          <div className="grid gap-1.5 border-t-2 border-dashed border-border px-2.5 py-2">
                            <p className="truncate text-sm font-bold leading-tight">
                              {item.title || `Clip ${i + 1}`}
                            </p>
                            <p className="line-clamp-2 min-h-[2lh] text-xs leading-snug text-muted-foreground">
                              {item.summary || item.narration || "No narration yet"}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-mono text-muted-foreground">{formatSeconds(clipSeconds(item))}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => { addClip(); setSelectedClipIndex(editableClips.length); }}
                      className="aspect-video rounded-md border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-ink hover:bg-highlight/10 flex flex-col items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="sk-scribble text-base">add a scene</span>
                    </button>
                  </div>

                  {editableClips[selectedClipIndex] && (() => {
                    const i = selectedClipIndex;
                    const item = editableClips[i];
                    return (
                      <aside className="sticky top-2 w-96 shrink-0 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-lg border-2 border-ink bg-card p-4 space-y-3 shadow-[6px_6px_0_hsl(var(--offset))]">
                        <div className="flex items-start justify-between gap-3 border-b-2 border-dashed border-border pb-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-muted-foreground">
                              {item.isSection ? "Section" : `Scene ${i + 1}`}
                            </p>
                            <p className="truncate font-display text-base font-extrabold">
                              {item.title || (item.isSection ? "Untitled section" : `Clip ${i + 1}`)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center rounded-full border-2 border-border p-0.5">
                            <Hint label="move this scene earlier"><button type="button" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30" disabled={i === 0} onClick={() => { moveClip(i, "up"); setSelectedClipIndex(i - 1); }} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button></Hint>
                            <Hint label="move this scene later"><button type="button" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30" disabled={i === editableClips.length - 1} onClick={() => { moveClip(i, "down"); setSelectedClipIndex(i + 1); }} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button></Hint>
                            <Hint label="copy this scene right after it"><button type="button" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => duplicateClip(i)} aria-label="Duplicate"><Copy className="h-3.5 w-3.5" /></button></Hint>
                            <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
                            <Hint label="remove this scene"><button type="button" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => { deleteClip(i); setSelectedClipIndex(Math.max(0, i - 1)); }} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button></Hint>
                          </div>
                        </div>

                        {item.isSection ? (
                          <input
                            type="text"
                            value={item.title || ""}
                            onChange={(e) => updateClipField(i, { title: e.target.value })}
                            placeholder="Section title..."
                            className="w-full text-sm bg-muted/40 border border-border/50 rounded-lg p-2.5 outline-none focus:border-ink"
                          />
                        ) : (
                          <>
                            <div className="relative aspect-video overflow-hidden rounded-md border-2 border-border bg-white">
                              {generatedImages[i] && (
                                <Image src={generatedImages[i]} alt={item.title || `Clip ${i + 1}`} fill className="object-contain" />
                              )}
                              {generatingClipIndex === i && (
                                <span className="absolute inset-0 grid place-items-center bg-background/70">
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                </span>
                              )}
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => void regenerateImageForClip(i)}
                                disabled={isGeneratingImages}
                                className="absolute bottom-2 right-2"
                              >
                                <RefreshCw className="h-3 w-3" />
                                Redraw
                              </Button>
                            </div>
                            {([
                              {
                                key: "prompt",
                                label: "Image prompt",
                                value: item.visualPrompt || "",
                                placeholder: "What the visual should show...",
                                onChange: (v: string) => updateClipField(i, { visualPrompt: v }),
                              },
                              {
                                key: "description",
                                label: "Description",
                                value: item.summary || item.narration || "",
                                placeholder: "What is said during this scene...",
                                onChange: (v: string) => updateClipField(i, { summary: v, narration: v }),
                              },
                            ] as const).map((field) => {
                              const editing = editingField === `${i}:${field.key}`;
                              const isPrompt = field.key === "prompt";
                              return (
                                <div key={field.key} className="group/field space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    {isPrompt ? (
                                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
                                        <ImageIcon className="w-3.5 h-3.5 text-foreground" />
                                        {field.label}
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setDescriptionOpen((open) => !open)}
                                        aria-expanded={descriptionOpen}
                                        className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                                      >
                                        {descriptionOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        {field.label}
                                      </button>
                                    )}
                                    {editing ? (
                                      <button
                                        type="button"
                                        onClick={() => setEditingField(null)}
                                        className="flex items-center gap-1 text-[11px] text-foreground"
                                      >
                                        <Check className="w-3 h-3" />
                                        Done
                                      </button>
                                    ) : (
                                      <Hint label={`edit the ${field.label.toLowerCase()}`}>
                                        <button
                                          type="button"
                                          onClick={() => setEditingField(`${i}:${field.key}`)}
                                          aria-label={`Edit ${field.label}`}
                                          className="opacity-0 group-hover/field:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                      </Hint>
                                    )}
                                  </div>
                                  {!isPrompt && !descriptionOpen && !editing ? (
                                    <button
                                      type="button"
                                      onClick={() => setDescriptionOpen(true)}
                                      className="w-full truncate px-1 text-left text-xs text-muted-foreground hover:text-foreground"
                                    >
                                      {field.value || field.placeholder}
                                    </button>
                                  ) : editing ? (
                                    <Textarea
                                      autoFocus
                                      value={field.value}
                                      onChange={(e) => field.onChange(e.target.value)}
                                      onBlur={() => setEditingField(null)}
                                      placeholder={field.placeholder}
                                      className={cn(
                                        "field-sizing-fixed min-h-0 overflow-y-auto text-xs leading-relaxed resize-none",
                                        isPrompt ? "h-32" : "h-28",
                                      )}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setEditingField(`${i}:${field.key}`)}
                                      className={cn(
                                        "w-full text-left rounded-md transition-colors",
                                        isPrompt
                                          ? "border border-ink bg-highlight/15 px-3 py-2.5 text-sm leading-relaxed text-foreground hover:border-ink"
                                          : "px-1 py-0.5 text-xs leading-relaxed text-muted-foreground hover:bg-muted/30",
                                      )}
                                    >
                                      <span className={cn(!field.value && "text-muted-foreground/60")}>
                                        {field.value || field.placeholder}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => addSection(i)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-ink hover:text-foreground"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          Insert section after
                        </button>
                      </aside>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Whiteboard Step */}
          {step === "whiteboard" && (
            <WhiteboardEditorStep
              config={whiteboardConfig}
              aspectRatio={projectParams.aspectRatio}
              onConfigChange={(updates) =>
                setWhiteboardConfig(updates)
              }
            />
          )}


          {/* Without clips, the block above renders NOTHING: the screen stayed
              empty with no way out. Better to say what is missing and reopen the
              path that produces it. */}


        </div>

        {isExporting && !isExportModalOpen && (
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            aria-label={`Export in progress, ${Math.round(exportProgress)}%. Open export`}
            className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-5 z-50 flex w-64 flex-col gap-2 rounded-lg border-2 border-ink bg-card px-3 py-2.5 text-left shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px"
          >
            <span className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground">
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Exporting video
              </span>
              <span className="tabular-nums text-muted-foreground">{Math.round(exportProgress)}%</span>
            </span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-highlight transition-[width] duration-500"
                style={{ width: `${exportPhase === "init" ? 0 : exportProgress}%` }}
              />
            </span>
          </button>
        )}

        {/* Export Modal - Using existing component */}
        <WhiteboardExportDialog
          projectTitle={projectTitle}
          aspectRatio={projectParams.aspectRatio}
          sceneCount={storyboardPanels.length}
          durationSec={storyboardPanels.reduce((sum, p) => sum + (p.duration || 5), 0)}
          thumbnailUrl={storyboardPanels[0]?.imageUrl}
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          onStartExport={async (resolution) => {
            setExportPhase("init");
            setIsExporting(true);
            setExportProgress(0);
            setDownloadUrl(null);
            try {
              const project = toRenderProject({
                panels: storyboardPanels,
                config: whiteboardConfig,
                aspectRatio: projectParams.aspectRatio,
              });
              const res = await fetch("/api/whiteboard/render", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  projectId: projectSync.projectId ?? undefined,
                  quality: resolution,
                  aspectRatio: projectParams.aspectRatio,
                  project,
                }),
              });
              if (!res.ok) {
                const body = await res.json();
                if (showBillingNotice(res.status, body)) {
                  setExportPhase("idle");
                  return;
                }
                throw new Error(body.error || "Export refuse");
              }
              const { jobId } = await res.json();
              rememberRender(jobId);
              await trackRender(jobId);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Export failed");
              setExportPhase("idle");
              setIsExporting(false);
            }
          }}
          isExporting={isExporting}
          exportProgress={exportProgress}
          exportPhase={exportPhase}
          downloadUrl={downloadUrl}
          onCancel={() => {
            const id = renderJobIdRef.current;
            // Reset to null BEFORE the request: the polling loop compares
            // this reference and stops on its own.
            renderJobIdRef.current = null;
            rememberRender(null);
            if (id) {
              void fetch(`/api/whiteboard/render/${id}`, { method: "DELETE" });
            }
            setIsExporting(false);
            setExportPhase("idle");
            setDownloadUrl(null);
          }}
        />

        {/* Shortcuts Modal - Using existing component */}
        <ShortcutsModal
          isOpen={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
        />
      </div>
    </AppShell>
  );
}
