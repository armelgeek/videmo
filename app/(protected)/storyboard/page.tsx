"use client";

import { useState, useEffect, useRef } from "react";
import { ExportModal } from "@/lib/editor/components/export-modal";
import { toRenderProject } from "@/lib/whiteboard-animation/server/to-render-project";
import { ShortcutsModal } from "@/lib/editor/components/shortcuts-modal";
import { MasterGenerator } from "@/lib/automator/master-generator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  LayoutGrid,
  Film,
  Loader2,
  RefreshCw,
  Globe,
  Clock,
  Volume2,
  Users,
  Download,
  Copy,
  Plus,
} from "lucide-react";
import Image from "next/image";
import { DEMO_FINAL_SEQUENCE } from "@/lib/demo-data";
import { useProjectSync } from "@/lib/storyboard/use-project-sync";
import { useToastContext } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { AppShell } from "@/lib/app-shell";
import { DevPanel } from "@/lib/dev-panel";
import { useRouter } from "next/navigation";
import {
  useStoryboardStore,
  normalizeWorkflowStep,
} from "@/lib/storyboard/store";
import { SceneCard } from "@/lib/storyboard/components/scene-card";
import { WhiteboardConfigPanel } from "@/lib/whiteboard-animation/components/whiteboard-config-panel";
import { WhiteboardEditorStep } from "@/lib/whiteboard-animation/components/whiteboard-editor-step";
import { AudioPanel } from "@/lib/whiteboard-animation/components/audio-panel";
import { TranscriptPanel } from "@/lib/whiteboard-animation/components/transcript-panel";

const STEPS = [
  { key: "prompt", label: "Prompt", icon: Wand2 },
  { key: "scriptValidation", label: "Script", icon: Settings },
  { key: "storyboard", label: "Storyboard", icon: Layers },
  { key: "voiceChoice", label: "Voice", icon: Film },
  { key: "whiteboard", label: "Whiteboard", icon: Settings },
] as const;

const VOICES_BY_LANGUAGE: Record<
  string,
  {
    id: string;
    name: string;
    description: string;
    tags: string[];
    color: string;
  }[]
> = {
  en: [
    {
      id: "en-us-male-1",
      name: "Ron",
      description: "A low, intense voice fit for narrating crime documentaries",
      tags: ["bass", "husky", "authoritative"],
      color: "from-orange-300 to-orange-400",
    },
    {
      id: "en-us-female-1",
      name: "Maisie",
      description:
        "British accent with a steady, distinctive tone perfect for podcasts",
      tags: ["british", "steady", "distinct"],
      color: "from-pink-300 to-orange-200",
    },
    {
      id: "en-gb-male-1",
      name: "Robert",
      description:
        "Senior educational voice ideal for documentary and e-learning",
      tags: ["senior", "educational", "calm"],
      color: "from-amber-300 to-orange-300",
    },
    {
      id: "en-gb-female-1",
      name: "Dan",
      description: "Natural, sensible voice for expert commentary and analysis",
      tags: ["expert", "sensible", "natural"],
      color: "from-yellow-200 to-orange-300",
    },
  ],
  fr: [
    {
      id: "fr-male-1",
      name: "Pierre",
      description: "Voix masculine professionnelle",
      tags: ["french", "professional", "male"],
      color: "from-blue-300 to-blue-400",
    },
    {
      id: "fr-female-1",
      name: "Marie",
      description: "Voix féminine professionnelle",
      tags: ["french", "professional", "female"],
      color: "from-rose-300 to-pink-400",
    },
  ],
  es: [
    {
      id: "es-male-1",
      name: "Carlos",
      description: "Voz masculina profesional",
      tags: ["spanish", "professional", "male"],
      color: "from-red-300 to-orange-400",
    },
    {
      id: "es-female-1",
      name: "Rosa",
      description: "Voz femenina profesional",
      tags: ["spanish", "professional", "female"],
      color: "from-pink-300 to-red-400",
    },
  ],
  de: [
    {
      id: "de-male-1",
      name: "Klaus",
      description: "Professionelle Männerstimme",
      tags: ["german", "professional", "male"],
      color: "from-indigo-300 to-blue-400",
    },
    {
      id: "de-female-1",
      name: "Anna",
      description: "Professionelle Frauenstimme",
      tags: ["german", "professional", "female"],
      color: "from-purple-300 to-pink-400",
    },
  ],
  it: [
    {
      id: "it-male-1",
      name: "Marco",
      description: "Voce maschile professionale",
      tags: ["italian", "professional", "male"],
      color: "from-green-300 to-emerald-400",
    },
    {
      id: "it-female-1",
      name: "Giulia",
      description: "Voce femminile professionale",
      tags: ["italian", "professional", "female"],
      color: "from-teal-300 to-green-400",
    },
  ],
  pt: [
    {
      id: "pt-male-1",
      name: "João",
      description: "Voz masculina profissional",
      tags: ["portuguese", "professional", "male"],
      color: "from-yellow-300 to-amber-400",
    },
    {
      id: "pt-female-1",
      name: "Marta",
      description: "Voz feminina profissional",
      tags: ["portuguese", "professional", "female"],
      color: "from-orange-300 to-yellow-400",
    },
  ],
  zh: [
    {
      id: "zh-male-1",
      name: "Wei",
      description: "Professional Male Voice",
      tags: ["chinese", "professional", "male"],
      color: "from-red-300 to-red-400",
    },
    {
      id: "zh-female-1",
      name: "Yan",
      description: "Professional Female Voice",
      tags: ["chinese", "professional", "female"],
      color: "from-red-300 to-pink-400",
    },
  ],
  ja: [
    {
      id: "ja-male-1",
      name: "Takeshi",
      description: "Professional Male Voice",
      tags: ["japanese", "professional", "male"],
      color: "from-fuchsia-300 to-pink-400",
    },
    {
      id: "ja-female-1",
      name: "Yuki",
      description: "Professional Female Voice",
      tags: ["japanese", "professional", "female"],
      color: "from-pink-300 to-fuchsia-400",
    },
  ],
};

