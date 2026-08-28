"use client";

import { useState, useEffect } from "react";
import { ExportModal } from "@/lib/editor/components/export-modal";
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
} from "lucide-react";
import Image from "next/image";
import { DEMO_FINAL_SEQUENCE } from "@/lib/demo-data";
import { saveSession, loadSession, clearSession } from "@/lib/session-storage";
import { useToastContext } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { AppShell } from "@/lib/app-shell";
import { DevPanel } from "@/lib/dev-panel";
import { useRouter } from "next/navigation";
import { Editor } from "@/lib/editor/components/editor";
import { useStoryboardStore } from "@/lib/storyboard/store";

const STEPS = [
  { key: "prompt", label: "Prompt", icon: Wand2 },
  { key: "scriptValidation", label: "Script", icon: Settings },
  { key: "storyboard", label: "Storyboard", icon: Layers },
  { key: "voiceChoice", label: "Voice", icon: Film },
  { key: "editor", label: "Editor", icon: Film },
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
    },
    {
      id: "fr-female-1",
      name: "Marie",
      description: "Voix féminine professionnelle",
    },
  ],
  es: [
    {
      id: "es-male-1",
      name: "Carlos",
      description: "Voz masculina profesional",
    },
    {
      id: "es-female-1",
      name: "Rosa",
      description: "Voz femenina profesional",
    },
  ],
  de: [
    {
      id: "de-male-1",
      name: "Klaus",
      description: "Professionelle Männerstimme",
    },
    {
      id: "de-female-1",
      name: "Anna",
      description: "Professionelle Frauenstimme",
    },
  ],
  it: [
    {
      id: "it-male-1",
      name: "Marco",
      description: "Voce maschile professionale",
    },
    {
      id: "it-female-1",
      name: "Giulia",
      description: "Voce femminile professionale",
    },
  ],
  pt: [
    {
      id: "pt-male-1",
      name: "João",
      description: "Voz masculina profissional",
    },
    {
      id: "pt-female-1",
      name: "Marta",
      description: "Voz feminina profissional",
    },
  ],
  zh: [
    { id: "zh-male-1", name: "Wei", description: "Professional Male Voice" },
    {
      id: "zh-female-1",
      name: "Yan",
      description: "Professional Female Voice",
    },
  ],
  ja: [
    {
      id: "ja-male-1",
      name: "Takeshi",
      description: "Professional Male Voice",
    },
    {
      id: "ja-female-1",
      name: "Yuki",
      description: "Professional Female Voice",
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
    script,
    setScript,
    storyboardPanels,
    setStoryboardPanels,
    updatePanel,
    selectedVoice,
    setSelectedVoice,
    loadDemoData,
    resetWorkflow,
    getMediaList,
    getClipList,
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

  useEffect(() => {
    if (!hasLoadedSession) {
      setHasLoadedSession(true);
      const session = loadSession();
      if (session) {
        setStep(session.step);
        if (session.promptContent) setPromptContent(session.promptContent);
        if (session.script) setScript(session.script);
        if (session.storyboardData) setStoryboardData(session.storyboardData);
        if (session.generatedImages) setGeneratedImages(session.generatedImages);
        if (session.selectedVoice) setSelectedVoice(session.selectedVoice);
        toast.success("Session restored from previous work");
      }
    }
  }, [toast]);

  // Auto-generate demo script when reaching validation step
  useEffect(() => {
    if (step === "scriptValidation" && !script) {
      setScript(generateDemoScript());
    }
  }, [step]);

  // Initialize editable clips when storyboardData changes
  useEffect(() => {
    if (storyboardData?.storyboard?.clipOutlines) {
      setEditableClips(storyboardData.storyboard.clipOutlines);
    }
  }, [storyboardData]);

  const deleteClip = (index: number) => {
    setEditableClips(editableClips.filter((_, i) => i !== index));
  };

  const addClip = (afterIndex?: number) => {
    const newClip = {
      index: editableClips.length,
      clipType: "content" as const,
      title: `Clip ${editableClips.length + 1}`,
      summary: "New clip description",
      isSection: false,
    };
    if (afterIndex !== undefined) {
      const newClips = [...editableClips];
      newClips.splice(afterIndex + 1, 0, newClip);
      setEditableClips(newClips);
    } else {
      setEditableClips([...editableClips, newClip]);
    }
  };

  const addSection = (afterIndex?: number) => {
    const newSection = {
      index: editableClips.length,
      clipType: "section" as const,
      title: "New Section",
      summary: "",
      isSection: true,
    };
    if (afterIndex !== undefined) {
      const newClips = [...editableClips];
      newClips.splice(afterIndex + 1, 0, newSection);
      setEditableClips(newClips);
    } else {
      setEditableClips([...editableClips, newSection]);
    }
  };

  const moveClip = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= editableClips.length) return;

    const newClips = [...editableClips];
    [newClips[fromIndex], newClips[toIndex]] = [
      newClips[toIndex],
      newClips[fromIndex],
    ];
    setEditableClips(newClips);
  };

  const generateImagesProgressively = async () => {
    const demoImages = DEMO_FINAL_SEQUENCE.storyboard.map((p) => p.imageUrl);
    const totalToGenerate = Math.min(
      demoImages.length,
      storyboardData?.storyboard.clipOutlines.length || 0,
    );

    setIsGeneratingImages(true);
    setGeneratingProgress({ current: 0, total: totalToGenerate });
    const newImages: string[] = [];

    for (let i = 0; i < totalToGenerate; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      newImages.push(demoImages[i]);
      setGeneratedImages([...newImages]);
      setGeneratingProgress({ current: i + 1, total: totalToGenerate });
    }

    setIsGeneratingImages(false);
  };

  const regenerateImageForClip = async (clipIndex: number) => {
    const demoImages = DEMO_FINAL_SEQUENCE.panels.map((p) => p.imageUrl);
    if (demoImages[clipIndex]) {
      const newImages = [...generatedImages];
      newImages[clipIndex] = demoImages[clipIndex];
      setGeneratedImages(newImages);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
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
    saveSession({
      step: "scriptValidation",
      promptContent: content,
      projectParams,
    });
  };

  const handleScriptValidated = async (validatedScript: string) => {
    const finalScript = validatedScript || generateDemoScript();
    setScript(finalScript);

    // Auto-generate storyboard from script
    try {
      const response = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: promptContent,
          style: projectParams.style,
          format: projectParams.format,
          aspectRatio: projectParams.aspectRatio,
          language: projectParams.language,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setStoryboardData({
          storyboard: data.storyboard,
          content: promptContent,
          params: projectParams,
        });
      }
    } catch (error) {
      console.error("Error generating storyboard:", error);
    }

    setStep("storyboard");
    saveSession({
      step: "storyboard",
      promptContent,
      script: finalScript,
    });
  };

  const generateDemoScript = () => {
    return `SCENE 1: OPENING
Narrator: "Welcome to an exciting journey of discovery. Today, we're exploring ideas that will transform the way you think."

SCENE 2: CONTEXT
Narrator: "Let's start with the fundamentals. Understanding these core concepts is crucial to everything that follows."

SCENE 3: MAIN POINT 1
Narrator: "First, consider how this principle works in real-world scenarios. Notice the pattern emerging."

SCENE 4: EXAMPLE
Narrator: "Here's a practical example that demonstrates this perfectly. Pay attention to the details."

SCENE 5: KEY INSIGHT
Narrator: "This insight changes everything. It's the turning point in our understanding."

SCENE 6: CONCLUSION
Narrator: "As we've seen, these concepts work together harmoniously. Remember these key takeaways as you move forward."`
      .split("\n")
      .join("\n");
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
    saveSession({
      step: "voiceChoice",
      storyboardData: data,
      generatedImages: images,
    });
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
        setStep("editor");
        saveSession({ step: "editor", selectedVoice: voiceId });
      }, 500);
    }, 3000);
  };

  const handleSaveProgress = () => {
    saveSession({
      step,
      promptContent: promptContent || undefined,
      script: script || undefined,
      storyboardData: storyboardData || undefined,
      generatedImages: generatedImages.length > 0 ? generatedImages : undefined,
      selectedVoice: selectedVoice || undefined,
    });
    toast.success("Progress saved to browser storage");
  };

  const handleClearSession = () => {
    if (confirm("Clear all saved progress? This cannot be undone.")) {
      clearSession();
      setStep("prompt");
      setPromptContent("");
      setScript("");
      setStoryboardData(null);
      setGeneratedImages([]);
      setSelectedVoice("default");
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
    if (index === 2) return !!script;
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

        <main
          className={cn(
            step === "editor" ? "w-full p-0 max-w-none flex-1" : "px-2 py-4",
          )}
        >
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
                        {script
                          ? `${script.split("\n").length} lines`
                          : "0 lines"}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-4 bg-background min-h-screen max-h-screen overflow-y-auto">
                      {script ? (
                        <div className="space-y-0 text-sm font-mono text-foreground/90">
                          {script.split("\n").map((line, i) => (
                            <div key={i} className="flex gap-3 items-start">
                              <span className="text-muted-foreground/60 select-none min-w-12 text-right shrink-0">
                                {i + 1}
                              </span>
                              <span>{line || " "}</span>
                            </div>
                          ))}
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
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-muted-foreground">
                          {script ? "Ready to validate" : "Pending generation"}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h3 className="font-semibold text-sm mb-3">Actions</h3>
                      <div className="space-y-2">
                        <Button
                          onClick={() => handleScriptValidated(script)}
                          disabled={!script}
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

          {step === "storyboard" && !storyboardData && (
            <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                Generating storyboard from your script...
              </p>
            </div>
          )}

          {step === "storyboard" && storyboardData && (
            <div className="max-w-5xl mx-auto space-y-8 pt-6 h-full overflow-y-auto">
              {/* Progress Bar */}
              {isGeneratingImages && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm font-medium">
                        Generating images... {generatingProgress.current} of{" "}
                        {generatingProgress.total}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(
                        (generatingProgress.current /
                          generatingProgress.total) *
                          100,
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${(generatingProgress.current / generatingProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold">Storyboard</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Review and customize each clip
                    </p>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="ghost"
                      onClick={() => setStep("scriptValidation")}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      size="sm"
                    >
                      ← Script
                    </Button>
                    {generatedImages.length > 0 ? (
                      <Button
                        onClick={() => {
                          setStep("voiceChoice");
                          saveSession({
                            step: "voiceChoice",
                            storyboardData,
                            generatedImages,
                          });
                        }}
                        size="sm"
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Film className="w-3.5 h-3.5 mr-1.5" />
                        Continue to Voice
                      </Button>
                    ) : (
                      <Button
                        onClick={generateImagesProgressively}
                        disabled={isGeneratingImages}
                        size="sm"
                        title={`Generate ${editableClips.length} images`}
                      >
                        {isGeneratingImages ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                            Generate ({editableClips.length})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Add Clip Button */}
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  onClick={() => addClip()}
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  + Clip
                </Button>
              </div>

              {/* Clips & Sections */}
              <div className="grid gap-4">
                {editableClips.map((item, i) => (
                  <>
                    <div
                      key={i}
                      className={`group rounded-xl p-4 transition-all ${
                        item.isSection
                          ? "bg-muted/20 border border-border/50"
                          : "bg-gradient-to-br from-card to-card/50 border border-border hover:border-primary/50 hover:shadow-lg flex flex-col"
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-semibold text-primary">
                            {i + 1}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">
                              {item.title}
                            </h3>
                            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium capitalize inline-block mt-1">
                              {item.clipType}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveClip(i, "up")}
                            disabled={i === 0}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveClip(i, "down")}
                            disabled={i === editableClips.length - 1}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          >
                            ↓
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteClip(i)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            ✕
                          </Button>
                        </div>
                      </div>

                      {/* Content - Horizontal Layout */}
                      {!item.isSection && (
                        <div className="flex gap-4">
                          {/* Left: Image Preview + Bottom Info */}
                          <div className="flex-1 min-w-0 flex flex-col gap-2">
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border/40 bg-gradient-to-br from-muted/20 via-card to-muted/20 flex items-center justify-center group hover:border-border/60 hover:from-muted/30 hover:via-card hover:to-muted/30 transition-all duration-300">
                              {generatedImages[i] ? (
                                <Image
                                  src={generatedImages[i]}
                                  alt={`Visual for ${item.title}`}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-2 text-center">
                                  {isGeneratingImages &&
                                  generatingProgress.current > i ? (
                                    <>
                                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                      <p className="text-xs text-muted-foreground">
                                        Generating...
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <Film className="w-5 h-5 text-muted-foreground/40" />
                                      <p className="text-xs text-muted-foreground">
                                        Ready for image
                                      </p>
                                    </>
                                  )}
                                </div>
                              )}
                              {/* Regenerate Button - Overlay */}
                              <button
                                onClick={() => regenerateImageForClip(i)}
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg p-1.5"
                                title="Regenerate image for this clip"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Duration Badge & Description - Below Image */}
                            <div className="space-y-2">
                              <div className="inline-block px-2 py-1 rounded-md bg-muted/50 border border-border/50">
                                <span className="text-xs font-medium text-muted-foreground">
                                  5 sec
                                </span>
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                  Description
                                </label>
                                <textarea
                                  defaultValue={item.summary}
                                  placeholder="Visual description"
                                  className="w-full text-xs bg-muted/50 border border-border/50 rounded-lg p-2 resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                  rows={2}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Right: Narration & Visual Prompt */}
                          <div className="w-1/3 flex flex-col gap-3">
                            {/* Narration */}
                            <div>
                              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                Narration
                              </label>
                              <div className="w-full text-xs bg-muted/30 border border-border/50 rounded-lg p-2 italic text-foreground/80 min-h-16 flex items-center">
                                {item.summary ||
                                  "Narration will be extracted..."}
                              </div>
                            </div>

                            {/* Visual Prompt */}
                            <div>
                              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                Visual Prompt
                              </label>
                              <textarea
                                defaultValue={item.summary}
                                placeholder="Describe the visual style..."
                                className="w-full text-xs bg-muted/50 border border-border/50 rounded-lg p-2 resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                rows={3}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {i < editableClips.length - 1 && (
                      <div className="flex justify-center py-2">
                        <Button
                          variant="ghost"
                          onClick={() => addSection(i)}
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {item.isSection ? "↓ Clip" : "↓ Section"}
                        </Button>
                      </div>
                    )}
                  </>
                ))}
              </div>

              {/* Action Buttons - Only when images are generated */}
              {generatedImages.length > 0 && (
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setGeneratedImages([]);
                    }}
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                  <Button
                    onClick={() =>
                      handleStoryboardGenerated(
                        storyboardData.storyboard,
                        storyboardData.content,
                        storyboardData.params,
                        generatedImages,
                      )
                    }
                    disabled={generatedImages.length === 0}
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Continue to Voice
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === "voiceChoice" &&
            generatedImages.length > 0 &&
            !isGeneratingNarration && (
              <div className="max-w-5xl mx-auto space-y-6 pt-6">
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

                <div className="space-y-8">
                  {/* Tabs */}
                  <div className="flex gap-2 border-b border-border/50">
                    <button
                      onClick={() => setSelectedVoice(null)}
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

          {step === "editor" && (
            <div className="w-full h-full overflow-hidden px-48">
              <Editor
                initialMedia={getMediaList()}
                initialClips={getClipList()}
                initialStoryboard={(storyboardPanels.length > 0
                  ? storyboardPanels
                  : DEMO_FINAL_SEQUENCE.storyboard
                ).map((p, i) => ({
                  id: p.id || `sb-${i}`,
                  prompt: p.prompt,
                  imageUrl: p.imageUrl,
                  linkedImageUrl: p.linkedImageUrl,
                  videoUrl: p.videoUrl,
                  mediaId: `media-video-${p.id || i}`,
                  status: "idle" as const,
                  type: p.linkedImageUrl
                    ? ("transition" as const)
                    : ("scene" as const),
                  duration: p.duration as 5 | 8,
                }))}
                onBack={() => setStep("voiceChoice")}
              />
            </div>
          )}

          {step === "editor-summary" && (
            <div className="max-w-6xl mx-auto space-y-6 pt-6">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <h2 className="text-3xl font-bold">Project Summary</h2>
                  <p className="text-muted-foreground">
                    Review your generated video content before editing
                  </p>
                </div>

                <div className="flex gap-3 pt-1 shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => setStep("voiceChoice")}
                    size="sm"
                  >
                    ← Back
                  </Button>
                  <Button
                    onClick={() => setStep("editor")}
                    className="bg-primary hover:bg-primary/90"
                    size="sm"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Open Timeline
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Project Settings Overview */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 border border-border/50 rounded-lg bg-card/50">
                      <p className="text-xs text-muted-foreground mb-1">
                        Format
                      </p>
                      <p className="font-semibold capitalize text-sm">
                        {projectParams.format}
                      </p>
                    </div>
                    <div className="p-4 border border-border/50 rounded-lg bg-card/50">
                      <p className="text-xs text-muted-foreground mb-1">
                        Language
                      </p>
                      <p className="font-semibold uppercase text-sm">
                        {projectParams.language}
                      </p>
                    </div>
                    <div className="p-4 border border-border/50 rounded-lg bg-card/50">
                      <p className="text-xs text-muted-foreground mb-1">
                        Duration
                      </p>
                      <p className="font-semibold text-sm">
                        {projectParams.duration}
                      </p>
                    </div>
                    <div className="p-4 border border-border/50 rounded-lg bg-card/50">
                      <p className="text-xs text-muted-foreground mb-1">
                        Style
                      </p>
                      <p className="font-semibold capitalize text-sm">
                        {projectParams.style}
                      </p>
                    </div>
                  </div>

                  {/* Storyboard Preview */}
                  {generatedImages.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Layers className="w-5 h-5" />
                          Storyboard ({generatedImages.length} images)
                        </h3>
                      </div>

                      {(() => {
                        const imagesPerPage = 6;
                        const totalPages = Math.ceil(
                          generatedImages.length / imagesPerPage,
                        );
                        const startIdx = storyboardPage * imagesPerPage;
                        const endIdx = startIdx + imagesPerPage;
                        const visibleImages = generatedImages.slice(
                          startIdx,
                          endIdx,
                        );

                        return (
                          <div className="space-y-4">
                            {/* Pagination Top */}
                            {totalPages > 1 && (
                              <div className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-muted/20">
                                <span className="text-xs text-muted-foreground">
                                  Showing {startIdx + 1}–
                                  {Math.min(endIdx, generatedImages.length)} of{" "}
                                  {generatedImages.length}
                                </span>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setStoryboardPage(
                                        Math.max(0, storyboardPage - 1),
                                      )
                                    }
                                    disabled={storyboardPage === 0}
                                  >
                                    ← Prev
                                  </Button>
                                  <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }).map(
                                      (_, i) => (
                                        <button
                                          key={i}
                                          onClick={() => setStoryboardPage(i)}
                                          className={cn(
                                            "w-7 h-7 rounded text-xs font-medium transition-colors",
                                            storyboardPage === i
                                              ? "bg-primary text-primary-foreground"
                                              : "bg-muted hover:bg-muted/80 text-foreground/60",
                                          )}
                                        >
                                          {i + 1}
                                        </button>
                                      ),
                                    )}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setStoryboardPage(
                                        Math.min(
                                          totalPages - 1,
                                          storyboardPage + 1,
                                        ),
                                      )
                                    }
                                    disabled={storyboardPage === totalPages - 1}
                                  >
                                    Next →
                                  </Button>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                              {visibleImages.map((img, idx) => {
                                const actualIdx = startIdx + idx;
                                const durationPerScene = Math.round(
                                  (parseInt(
                                    projectParams.duration.split("-")[1],
                                  ) *
                                    60) /
                                    generatedImages.length,
                                );
                                return (
                                  <div
                                    key={actualIdx}
                                    className="relative h-40 rounded-lg overflow-hidden border border-border/50 bg-card group"
                                  >
                                    <Image
                                      src={img}
                                      alt={`Scene ${actualIdx + 1}`}
                                      fill
                                      className="object-cover"
                                    />
                                    {/* Duration Badge */}
                                    <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm">
                                      <span className="text-xs font-semibold text-white">
                                        {durationPerScene}s
                                      </span>
                                    </div>
                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <span className="text-white text-sm font-medium">
                                        Scene {actualIdx + 1}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Right Sidebar - Voice Selection */}
                <div className="lg:col-span-1">
                  <div className="sticky top-6 p-4 border border-border/50 rounded-lg bg-gradient-to-br from-card to-card/60 space-y-3 flex flex-col">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Film className="w-4 h-4" />
                      Narration Voice
                    </h3>

                    {selectedVoice === "custom" ? (
                      <div className="flex items-center gap-3 p-3 border border-border/30 rounded-lg bg-muted/20">
                        <div className="w-10 h-10 rounded-full bg-muted/70 border border-border/50 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-foreground/40"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs">Your Voice</p>
                          <p className="text-xs text-muted-foreground truncate">
                            Custom narration
                          </p>
                        </div>
                      </div>
                    ) : (
                      (() => {
                        const voice = (
                          VOICES_BY_LANGUAGE[projectParams.language] ||
                          VOICES_BY_LANGUAGE["en"]
                        ).find((v) => v.id === selectedVoice);
                        return voice ? (
                          <div className="flex items-center gap-3 p-3 border border-border/30 rounded-lg bg-muted/20">
                            <div className="w-10 h-10 rounded-full bg-muted/70 border border-border/50 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-foreground/40">
                                {voice.name[0]}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs">
                                {voice.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate line-clamp-1">
                                {voice.description}
                              </p>
                            </div>
                          </div>
                        ) : null;
                      })()
                    )}

                    {selectedVoice !== "custom" && (
                      <button
                        onClick={() => {
                          if (previewingVoice === selectedVoice) {
                            window.speechSynthesis.cancel();
                            setPreviewingVoice(null);
                          } else {
                            setPreviewingVoice(selectedVoice);
                            playVoicePreview(selectedVoice);
                          }
                        }}
                        className={cn(
                          "w-full p-3 rounded-lg border transition-all",
                          "flex items-center justify-center gap-2",
                          previewingVoice === selectedVoice
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/30 border-muted/50 hover:bg-muted/50 hover:border-border",
                        )}
                      >
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                            previewingVoice === selectedVoice
                              ? "bg-primary-foreground/20"
                              : "bg-foreground/10",
                          )}
                        >
                          {previewingVoice === selectedVoice ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs font-semibold">
                          {previewingVoice === selectedVoice
                            ? "Playing"
                            : "Play"}
                        </span>
                      </button>
                    )}

                    {/* Project Details */}
                    <div className="pt-2 border-t border-border/30 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Tone</span>
                        <span className="font-semibold capitalize">
                          {projectParams.tone}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Audience</span>
                        <span className="font-semibold capitalize">
                          {projectParams.targetAudience}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Ratio</span>
                        <span className="font-semibold">
                          {projectParams.aspectRatio}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-semibold">
                          {(() => {
                            const minutes = parseInt(
                              projectParams.duration.split("-")[1],
                            );
                            return `${minutes * 60}s`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Export Modal - Using existing component */}
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          onStartExport={(resolution) => {
            toast.success(`Exporting in ${resolution}...`);
            setExportPhase("init");
            setIsExporting(true);
            // TODO: Implement actual export logic
            setTimeout(() => {
              setExportPhase("complete");
              setIsExporting(false);
              setDownloadUrl("video.mp4");
            }, 2000);
          }}
          isExporting={isExporting}
          exportProgress={exportProgress}
          exportPhase={exportPhase}
          downloadUrl={downloadUrl}
          onCancel={() => {
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
