"use client";

import { useState, useEffect, useRef } from "react";
import { ExportModal } from "@/lib/editor/components/export-modal";
import { toRenderProject } from "@/lib/whiteboard-animation/server/to-render-project";
import { ShortcutsModal } from "@/lib/editor/components/shortcuts-modal";
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
import { useProjectSync } from "@/lib/storyboard/use-project-sync";
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
import { tailleCanvas } from "@/lib/whiteboard-animation/canvas-size";
import { WhiteboardEditorStep } from "@/lib/whiteboard-animation/components/whiteboard-editor-step";
import { AudioPanel } from "@/lib/whiteboard-animation/components/audio-panel";

const STEPS = [
  { key: "prompt", label: "Prompt", icon: Wand2 },
  { key: "storyboard", label: "Storyboard", icon: Layers },
  { key: "whiteboard", label: "Whiteboard", icon: Settings },
] as const;

/**
 * Les voix reellement disponibles, dans l'ordre du catalogue.
 *
 * L'ecran presentait auparavant 18 personas inventes ranges par langue (Ron,
 * Pierre, Takeshi...) : le choix se faisait sur une fiction, et deux personas
 * pouvaient rendre le meme son. Ces voix-ci sont multilingues — la meme lit le
 * francais et l'anglais — donc aucun classement par langue n'a de sens, et
 * aucune description de timbre n'est donnee : l'apercu audio en est la seule
 * source honnete.
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

/** La langue dans laquelle la voix lira le script, telle qu'on la nomme. */
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  fr: "French",
};

/**
 * Ce que dit l'apercu quand le script est encore vide.
 *
 * Il etait en francais en dur : sur un projet anglais, on jugeait une voix sur
 * une phrase qui n'etait pas dans la langue qu'elle lira.
 */
const PREVIEW_FALLBACK: Record<string, string> = {
  en: "Here is a preview of this narration voice.",
  fr: "Voici un apercu de cette voix de narration.",
};