export default function StoryboardPage() {
  const { toast } = useToastContext();
  const router = useRouter();

  // Zustand Workflow Store
  const {
    step,
    setStep,
    projectTitle,
    setProjectTitle,
    promptContent,
    setPromptContent,
    projectParams,
    setProjectParams,
    scriptTitle,
    setScriptTitle,
    scriptScenes,
    setScriptScenes,
    updateScene,
    removeScene,
    storyboardPanels,
    setStoryboardPanels,
    updatePanel,
    selectedVoice,
    setSelectedVoice,
    whiteboardConfig,
    setWhiteboardConfig,
    loadDemoData,
    resetWorkflow,
  } = useStoryboardStore();

  const [storyboardData, setStoryboardData] = useState<{
    storyboard: any;
    content: string;
    params: any;
  } | null>(null);
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

  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [storageMode, setStorageMode] = useState<"persistent" | "temporal">(
    "temporal",
  );
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(
    new Set(),
  );
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState({
    current: 0,
    total: 0,
  });
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [isGeneratingNarration, setIsGeneratingNarration] = useState(false);
  const [narrationProgress, setNarrationProgress] = useState(0);
  const [storyboardPage, setStoryboardPage] = useState(0);

  useEffect(() => {
    const savedMode = localStorage.getItem("storyboard-storage-mode") as
      | "persistent"
      | "temporal"
      | null;
    if (savedMode) {
      setStorageMode(savedMode);
    }
  }, []);

  // Le projet vit en base : useProjectSync le charge (ou le cree), tient le
  // bail d'edition et ecrit chaque changement du store.
  const projectSync = useProjectSync();

  const totalScriptDuration = scriptScenes.reduce(
    (total, scene) => total + scene.duration,
    0,
  );

  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Le script est ecrit par l'agent a partir du prompt et des parametres. Le
  // garde sur les scenes deja presentes evite de regenerer — donc de repayer un
  // appel modele — en revenant sur l'etape depuis le storyboard.
  useEffect(() => {
    if (step !== "scriptValidation" || isGeneratingScript) return;
    if (scriptScenes.length > 0) return;
    if (!promptContent.trim()) return;

    let cancelled = false;
    setIsGeneratingScript(true);
    setScriptError(null);

    (async () => {
      try {
        const response = await fetch("/api/generate-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: promptContent, ...projectParams }),
        });
        const body = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setScriptError(body.error ?? `HTTP ${response.status}`);
          return;
        }
        setScriptTitle(body.title ?? "");
        setScriptScenes(body.scenes ?? []);
      } catch (error) {
        if (!cancelled) {
          setScriptError(
            error instanceof Error ? error.message : "Network error",
          );
        }
      } finally {
        if (!cancelled) setIsGeneratingScript(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, promptContent]);

  const syncClipsToStore = (clipsToSync: any[], imagesToSync: string[]) => {
    const panels = clipsToSync
      .filter((clip) => !clip.isSection)
      .map((clip, i) => {
        const image =
          imagesToSync[i] ||
          clip.imageUrl ||
          DEMO_FINAL_SEQUENCE.storyboard[i % DEMO_FINAL_SEQUENCE.storyboard.length]?.imageUrl ||
          "";
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
        };
      });
    setStoryboardPanels(panels);
  };

  // Initialize editable clips when storyboardData changes or step is storyboard
  useEffect(() => {
    if (step === "storyboard") {
      if (storyboardData?.storyboard?.clipOutlines && storyboardData.storyboard.clipOutlines.length > 0) {
        const formattedClips = storyboardData.storyboard.clipOutlines.map((c: any, idx: number) => ({
          id: c.id || `clip-${idx}`,
          index: idx,
          clipType: c.clipType || "content",
          title: c.title || `Clip ${idx + 1}`,
          summary: c.summary || c.narration || "",
          visualPrompt: c.visualPrompt || c.summary || `Visual for clip ${idx + 1}`,
          duration: typeof c.duration === "number" ? c.duration : 5,
          isSection: !!c.isSection,
        }));
        setEditableClips(formattedClips);
        if (generatedImages.length === 0) {
          const initialImgs = formattedClips.map((_: any, i: number) =>
            DEMO_FINAL_SEQUENCE.storyboard[i % DEMO_FINAL_SEQUENCE.storyboard.length]?.imageUrl || ""
          );
          setGeneratedImages(initialImgs);
          syncClipsToStore(formattedClips, initialImgs);
        } else {
          syncClipsToStore(formattedClips, generatedImages);
        }
      } else if (editableClips.length === 0) {
        const demoClips = DEMO_FINAL_SEQUENCE.storyboard.map((p, idx) => ({
          id: `clip-${idx}`,
          index: idx,
          clipType: idx === 0 ? "intro" : idx === DEMO_FINAL_SEQUENCE.storyboard.length - 1 ? "outro" : "content",
          title: `Scene ${idx + 1}`,
          summary: p.prompt,
          visualPrompt: p.prompt,
          duration: p.duration || 5,
          isSection: false,
        }));
        const demoImgs = DEMO_FINAL_SEQUENCE.storyboard.map((p) => p.imageUrl);
        setEditableClips(demoClips);
        setGeneratedImages(demoImgs);
        syncClipsToStore(demoClips, demoImgs);
        if (!storyboardData) {
          setStoryboardData({
            storyboard: { clipOutlines: demoClips, title: "Demo Storyboard" },
            content: promptContent || "Demo Concept",
            params: projectParams,
          });
        }
      }
    }
  }, [step, storyboardData]);

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

    const defaultImg = DEMO_FINAL_SEQUENCE.storyboard[newClips.length % DEMO_FINAL_SEQUENCE.storyboard.length]?.imageUrl || "";
    const newImages = [...generatedImages];
    newImages.splice(targetIdx, 0, defaultImg);

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

  const generateImagesProgressively = async () => {
    const demoImages = DEMO_FINAL_SEQUENCE.storyboard.map((p) => p.imageUrl);
    const totalToGenerate = editableClips.filter((c) => !c.isSection).length || 1;

    setIsGeneratingImages(true);
    setGeneratingProgress({ current: 0, total: totalToGenerate });
    const newImages: string[] = [];

    for (let i = 0; i < totalToGenerate; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const demoImg = demoImages[i % demoImages.length];
      newImages.push(demoImg);
      setGeneratedImages([...newImages]);
      setGeneratingProgress({ current: i + 1, total: totalToGenerate });
    }

    setIsGeneratingImages(false);
    syncClipsToStore(editableClips, newImages);
    toast.success(`Generated ${totalToGenerate} visuals for timeline clips`);
  };

  const regenerateImageForClip = async (clipIndex: number) => {
    const demoImages = DEMO_FINAL_SEQUENCE.panels.map((p) => p.imageUrl);
    const newImages = [...generatedImages];
    const currentImg = newImages[clipIndex];
    let nextIndex = (clipIndex + 1) % demoImages.length;
    if (demoImages[nextIndex] === currentImg) {
      nextIndex = (nextIndex + 1) % demoImages.length;
    }
    newImages[clipIndex] = demoImages[nextIndex] || DEMO_FINAL_SEQUENCE.storyboard[0].imageUrl;
    setGeneratedImages(newImages);
    syncClipsToStore(editableClips, newImages);
    toast.success(`Regenerated visual for clip ${clipIndex + 1}`);
  };

  const playVoicePreview = (voiceId: string) => {
    const sampleText =
      "Welcome to our video presentation. This is a sample of our professional narration voice.";

    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.rate = 1;
        utterance.pitch = 1.1;
        utterance.volume = 1;

        // Set language based on voice ID
        if (voiceId.includes("en")) utterance.lang = "en-US";
        if (voiceId.includes("fr")) utterance.lang = "fr-FR";
        if (voiceId.includes("es")) utterance.lang = "es-ES";
        if (voiceId.includes("de")) utterance.lang = "de-DE";
        if (voiceId.includes("it")) utterance.lang = "it-IT";
        if (voiceId.includes("pt")) utterance.lang = "pt-BR";
        if (voiceId.includes("zh")) utterance.lang = "zh-CN";
        if (voiceId.includes("ja")) utterance.lang = "ja-JP";

        // Reset preview state when speech ends
        utterance.onend = () => {
          setPreviewingVoice(null);
        };

        utterance.onerror = () => {
          setPreviewingVoice(null);
        };

        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error("Voice preview error:", error);
      setPreviewingVoice(null);
    }
  };

  const handlePromptSubmit = (content: string) => {
    setPromptContent(content);
    setStep("scriptValidation");
  };

  /**
   * Les scenes approuvees deviennent le storyboard.
   *
   * L'ancien parcours rappelait /api/generate-storyboard, qui reinventait des
   * `clipOutlines` a partir du seul prompt : le travail de l'agent — et les
   * corrections faites juste au-dessus — etaient jetes entre les deux etapes.
   */
  const handleScriptValidated = async () => {
    setStoryboardData({
      storyboard: {
        title: scriptTitle,
        clipOutlines: scriptScenes.map((scene) => ({
          index: scene.index,
          clipType: scene.clipType,
          title: scene.title,
          summary: scene.narration,
          visualPrompt: scene.imagePrompt,
          duration: scene.duration,
        })),
      },
      content: promptContent,
      params: projectParams,
    });

    setStep("storyboard");
  };

  const handleStoryboardGenerated = (
    storyboard: any,
    content: string,
    params: any,
    images: string[],
  ) => {
    const data = { storyboard, content, params };
    setStoryboardData(data);
    setGeneratedImages(images);
    setStep("voiceChoice");
  };

  const handleVoiceSelected = (voiceId: string) => {
    setSelectedVoice(voiceId);
    setIsGeneratingNarration(true);
    setNarrationProgress(0);

    // Simulate narration generation with progress
    const progressInterval = setInterval(() => {
      setNarrationProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + Math.random() * 30;
      });
    }, 500);

    // Complete after ~3 seconds
    setTimeout(() => {
      clearInterval(progressInterval);
      setNarrationProgress(100);
      setTimeout(() => {
        setIsGeneratingNarration(false);
        setStep("whiteboard");
      }, 500);
    }, 3000);
  };

  const handleSaveProgress = async () => {
    await projectSync.saveNow();
    toast.success("Project saved");
  };

  const handleClearSession = () => {
    if (confirm("Clear all saved progress? This cannot be undone.")) {
      resetWorkflow();
      setStoryboardData(null);
      setGeneratedImages([]);
      // resetWorkflow repart de l'etape prompt : l'abonnement du hook ecrit
      // cet etat vide dans le projet, donc rien a effacer a la main.
      toast.info("Session cleared");
    }
  };

  const handleStorageModeChange = (mode: string) => {
    const storageValue = mode as "persistent" | "temporal";
    setStorageMode(storageValue);
    localStorage.setItem("storyboard-storage-mode", storageValue);
  };

  const dismissBanner = (id: string) => {
    setDismissedBanners((prev) => new Set([...prev, id]));
  };

  const getStepIndex = (s: string) => STEPS.findIndex((step) => step.key === s);
  const currentStepIndex = getStepIndex(step);

  const canNavigateToStep = (index: number) => {
    if (index === 0) return true;
    if (index === 1) return !!promptContent;
    if (index === 2) return scriptScenes.length > 0;
    if (index === 3) return generatedImages.length > 0;
    if (index === 4) return !!selectedVoice;
    return false;
  };

  return (
    <AppShell contentClassName="h-screen overflow-hidden">
      <div className="flex-1 bg-background text-foreground flex flex-col overflow-hidden">
        <DevPanel currentStep={step} />

        <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="px-6 py-3 flex items-center justify-center gap-8 relative">
            {/* Project Title + Actions - Left */}
            <div className="absolute left-6 flex items-center gap-3">
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="text-xl font-semibold bg-transparent border-0 border-b border-border/50 focus:border-primary focus:outline-none text-foreground placeholder-muted-foreground w-full max-w-xs px-0 py-1 transition-colors"
                placeholder="Project title..."
              />
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSaveProgress}
                  className="h-6 w-6 p-0 hover:bg-muted transition-all hover:scale-110"
                  title="Save progress"
                >
                  <Save className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearSession}
                  className="h-6 w-6 p-0 hover:bg-muted transition-all hover:scale-110"
                  title="Clear session"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Center: Steps Progress */}
            {/* Steps Progress - Vertical Style */}
            <div className="flex items-center justify-center gap-2">
              {STEPS.map((s, i) => {
                const isActive = i === currentStepIndex;
                const isCompleted = i < currentStepIndex;
                const canNavigate = canNavigateToStep(i);
                const Icon = s.icon;

                return (
                  <div key={s.key} className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        canNavigate && setStep(s.key as typeof step)
                      }
                      disabled={!canNavigate}
                      className={cn(
                        "flex flex-col items-center gap-0.5 group transition-all",
                        canNavigate
                          ? "cursor-pointer hover:scale-110"
                          : "cursor-not-allowed opacity-40",
                      )}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : isCompleted
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground group-hover:bg-muted/70",
                        )}
                      >
                        {isCompleted ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Icon className="w-3 h-3" />
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-medium transition-colors whitespace-nowrap",
                          isActive
                            ? "text-foreground"
                            : isCompleted
                              ? "text-primary"
                              : "text-muted-foreground",
                        )}
                      >
                        {s.label}
                      </span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <div
                        className={cn(
                          "w-10 h-px transition-colors",
                          i < currentStepIndex
                            ? "bg-primary/50"
                            : "bg-border/30",
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right: Action Buttons */}
            {step !== "prompt" && (
              <div className="absolute right-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setIsShortcutsOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/60 rounded-full text-xs font-medium transition-all hover:scale-105 hover:shadow-md"
                  title="Learn keyboard shortcuts"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Learn</span>
                </button>
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-white bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 border border-primary/50 rounded-full text-xs font-medium transition-all hover:scale-105 hover:shadow-lg"
                  title="Export video project (⌘E)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="px-2 py-4">
          {/* Step Content */}
          {step === "prompt" && (
            <div className="flex flex-col items-center px-4 py-8">
              <div className="w-full max-w-2xl space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                  <h1 className="text-4xl font-bold">Create Your Video</h1>
                  <p className="text-sm text-muted-foreground">
                    Describe your project idea
                  </p>
                </div>

                {/* Secondary Pills Row */}
                <div className="flex flex-wrap gap-3 justify-center items-center">
                  {/* Style */}
                  <Select
                    value={projectParams.style}
                    onValueChange={(val) =>
                      setProjectParams({ ...projectParams, style: val })
                    }
                  >
                    <SelectTrigger className="bg-white/5 border border-white/10 rounded-full text-sm px-3 py-1.5 hover:bg-white/10 transition-colors inline-flex items-center gap-1.5">
                      <Settings className="w-4 h-4" />
                      <SelectValue className="text-sm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cinematic">Cinematic</SelectItem>
                      <SelectItem value="anime">Anime</SelectItem>
                      <SelectItem value="retro">Retro</SelectItem>
                      <SelectItem value="whiteboard">Whiteboard</SelectItem>
                      <SelectItem value="isometric">Isometric</SelectItem>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="documentary">Documentary</SelectItem>
                      <SelectItem value="minimalist">Minimalist</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Type/Format */}
                  <Select
                    value={projectParams.format}
                    onValueChange={(val: any) =>
                      setProjectParams({ ...projectParams, format: val })
                    }
                  >
                    <SelectTrigger className="bg-white/5 border border-white/10 rounded-full text-sm px-3 py-1.5 hover:bg-white/10 transition-colors inline-flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      <SelectValue className="text-sm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brief">Brief</SelectItem>
                      <SelectItem value="explainer">Explainer</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Tone */}
                  <Select
                    value={projectParams.tone}
                    onValueChange={(val) =>
                      setProjectParams({ ...projectParams, tone: val })
                    }
                  >
                    <SelectTrigger className="bg-white/5 border border-white/10 rounded-full text-sm px-3 py-1.5 hover:bg-white/10 transition-colors inline-flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4" />
                      <SelectValue className="text-sm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="humorous">Humorous</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Audience */}
                  <Select
                    value={projectParams.targetAudience}
                    onValueChange={(val) =>
                      setProjectParams({
                        ...projectParams,
                        targetAudience: val,
                      })
                    }
                  >
                    <SelectTrigger className="bg-white/5 border border-white/10 rounded-full text-sm px-3 py-1.5 hover:bg-white/10 transition-colors inline-flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <SelectValue className="text-sm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="professionals">
                        Professionals
                      </SelectItem>
                      <SelectItem value="students">Students</SelectItem>
                      <SelectItem value="kids">Kids</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Whiteboard Config Panel & Preview */}
                {projectParams.style === "whiteboard" && (
                  <div className="space-y-4">
                    <WhiteboardConfigPanel
                      config={whiteboardConfig}
                      onChange={(updates) =>
                        setWhiteboardConfig(updates)
                      }
                    />

                    {/* Whiteboard Preview */}
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">Preview</h4>
                      <div className="relative rounded-lg bg-black w-full overflow-hidden"
                        style={{
                          aspectRatio: projectParams.aspectRatio === "16:9" ? "16/9" :
                                      projectParams.aspectRatio === "9:16" ? "9/16" : "1/1"
                        }}>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center space-y-2">
                            <div className="text-xs text-muted-foreground">
                              {whiteboardConfig.animStyle} • {whiteboardConfig.handStyle}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {projectParams.aspectRatio}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Input Card */}
                <div className="relative rounded-2xl border border-transparent bg-transparent transition-all duration-300 focus-within:border-white/20 focus-within:bg-white/[0.02] focus-within:shadow-lg focus-within:shadow-primary/5">
                  {/* Textarea */}
                  <textarea
                    value={promptContent}
                    onChange={(e) => {
                      setPromptContent(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height =
                        Math.min(e.target.scrollHeight, 400) + "px";
                    }}
                    placeholder="Describe your video concept, main message, key points, and specific requirements..."
                    className="w-full bg-transparent border-0 resize-none rounded-t-2xl px-5 py-4 text-base placeholder-muted-foreground/40 focus:outline-none focus:ring-0 focus-visible:ring-0 min-h-20 max-h-96 overflow-y-auto"
                    rows={3}
                  />

                  {/* Separator */}
                  <div className="border-t border-white/5" />

                  {/* Bottom Bar */}
                  <div className="px-5 py-3 flex items-center justify-between rounded-b-2xl">
                    {/* Left: Format & Duration Pills */}
                    <div className="flex gap-2 items-center">
                      {/* Aspect Ratio */}
                      <Select
                        value={projectParams.aspectRatio}
                        onValueChange={(val: any) =>
                          setProjectParams({
                            ...projectParams,
                            aspectRatio: val,
                          })
                        }
                      >
                        <SelectTrigger className="bg-white/[0.06] border border-white/10 rounded-full text-xs px-3 py-1 hover:bg-white/10 transition-colors inline-flex items-center gap-1">
                          <LayoutGrid className="w-3 h-3" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16:9">16:9</SelectItem>
                          <SelectItem value="9:16">9:16</SelectItem>
                          <SelectItem value="1:1">1:1</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Duration */}
                      <Select
                        value={projectParams.duration}
                        onValueChange={(val) =>
                          setProjectParams({ ...projectParams, duration: val })
                        }
                      >
                        <SelectTrigger className="bg-white/[0.06] border border-white/10 rounded-full text-xs px-3 py-1 hover:bg-white/10 transition-colors inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-2 minutes">1-2m</SelectItem>
                          <SelectItem value="2-3 minutes">2-3m</SelectItem>
                          <SelectItem value="3-5 minutes">3-5m</SelectItem>
                          <SelectItem value="5-10 minutes">5-10m</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Language */}
                      <Select
                        value={projectParams.language}
                        onValueChange={(val) =>
                          setProjectParams({ ...projectParams, language: val })
                        }
                      >
                        <SelectTrigger className="bg-white/[0.06] border border-white/10 rounded-full text-xs px-3 py-1 hover:bg-white/10 transition-colors inline-flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="it">Italian</SelectItem>
                          <SelectItem value="pt">Portuguese</SelectItem>
                          <SelectItem value="zh">Chinese</SelectItem>
                          <SelectItem value="ja">Japanese</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Right: Send Button */}
                    <button
                      onClick={() => handlePromptSubmit(promptContent)}
                      disabled={!promptContent.trim()}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0",
                        promptContent.trim()
                          ? "bg-white text-background hover:scale-110 active:scale-95 cursor-pointer"
                          : "opacity-40 cursor-not-allowed",
                      )}
                      title="Generate"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16107318 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99021575 L3.03521743,10.4312088 C3.03521743,10.5883061 3.19218622,10.7454035 3.50612381,10.7454035 L16.6915026,11.5308905 C16.6915026,11.5308905 17.1624089,11.5308905 17.1624089,12.0021827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "scriptValidation" && (
            <div className="max-w-5xl mx-auto px-2 space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Review Script</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Validate your script before generating storyboard
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Script Content */}
                <div className="lg:col-span-2">
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="border-b border-border bg-muted/50 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="font-medium text-sm">
                          Generated Script
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {scriptScenes.length > 0
                          ? `${scriptScenes.length} scenes · ${totalScriptDuration}s`
                          : "0 scenes"}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-4 bg-background min-h-screen max-h-screen overflow-y-auto">
                      {scriptScenes.length > 0 ? (
                        <div className="space-y-3">
                          {scriptScenes.map((scene) => (
                            <SceneCard
                              key={scene.index}
                              scene={scene}
                              onChange={(updates) =>
                                updateScene(scene.index, updates)
                              }
                              onRemove={
                                scriptScenes.length > 1
                                  ? () => removeScene(scene.index)
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      ) : isGeneratingScript ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <p className="text-sm">Writing your script...</p>
                        </div>
                      ) : scriptError ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                          <AlertTriangle className="w-6 h-6 text-destructive" />
                          <p className="text-sm text-destructive">{scriptError}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setScriptError(null);
                              setStep("prompt");
                            }}
                          >
                            Back to prompt
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <p>Script will be generated here...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Sidebar */}
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                    <div>
                      <h3 className="font-semibold text-sm mb-2">Status</h3>
                      <div className="flex items-center gap-2 text-sm">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            scriptError
                              ? "bg-destructive"
                              : isGeneratingScript
                                ? "bg-amber-500 animate-pulse"
                                : "bg-green-500",
                          )}
                        />
                        <span className="text-muted-foreground">
                          {scriptError
                            ? "Generation failed"
                            : isGeneratingScript
                              ? "Generating..."
                              : scriptScenes.length > 0
                                ? "Ready to validate"
                                : "Pending generation"}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h3 className="font-semibold text-sm mb-3">Actions</h3>
                      <div className="space-y-2">
                        <Button
                          onClick={() => void handleScriptValidated()}
                          disabled={scriptScenes.length === 0}
                          className="w-full"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Approve Script
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setStep("prompt")}
                          className="w-full"
                        >
                          Edit Prompt
                        </Button>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4 text-xs space-y-2">
                      <p className="font-medium text-foreground">Tips:</p>
                      <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                        <li>Review for clarity</li>
                        <li>Check flow</li>
                        <li>Validate tone</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "storyboard" && (
            <div className="max-w-5xl mx-auto space-y-6 pt-4 h-full overflow-y-auto pb-12">
              {/* Progress Bar */}
              {isGeneratingImages && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm font-medium">
                        Generating clip visuals... {generatingProgress.current} of{" "}
                        {generatingProgress.total}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(
                        (generatingProgress.current /
                          Math.max(1, generatingProgress.total)) *
                          100,
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${(generatingProgress.current / Math.max(1, generatingProgress.total)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold">Storyboard & Timeline Clips</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Customize titles, durations, script narration, and visual prompts for each clip.
                    </p>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setStep("scriptValidation")}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      size="sm"
                    >
                      ← Script
                    </Button>
                    <Button
                      onClick={generateImagesProgressively}
                      disabled={isGeneratingImages}
                      size="sm"
                      variant="outline"
                      title="Generate or update visuals for all clips"
                    >
                      {isGeneratingImages ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
                          Generate Visuals ({editableClips.filter((c) => !c.isSection).length})
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        syncClipsToStore(editableClips, generatedImages);
                        setStep("voiceChoice");
                      }}
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Film className="w-3.5 h-3.5 mr-1.5" />
                      Continue to Voice
                    </Button>
                  </div>
                </div>
              </div>

              {/* Add Clip / Add Section Toolbar */}
              <div className="flex items-center justify-between border-y border-border/50 py-3 px-2">
                <div className="text-xs text-muted-foreground font-medium">
                  {editableClips.filter((c) => !c.isSection).length} Clips • Total Duration:{" "}
                  {editableClips
                    .filter((c) => !c.isSection)
                    .reduce((acc, c) => acc + (c.duration || 5), 0)}s
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => addClip()}
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Clip
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => addSection()}
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    + Section Header
                  </Button>
                </div>
              </div>

              {/* Clips & Sections List */}
              <div className="space-y-4">
                {editableClips.map((item, i) => (
                  <div key={item.id || `item-${i}`} className="space-y-2">
                    <div
                      className={`group rounded-xl p-4 transition-all ${
                        item.isSection
                          ? "bg-muted/20 border border-border/50 flex items-center justify-between"
                          : "bg-gradient-to-br from-card to-card/60 border border-border hover:border-primary/50 hover:shadow-lg flex flex-col gap-4"
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 text-sm">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            {/* Editable Title */}
                            <input
                              type="text"
                              value={item.title || ""}
                              onChange={(e) => updateClipField(i, { title: e.target.value })}
                              className="text-base font-semibold bg-transparent border-b border-transparent hover:border-border/60 focus:border-primary focus:outline-none px-1 py-0.5 w-full max-w-sm transition-colors text-foreground"
                              placeholder={`Clip ${i + 1} title...`}
                            />
                            {/* Clip Type Badge / Selector */}
                            <Select
                              value={item.clipType || "content"}
                              onValueChange={(val) =>
                                updateClipField(i, { clipType: val, isSection: val === "section" })
                              }
                            >
                              <SelectTrigger className="w-28 h-7 text-xs bg-primary/10 border-0 text-primary font-medium rounded-full px-2.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="intro">Intro</SelectItem>
                                <SelectItem value="content">Content</SelectItem>
                                <SelectItem value="outro">Outro</SelectItem>
                                <SelectItem value="section">Section</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveClip(i, "up")}
                            disabled={i === 0}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Move up"
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveClip(i, "down")}
                            disabled={i === editableClips.length - 1}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Move down"
                          >
                            ↓
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => duplicateClip(i)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Duplicate clip"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteClip(i)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Delete clip"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Content - Horizontal / Grid Layout for non-section clips */}
                      {!item.isSection && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left Column: Image Preview + Duration */}
                          <div className="flex flex-col gap-3">
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border/40 bg-gradient-to-br from-muted/20 via-card to-muted/20 flex items-center justify-center group/img hover:border-border/60 transition-all duration-300">
                              {generatedImages[i] ? (
                                <Image
                                  src={generatedImages[i]}
                                  alt={`Visual for ${item.title || i + 1}`}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-2 text-center p-4">
                                  {isGeneratingImages && generatingProgress.current > i ? (
                                    <>
                                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                      <p className="text-xs text-muted-foreground">Generating visual...</p>
                                    </>
                                  ) : (
                                    <>
                                      <Film className="w-6 h-6 text-muted-foreground/40" />
                                      <p className="text-xs text-muted-foreground">Visual preview ready</p>
                                    </>
                                  )}
                                </div>
                              )}
                              {/* Overlay Regenerate Button */}
                              <button
                                onClick={() => regenerateImageForClip(i)}
                                className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm border border-border hover:bg-muted text-foreground rounded-lg px-2 py-1 text-xs flex items-center gap-1.5 shadow-md"
                                title="Regenerate image for this clip"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Regenerate</span>
                              </button>
                            </div>

                            {/* Duration Selector */}
                            <div className="flex items-center justify-between bg-muted/30 border border-border/50 rounded-lg px-3 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">
                                  Clip Duration:
                                </span>
                              </div>
                              <Select
                                value={String(item.duration || 5)}
                                onValueChange={(val) =>
                                  updateClipField(i, { duration: Number(val) })
                                }
                              >
                                <SelectTrigger className="h-7 text-xs bg-background border-border/60 rounded-md w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="3">3 seconds</SelectItem>
                                  <SelectItem value="5">5 seconds</SelectItem>
                                  <SelectItem value="8">8 seconds</SelectItem>
                                  <SelectItem value="10">10 seconds</SelectItem>
                                  <SelectItem value="12">12 seconds</SelectItem>
                                  <SelectItem value="15">15 seconds</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Right Column: Script Narration & Visual Prompt */}
                          <div className="flex flex-col gap-3">
                            {/* Script Narration */}
                            <div>
                              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                Script Narration
                              </label>
                              <textarea
                                value={item.summary || item.narration || ""}
                                onChange={(e) =>
                                  updateClipField(i, {
                                    summary: e.target.value,
                                    narration: e.target.value,
                                  })
                                }
                                placeholder="Voice narration for this clip..."
                                className="w-full text-xs bg-muted/40 border border-border/50 rounded-lg p-2.5 resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors text-foreground"
                                rows={3}
                              />
                            </div>

                            {/* Visual Prompt */}
                            <div>
                              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                Visual Prompt
                              </label>
                              <textarea
                                value={item.visualPrompt || item.summary || ""}
                                onChange={(e) =>
                                  updateClipField(i, { visualPrompt: e.target.value })
                                }
                                placeholder="Visual prompt for AI image generation..."
                                className="w-full text-xs bg-muted/40 border border-border/50 rounded-lg p-2.5 resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors text-foreground"
                                rows={3}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Inline add clip / add section divider */}
                    <div className="flex justify-center py-1 opacity-40 hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        onClick={() => addClip(i)}
                        size="sm"
                        className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
                      >
                        <Plus className="w-3 h-3" /> Insert clip after
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Action Bar */}
              <div className="flex gap-4 pt-4 border-t border-border/50">
                <Button
                  variant="outline"
                  onClick={generateImagesProgressively}
                  disabled={isGeneratingImages}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate All Visuals
                </Button>
                <Button
                  onClick={() => {
                    syncClipsToStore(editableClips, generatedImages);
                    setStep("voiceChoice");
                  }}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Continue to Voice
                </Button>
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
              onNavigateBack={() => setStep("voiceChoice")}
              nextLabel="Save project"
              onNavigateNext={() => void handleSaveProgress()}
            />
          )}

          {step === "voiceChoice" &&
            generatedImages.length > 0 &&
            !isGeneratingNarration && (
              <div className="max-w-7xl mx-auto space-y-6 pt-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <h2 className="text-3xl font-bold">Pick a Voice</h2>
                    <p className="text-muted-foreground">
                      Choose a professional voice for your video narration
                    </p>
                  </div>

                  <div className="flex gap-3 pt-1 shrink-0">
                    <Button
                      variant="outline"
                      onClick={() => setStep("storyboard")}
                      size="sm"
                    >
                      ← Back
                    </Button>
                    <Button
                      onClick={() => handleVoiceSelected(selectedVoice)}
                      className="bg-primary hover:bg-primary/90"
                      size="sm"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Continue
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="lg:col-span-2 space-y-8">
                  {/* Tabs */}
                  <div className="flex gap-2 border-b border-border/50">
                    <button
                      onClick={() => setSelectedVoice("")}
                      className={cn(
                        "px-4 py-2 text-sm font-medium transition-colors",
                        !selectedVoice ||
                          selectedVoice.startsWith("en-us") ||
                          selectedVoice.startsWith("fr-fr")
                          ? "text-foreground border-b-2 border-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Preset Voices
                    </button>
                    <button
                      onClick={() => setSelectedVoice("custom")}
                      className={cn(
                        "px-4 py-2 text-sm font-medium transition-colors",
                        selectedVoice === "custom"
                          ? "text-foreground border-b-2 border-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Your Voice
                    </button>
                  </div>

                  {/* Preset Voices Grid */}
                  {selectedVoice !== "custom" && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {(
                        VOICES_BY_LANGUAGE[projectParams.language] ||
                        VOICES_BY_LANGUAGE["en"]
                      ).map((voice) => (
                        <div
                          key={voice.id}
                          onClick={() => setSelectedVoice(voice.id)}
                          className={cn(
                            "group cursor-pointer transition-all duration-300 rounded-xl border overflow-hidden flex flex-col",
                            "bg-gradient-to-br from-card to-card/60",
                            selectedVoice === voice.id
                              ? "border-foreground/30 shadow-lg"
                              : "border-border/50 hover:border-border/80 hover:shadow-md",
                          )}
                        >
                          {/* Mini Avatar Header */}
                          <div
                            className={cn(
                              "h-40 bg-muted/40 transition-all duration-300 relative overflow-hidden border-b border-border/50",
                              "flex items-center justify-center",
                            )}
                          >
                            <div className="w-20 h-20 rounded-full bg-muted/70 border border-border/50 flex items-center justify-center">
                              <span className="text-4xl font-bold text-foreground/40">
                                {voice.name[0]}
                              </span>
                            </div>
                          </div>

                          {/* Compact Content */}
                          <div className="p-4 flex flex-col flex-1">
                            {/* Name & Selection Badge */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="text-base font-bold text-foreground">
                                {voice.name}
                              </h3>
                              {selectedVoice === voice.id && (
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-foreground/20 flex items-center justify-center">
                                  <Check className="w-3 h-3 text-foreground" />
                                </div>
                              )}
                            </div>

                            {/* Mini Tags */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {(voice as any).tags
                                ?.slice(0, 2)
                                .map((tag: string) => (
                                  <span
                                    key={tag}
                                    className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-foreground/60 font-medium"
                                  >
                                    {tag}
                                  </span>
                                ))}
                            </div>

                            {/* Short Description */}
                            <p className="text-xs text-muted-foreground line-clamp-1 mb-3">
                              {voice.description}
                            </p>

                            {/* Spacer */}
                            <div className="flex-1" />

                            {/* Play Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (previewingVoice === voice.id) {
                                  window.speechSynthesis.cancel();
                                  setPreviewingVoice(null);
                                } else {
                                  setPreviewingVoice(voice.id);
                                  playVoicePreview(voice.id);
                                }
                              }}
                              className={cn(
                                "w-full py-2 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5",
                                "bg-muted/50 hover:bg-muted/70 text-foreground/70 hover:text-foreground",
                                previewingVoice === voice.id && "bg-muted/60",
                              )}
                            >
                              {previewingVoice === voice.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Playing
                                </>
                              ) : (
                                <>
                                  <Film className="w-3 h-3" />
                                  Listen
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Your Voice Upload Section */}
                  {selectedVoice === "custom" && (
                    <div className="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed border-border/50 rounded-xl bg-muted/30">
                      <div className="flex flex-col items-center gap-4 max-w-sm">
                        <div className="w-16 h-16 rounded-full bg-muted/70 border-2 border-border/50 flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-foreground/40"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M19 14v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5m11-4l-4-4m0 0L9 6m4 0v6"
                            />
                          </svg>
                        </div>
                        <div className="text-center">
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            Upload Your Voice
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Clone your unique voice for personalized narration
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            document.getElementById("voice-upload")?.click()
                          }
                          className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-lg transition-colors flex items-center gap-2"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          Choose Audio File
                        </button>
                        <p className="text-xs text-muted-foreground text-center">
                          Supports MP3, WAV, OGG (max 10MB)
                        </p>
                      </div>
                      <input
                        id="voice-upload"
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            toast.success(
                              `Voice "${e.target.files[0].name}" uploaded successfully!`,
                            );
                          }
                        }}
                      />
                    </div>
                  )}
                  </div>

                  {/* La narration se cale sur la voix qu'on vient de choisir :
                      ces deux panneaux vivent donc ici, et non plus dans
                      l'etape whiteboard, qui vient desormais apres. */}
                  <aside className="space-y-4">
                    <AudioPanel />
                    <TranscriptPanel />
                  </aside>
                </div>
              </div>
            )}

          {step === "voiceChoice" && isGeneratingNarration && (
            <div className="flex justify-center pt-12">
              <div className="w-full">
                <div className="w-full max-w-lg mx-auto px-4">
                  <div className="space-y-8">
                    {/* Animated Waveform */}
                    <div className="flex justify-center items-end gap-1 h-20">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 bg-primary rounded-full"
                          style={{
                            height: `${Math.sin(i * 0.5) * 30 + 40}%`,
                            animation: `wave 0.6s ease-in-out infinite`,
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      ))}
                    </div>

                    {/* Title & Description */}
                    <div className="text-center space-y-3">
                      <h2 className="text-3xl font-bold text-foreground">
                        Generating Narration
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Processing your audio with the selected voice
                      </p>
                    </div>

                    {/* Progress Card */}
                    <div className="p-6 border border-border/50 rounded-lg bg-gradient-to-br from-card to-card/60 space-y-6">
                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-muted-foreground">
                            Processing
                          </span>
                          <span className="text-sm font-bold text-primary">
                            {Math.round(narrationProgress)}%
                          </span>
                        </div>
                        <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden border border-border/50">
                          <div
                            className="bg-gradient-to-r from-primary to-primary/70 h-full rounded-full transition-all duration-300"
                            style={{ width: `${narrationProgress}%` }}
                          />
                        </div>
                      </div>

                      {/* Status Steps */}
                      <div className="space-y-3">
                        {[
                          { label: "Preparing audio", min: 0, max: 30 },
                          { label: "Processing voice", min: 30, max: 70 },
                          { label: "Finalizing", min: 70, max: 100 },
                        ].map((step, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0",
                                narrationProgress >= step.max
                                  ? "bg-green-500/20 border border-green-500/50"
                                  : narrationProgress > step.min
                                    ? "bg-primary/20 border border-primary/50"
                                    : "bg-muted border border-border/50",
                              )}
                            >
                              {narrationProgress >= step.max ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : narrationProgress > step.min ? (
                                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                              ) : (
                                <div className="w-2 h-2 bg-muted-foreground rounded-full" />
                              )}
                            </div>
                            <span
                              className={cn(
                                "text-sm transition-colors font-medium",
                                narrationProgress >= step.max
                                  ? "text-green-600 dark:text-green-400"
                                  : narrationProgress > step.min
                                    ? "text-foreground"
                                    : "text-muted-foreground",
                              )}
                            >
                              {step.label}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Estimated Time */}
                      <div className="pt-4 border-t border-border/30">
                        <p className="text-xs text-center text-muted-foreground">
                          Estimated time remaining: ~
                          {Math.max(
                            1,
                            Math.round((100 - narrationProgress) / 20),
                          )}
                          s
                        </p>
                      </div>
                    </div>
                  </div>

                  <style>{`
                  @keyframes wave {
                    0%, 100% { transform: scaleY(0.5); opacity: 0.6; }
                    50% { transform: scaleY(1); opacity: 1; }
                  }
                `}</style>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* Export Modal - Using existing component */}
        <ExportModal
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
                  quality: resolution,
                  aspectRatio: projectParams.aspectRatio,
                  project,
                }),
              });
              if (!res.ok) {
                throw new Error((await res.json()).error || "Export refuse");
              }
              const { jobId } = await res.json();
              renderJobIdRef.current = jobId;
              setExportPhase("encoding");

              // Interrogation plutot qu'un websocket : un rendu dure des
              // minutes, une seconde de latence sur une barre ne se voit pas.
              for (;;) {
                await new Promise((r) => setTimeout(r, 1000));
                if (renderJobIdRef.current !== jobId) return;
                const r = await fetch(`/api/whiteboard/render/${jobId}`);
                // Sans ce controle la boucle tournait a l'infini : sur un 404
                // — serveur redemarre en plein rendu, dossier des rendus vide —
                // le corps est {error}, donc `status` vaut undefined, aucune
                // branche de sortie ne se declenche et la barre reste a 0 %
                // pour toujours, sans le moindre message.
                if (!r.ok) {
                  throw new Error(
                    r.status === 404
                      ? "Le rendu a ete perdu par le serveur"
                      : `Suivi du rendu impossible (${r.status})`
                  );
                }
                const s = await r.json();
                setExportProgress(s.progress ?? 0);
                if (s.status === "done") {
                  setDownloadUrl(`/api/whiteboard/render/${jobId}/file`);
                  setExportPhase("complete");
                  break;
                }
                if (s.status === "error") {
                  throw new Error(s.error || "Le rendu a echoue");
                }
                if (s.status === "cancelled") {
                  setExportPhase("idle");
                  break;
                }
              }
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Export echoue"
              );
              setExportPhase("idle");
            } finally {
              setIsExporting(false);
            }
          }}
          isExporting={isExporting}
          exportProgress={exportProgress}
          exportPhase={exportPhase}
          downloadUrl={downloadUrl}
          onCancel={() => {
            const id = renderJobIdRef.current;
            // Remis a null AVANT la requete : la boucle d'interrogation compare
            // cette reference et s'arrete d'elle-meme.
            renderJobIdRef.current = null;
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