/**
 * La part de la barre de progression qui revient a la synthese. Le reste va au
 * placement des annotations, qui suit dans le meme temps d'attente : deux
 * barres qui repartent de zero donnaient l'impression d'une etape bloquee.
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
    setProjectTitle,
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
  const [generatingProgress, setGeneratingProgress] = useState({
    current: 0,
    total: 0,
  });
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [isGeneratingNarration, setIsGeneratingNarration] = useState(false);
  const [isPlanningAnnotations, setIsPlanningAnnotations] = useState(false);
  const [narrationProgress, setNarrationProgress] = useState(0);

  // Le projet vit en base : useProjectSync le charge (ou le cree), tient le
  // bail d'edition et ecrit chaque changement du store.
  const projectSync = useProjectSync();

  const scriptWordCount = scriptText.trim()
    ? scriptText.trim().split(/\s+/).length
    : 0;

  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Le script est ecrit par l'agent a partir du prompt et des parametres. Le
  // garde sur les scenes deja presentes evite de regenerer — donc de repayer un
  // appel modele — en revenant sur l'etape depuis le storyboard.
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
        setScriptError(body.error ?? `HTTP ${response.status}`);
        return;
      }
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
        // Une image absente le reste : la remplacer par un visuel de
        // demonstration l'enregistrait en base comme s'il avait ete produit.
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
          // La voix, par image et par temps : sans ces deux champs elle etait
          // produite puis perdue au premier enregistrement.
          audioUrl: clip.audioUrl,
          audioDurationMs: clip.audioDurationMs,
          beats: clip.beats,
          // Les annotations vivent par image : c'est ce que l'editeur et le
          // rendu lisent, whiteboardConfig.annotations n'etant qu'un repli
          // commun a toutes.
          annotations: clip.annotations,
        };
      });
    setStoryboardPanels(panels);
    return panels;
  };

  /**
   * Rend les clips et leurs images a partir de ce qui est enregistre.
   *
   * Sans garde d'etape : ce ne sont que les panneaux du projet relus autrement,
   * et l'etape courante n'a pas a decider si on les connait. La garde
   * `step !== "storyboard"` d'avant laissait `generatedImages` vide partout
   * ailleurs — or l'etape voix ne se rend que s'il est rempli, donc un
   * rechargement sur la voix donnait une page BLANCHE, et le retour en arriere
   * etait ferme lui aussi (canNavigateToStep en depend).
   *
   * Un etat local ne doit rien decider ici : l'ancien code retombait sur
   * DEMO_FINAL_SEQUENCE des qu'une variable de session manquait, puis ecrivait
   * ces panneaux de demonstration dans le store — la premiere frappe suivante
   * les enregistrait par-dessus le vrai projet.
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
    // Irreversible : l'image generee, sa narration et ses annotations
    // disparaissent, et l'autosave enregistre la suppression dans la minute.
    // Sans confirmation, un clic malencontreux ne se rattrape pas.
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
   * Demande un visuel au modele et rend son URL definitive.
   *
   * Le projet est designe par son id : la route verifie le droit d'ecriture
   * AVANT d'appeler le modele, et l'image part au bac d'objets — une `data:`
   * URL serait refusee a l'enregistrement.
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
      const error = new Error(body.error ?? `HTTP ${response.status}`);
      // 503 = moteur ou bac mal configure. Rien ne changera au clip suivant.
      (error as Error & { fatal?: boolean }).fatal = response.status === 503;
      throw error;
    }
    return body.url as string;
  };

  /**
   * Produit les visuels manquants.
   *
   * `force` refait la serie entiere : c'est le sens du bouton « Regenerate All
   * Visuals », et lui seul. Par defaut une image deja produite est gardee —
   * rouvrir un projet termine et repasser par cette etape relancait un appel
   * modele par image, pour remplacer des visuels que rien ne rendait caducs.
   */
  const generateImagesProgressively = async ({ force = false } = {}) => {
    const clips = editableClips.filter((c) => !c.isSection);
    if (clips.length === 0) return;
    if (!projectSync.projectId) {
      toast.error("Project is still loading");
      return;
    }

    // Une copie de travail : les visuels deja obtenus sont conserves meme si un
    // appel echoue au milieu, plutot que de perdre le lot entier.
    const newImages = [...generatedImages];
    // L'index d'origine voyage avec le clip : c'est le `sceneIndex` sous lequel
    // la route range l'image, et sauter des clips le desaligne du rang de boucle.
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
    // La premiere case produite sert de reference aux suivantes : c'est le seul
    // moyen de tenir l'epaisseur de trait et la gamme de couleurs sur la serie.
    // Un visuel deja en place fait cette reference quand on complete une serie,
    // sinon les images ajoutees apres coup partiraient dans un autre style.
    let reference: string | undefined = force
      ? undefined
      : newImages.find((url) => !!url);

    for (let rang = 0; rang < todo.length; rang++) {
      const { clip, index } = todo[rang];
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
        // Inutile d'insister neuf fois sur une configuration absente.
        if ((error as Error & { fatal?: boolean }).fatal) {
          setGeneratingProgress({ current: todo.length, total: todo.length });
          break;
        }
      }
      setGeneratingProgress({ current: rang + 1, total: todo.length });
    }

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

    try {
      const newImages = [...generatedImages];
      // Regenerer une seule case : la premiere de la serie reste la reference,
      // sinon la case refaite jurerait avec les autres.
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
      setIsGeneratingImages(false);
    }
  };

  // Arriver sur le storyboard dessine ce qui manque, une fois par arrivee :
  // un visuel deja produit est garde, et un echec ne relance pas en boucle.
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

  // Des que tous les visuels sont la, la voix s'enregistre sans attendre le
  // clic : la planification des annotations a besoin des images, d'ou l'ordre.
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
   * Fait entendre la voix qui sera reellement utilisee.
   *
   * L'apercu passait par speechSynthesis du navigateur : on ecoutait une voix
   * systeme sans aucun rapport avec celle que le moteur allait produire.
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
          text:
            scriptText.trim().slice(0, 200) ||
            PREVIEW_FALLBACK[projectParams.language] ||
            PREVIEW_FALLBACK.en,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);

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
   * Le script qui a produit le decoupage actuellement en place.
   *
   * Il distingue les deux clics sur « Approve Script » : celui qui suit une
   * reecriture, qui doit redecouper, et celui qui ne fait que traverser une
   * etape deja faite, qui ne doit rien refaire.
   */
  const brokenDownScript = useRef<string | null>(null);

  // Un projet rouvert porte deja son decoupage : il a ete enregistre avec le
  // script qui l'a produit. Sans cette amorce, le premier passage par l'etape
  // script le prenait pour un decoupage absent et relancait tout.
  useEffect(() => {
    if (projectSync.status === "loading") return;
    if (brokenDownScript.current !== null) return;
    if (storyboardPanels.length === 0) return;
    brokenDownScript.current = scriptText;
  }, [projectSync.status, storyboardPanels.length, scriptText]);

  /**
   * Second temps : le texte valide est decoupe en scenes.
   *
   * L'appel est distinct de l'ecriture parce que l'utilisateur a pu reecrire le
   * script entre les deux — decouper des la premiere generation figeait des
   * scenes que ses corrections n'atteignaient plus.
   */
  const handleScriptValidated = async () => {
    if (!scriptText.trim() || isBreakingDown) return;

    // L'etape est deja faite et le script n'a pas bouge : on la traverse.
    // La redecouper rappelait le modele, puis reecrivait des clips aux images
    // vides (`clips.map(() => "")`) par-dessus le projet — visuels, voix et
    // annotations deja produits partaient avec.
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
        setScriptError(body.error ?? `HTTP ${response.status}`);
        return;
      }

      const scenes = (body.scenes ?? []) as ScriptScene[];

      // Une image, ses temps de narration. La duree suit ce qu'elle porte :
      // une idee developpee garde son dessin a l'ecran plus longtemps.
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
   * Situe les annotations de chaque image, et les cale sur la voix produite.
   *
   * Elles s'ecrivent dans `panel.annotations`, non dans
   * `whiteboardConfig.annotations` : c'est ce que l'editeur et le rendu lisent
   * en premier (to-render-project.ts, whiteboard-editor-step.tsx), le second
   * n'etant qu'un repli commun a toutes les images — donc le meme dessin
   * partout.
   *
   * Une image qui echoue laisse les autres passer : mieux vaut une scene sans
   * annotation, ajustable a la main, qu'un lot entier perdu.
   */
  const planClipAnnotations = async (
    clips: any[],
    images: string[],
  ): Promise<any[]> => {
    if (!projectSync.projectId) return clips;

    const canvas = tailleCanvas(projectParams.aspectRatio);
    const planned = [...clips];
    let failed = 0;

    // `images` est indexe par les clips SANS section — c'est ainsi que
    // generateImagesProgressively le remplit et que syncClipsToStore le relit.
    // Cette boucle, elle, courait sur TOUS les clips : des qu'une section
    // precedait une scene, celle-ci lisait l'image d'une autre, ou rien du
    // tout, et repartait sans annotation. D'ou des scenes muettes dans
    // l'editeur alors que la planification disait avoir tourne.
    let rang = 0;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (clip.isSection) continue;

      const sceneIndex = rang;
      const imageUrl = images[sceneIndex] || "";
      rang += 1;
      if (!imageUrl || !clip.beats?.length) continue;

      try {
        const imageSize = await measureImageSize(imageUrl);
        // Les sujets sont mesures ici, sur l'image : la vision situe bien mais
        // chiffre mal, son rectangle ne sert plus qu'a designer lequel.
        const candidates = await measureSubjectCandidates(imageUrl, imageSize);
        const response = await fetch("/api/plan-annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: projectSync.projectId,
            imageUrl,
            scene: {
              index: sceneIndex,
              // Le schema de la route n'accepte que ces trois valeurs : un
              // projet ancien porte parfois autre chose, qui ferait echouer
              // toute la planification en 400.
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
        // Un echec avale ne laissait qu'une ligne de console : la scene
        // revenait sans annotation et rien ne le disait.
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
   * Synthetise la narration, temps par temps.
   *
   * Par image, la voix se jouait mais ne se decoupait pas : les annotations se
   * calent sur la duree de CHAQUE temps, et l'estimation du decoupage derive de
   * 15 %. Le TTS etant facture au caractere, un appel par temps coute le meme
   * prix que le meme texte en un seul appel.
   *
   * La progression suit le lot reel : elle etait auparavant une animation de
   * trois secondes qui n'attendait rien, et l'etape suivante s'ouvrait sur des
   * clips sans audio.
   */
  const handleVoiceSelected = async (
    voiceId: string,
    { advance = true }: { advance?: boolean } = {},
  ) => {
    if (!projectSync.projectId) return;

    const jobs = narrationJobs(editableClips);
    if (jobs.length === 0) return;

    const voice = normalizeVoice(voiceId);

    // L'etape est deja faite, et sur cette meme voix : on la traverse. Le
    // script part d'une traite, donc relancer refaisait la bande ENTIERE et
    // remplacait des calages deja mesures. Choisir une AUTRE voix reste un
    // ordre de refaire — c'est le seul moyen d'en changer.
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

    // Une copie de travail : les narrations obtenues sont conservees meme si un
    // appel echoue au milieu, plutot que de perdre le lot entier.
    const withAudio = [...editableClips];
    let failed = 0;
    // Les images dont ce lot a deja pose la premiere voix. Une image peut en
    // recevoir plusieurs quand elle est trop longue pour un seul appel, et sa
    // duree les additionne — mais en repartant de zero, sinon elle s'ajouterait
    // a celle d'un lot precedent.
    const commencees = new Set<number>();
    // Ce que chaque enregistrement dit, mot par mot : produit pour recaler les
    // temps, il se garde au lieu d'etre jete.
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
          const error = new Error(body.error ?? `HTTP ${response.status}`);
          (error as Error & { fatal?: boolean }).fatal = response.status === 503;
          throw error;
        }

        // L'enregistrement ne se decoupe pas : ses temps s'y REPERENT, chacun
        // recevant l'instant ou il est dit et la place qu'il occupe — silence
        // de fin compris, sinon le dessin devancerait la respiration.
        const cales: { startMs: number; durationMs: number }[] | null =
          Array.isArray(body.beats) ? body.beats : null;

        if (Array.isArray(body.words) && body.words.length > 0) {
          transcription.push({ url: body.url, words: body.words });
        }

        job.places.forEach((place, rang) => {
          const clip = withAudio[place.clipIndex];
          if (!clip) return;

          const cale = cales?.[rang];
          // Un meme enregistrement porte plusieurs images : chacune le
          // designe, et ses temps disent ou ils sont dedans.
          const commencee = commencees.has(place.clipIndex);
          commencees.add(place.clipIndex);

          const beats = (clip.beats ?? []).map(
            (beat: ScriptBeat, index: number) =>
              index === place.beatIndex
                ? {
                    ...beat,
                    audioUrl: body.url,
                    startMs: cale?.startMs,
                    audioDurationMs: cale?.durationMs,
                  }
                : beat,
          );

          withAudio[place.clipIndex] = {
            ...clip,
            audioUrl: commencee ? clip.audioUrl : body.url,
            // Ce que CETTE image occupe dans la voix, et non la duree du
            // fichier : plusieurs images le partagent.
            audioDurationMs:
              (commencee ? (clip.audioDurationMs ?? 0) : 0) +
                (cale?.durationMs ?? 0) || undefined,
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

    // La planification vient APRES : elle a besoin des durees mesurees pour
    // faire entrer chaque annotation quand son texte est dit.
    const planned = await planClipAnnotations(withAudio, generatedImages);

    setEditableClips(planned);
    const panels = syncClipsToStore(planned, generatedImages);
    // Le lien entre un temps de narration et ce qui se dessine pendant qu'il
    // est dit se remplissait a la main dans l'editeur : la planification le
    // connait par construction.
    setTranscript(transcriptFromPanels(panels));
    // La piste : un enregistrement par image, pose a sa place. Plus rien a
    // coller — chaque image est dite d'une traite.
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
   * Replace les annotations sans retoucher a la voix.
   *
   * La planification ne consomme que les temps DEJA mesures et les images :
   * elle etait pourtant soudee a la synthese, donc la refaire imposait de
   * repayer tout le script. Une scene revenue muette — planification en echec,
   * image absente — se rattrape maintenant seule.
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
      // resetWorkflow repart de l'etape prompt : l'abonnement du hook ecrit
      // cet etat vide dans le projet, donc rien a effacer a la main.
      toast.info("Session cleared");
    }
  };

  const getStepIndex = (s: string) => STEPS.findIndex((step) => step.key === s);
  const currentStepIndex = getStepIndex(step);

  const canNavigateToStep = (index: number) => {
    if (index === 0) return true;
    if (index === 1) return !!promptContent;
    if (index === 2) return !!scriptText.trim();
    if (index === 3) return generatedImages.length > 0;
    if (index === 4) return !!selectedVoice;
    return false;
  };

  // Ne pas afficher l'interface tant que le projet n'est pas chargé
  if (projectSync.status === "loading") {
    return (
      <AppShell contentClassName="h-screen overflow-hidden">
        <div className="h-full bg-background text-foreground flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Chargement du projet...</p>
        </div>
      </AppShell>
    );
  }

  if (projectSync.status === "error") {
    return (
      <AppShell contentClassName="h-screen overflow-hidden">
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
    <AppShell contentClassName="h-screen overflow-hidden">
      <div className="h-full bg-background text-foreground flex flex-col overflow-hidden">
        <DevPanel currentStep={step} />

        {projectSync.status === "read-only" && (
          // Visible tant que le bail n'est pas repris : sans cette bannière,
          // l'edition continuait sur une interface normale alors que plus
          // rien ne s'enregistrait — le travail se perdait en silence.
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

        <div
          className={cn(
            "flex-1 min-h-0 px-2 py-4",
            step === "whiteboard" ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          {/* Step Content */}
          {step === "prompt" && (
            <div className="flex items-stretch px-4 py-8 gap-8 justify-center">
              <div className="flex-1 max-w-2xl space-y-6">
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
                  {/* Narrative Voice */}
                  <Select
                    value={selectedVoice}
                    onValueChange={setSelectedVoice}
                  >
                    <SelectTrigger className="bg-white/5 border border-white/10 rounded-full text-sm px-3 py-1.5 hover:bg-white/10 transition-colors inline-flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4" />
                      <SelectValue className="text-sm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alloy">Alloy</SelectItem>
                      <SelectItem value="ash">Ash</SelectItem>
                      <SelectItem value="ballad">Ballad</SelectItem>
                      <SelectItem value="coral">Coral</SelectItem>
                      <SelectItem value="echo">Echo</SelectItem>
                      <SelectItem value="fable">Fable</SelectItem>
                      <SelectItem value="nova">Nova</SelectItem>
                      <SelectItem value="onyx">Onyx</SelectItem>
                      <SelectItem value="sage">Sage</SelectItem>
                      <SelectItem value="shimmer">Shimmer</SelectItem>
                      <SelectItem value="verse">Verse</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Hand Style */}
                  <Select
                    value={whiteboardConfig.handStyle}
                    onValueChange={(val) => setWhiteboardConfig({ handStyle: val })}
                  >
                    <SelectTrigger className="bg-white/5 border border-white/10 rounded-full text-sm px-3 py-1.5 hover:bg-white/10 transition-colors inline-flex items-center gap-1.5">
                      <Settings className="w-4 h-4" />
                      <SelectValue className="text-sm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom1">Hand 1</SelectItem>
                      <SelectItem value="custom2">Hand 2</SelectItem>
                      <SelectItem value="custom3">Hand 3</SelectItem>
                      <SelectItem value="custom4">Hand 4</SelectItem>
                      <SelectItem value="ghost">No Hand</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Whiteboard Config Panel & Preview */}
                {projectParams.style === "whiteboard" && (
                  <div className="space-y-4">

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

              {(scriptText || isGeneratingScript || scriptError) && (
                <aside className="w-full max-w-md shrink-0 self-start sticky top-4">
                  <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
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
                        className="w-full bg-primary hover:bg-primary/90"
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
                </aside>
              )}
            </div>
          )}


          {step === "storyboard" && (
            <div className="max-w-6xl mx-auto px-4 pt-4 pb-12">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Storyboard</h2>
                    <p className="text-sm text-muted-foreground">
                      {editableClips.filter((c) => !c.isSection).length} scenes
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void generateImagesProgressively({ force: true })}
                      disabled={isGeneratingImages || isGeneratingNarration}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Regenerate all
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        syncClipsToStore(editableClips, generatedImages);
                        void handleVoiceSelected(selectedVoice);
                      }}
                      disabled={isGeneratingImages || isGeneratingNarration}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isGeneratingNarration ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Film className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {isGeneratingNarration
                        ? `Recording narration ${Math.round(narrationProgress)}%`
                        : "Continue to Whiteboard"}
                    </Button>
                  </div>
                </div>

                {isGeneratingImages && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    Drawing visuals {generatingProgress.current}/{generatingProgress.total}
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(generatingProgress.current / Math.max(1, generatingProgress.total)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {isGeneratingNarration && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    Recording narration {Math.round(narrationProgress)}%
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${narrationProgress}%` }} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {editableClips.map((item, i) =>
                    item.isSection ? (
                      <div
                        key={item.id || `item-${i}`}
                        className="col-span-full flex items-center gap-2 border-b border-border/50 pt-2 pb-1"
                      >
                        <input
                          type="text"
                          value={item.title || ""}
                          onChange={(e) => updateClipField(i, { title: e.target.value })}
                          placeholder="Section title..."
                          className="flex-1 bg-transparent text-xs font-semibold uppercase tracking-wider text-muted-foreground outline-none focus:text-foreground"
                        />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteClip(i)} title="Delete section">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        key={item.id || `item-${i}`}
                        className="group rounded-xl border border-border bg-card overflow-hidden flex flex-col sm:flex-row"
                      >
                        <div className="relative sm:w-2/5 shrink-0 aspect-video sm:aspect-auto sm:min-h-full bg-muted/30 flex items-center justify-center">
                          {generatedImages[i] ? (
                            <Image src={generatedImages[i]} alt={item.title || `Clip ${i + 1}`} fill className="object-contain bg-white" />
                          ) : isGeneratingImages ? (
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          ) : (
                            <Film className="w-5 h-5 text-muted-foreground/40" />
                          )}
                          <span className="absolute top-1.5 left-1.5 rounded bg-background/80 px-1.5 text-[10px] font-bold">
                            {i + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => void regenerateImageForClip(i)}
                            disabled={isGeneratingImages}
                            className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-background/90 border border-border px-2 py-1 text-[11px] flex items-center gap-1 disabled:opacity-40"
                            title="Regenerate visual"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Redraw
                          </button>
                        </div>

                        <div className="flex-1 min-w-0 p-3 space-y-2">
                          <div className="flex items-center gap-1">
                            <p className="flex-1 truncate text-sm font-semibold">{item.title || `Clip ${i + 1}`}</p>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" disabled={i === 0} onClick={() => moveClip(i, "up")} title="Move up">↑</Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" disabled={i === editableClips.length - 1} onClick={() => moveClip(i, "down")} title="Move down">↓</Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => duplicateClip(i)} title="Duplicate"><Copy className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteClip(i)} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Description</Label>
                            <Textarea
                              value={item.summary || item.narration || ""}
                              onChange={(e) => updateClipField(i, { summary: e.target.value, narration: e.target.value })}
                              placeholder="What is said during this scene..."
                              className="field-sizing-fixed h-24 min-h-0 overflow-y-auto text-xs resize-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Image prompt</Label>
                            <Textarea
                              value={item.visualPrompt || ""}
                              onChange={(e) => updateClipField(i, { visualPrompt: e.target.value })}
                              placeholder="What the visual should show..."
                              className="field-sizing-fixed h-16 min-h-0 overflow-y-auto text-xs resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                  <button
                    type="button"
                    onClick={() => addClip()}
                    className="min-h-32 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 flex items-center justify-center gap-2 text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Add scene
                  </button>
                  <button
                    type="button"
                    onClick={() => addSection()}
                    className="min-h-32 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 flex items-center justify-center gap-2 text-xs"
                  >
                    <Layers className="w-4 h-4" />
                    Add section
                  </button>
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


          {/* Sans clips, le bloc ci-dessus ne rend RIEN : l'ecran restait
              vide et sans issue. Mieux vaut dire ce qui manque et rouvrir le
              chemin qui le produit. */}


        </div>

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
