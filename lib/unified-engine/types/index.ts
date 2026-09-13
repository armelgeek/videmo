// Annotation schema (mirrors Python annotation.json)
export interface Annotation {
  id: string;
  text: string;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  reveal: {
    // Derived by deriveTimeline() from order + durations + gaps.
    // Never authored by hand: the annotation's position in the array is the
    // source of truth, these fields are recomputed before rendering.
    from: number;      // ms
    to: number;        // ms
    startMs: number;
    durationMs: number;
    gapBeforeMs?: number;
  };
  style?: {
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    opacity?: number;
  };
  animStyle?: string;
  /**
   * La scene (panneau) a laquelle appartient l'annotation. Le store tient les
   * annotations de TOUTES les scenes dans un seul tableau : c'est ce champ qui
   * les separe. Absent en mode demo, sans panneau.
   */
  panelId?: string;
}

export interface InkplainerLayer {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  visible: boolean;
  animStyle?: string;
  handStyle?: string;
  speed?: number;
  handSpeed?: number;
  imageElement?: HTMLImageElement;
}

export interface ClipData {
  id: string;
  name: string;
  startTime: number;   // ms
  duration: number;    // ms
  layerId: string;
  data: Record<string, any>;
}

export interface UnifiedEngineState {
  // ===== TIMELINE & PLAYBACK =====
  timeline: {
    currentTime: number;              // ms — single authoritative clock
    duration: number;                 // Total animation duration (ms)
    isPlaying: boolean;
    fps: number;
    clips: ClipData[];
  };

  // ===== ANIMATION & WHITEBOARD =====
  animation: {
    layers: InkplainerLayer[];
    animStyle: string;                // "chunkjump", "scribble", etc.
    handStyle: string;                // "custom1", "ghost", etc.
    revealSpeed: number;              // 0-100
    handSpeed: number;                // 0-100
    chunks: number;                   // Tile count
    canvasBg: string;                 // "#ffffff" or "black" or "none"
    useAnnotation: boolean;
    annotations: Annotation[];
    // progress: REMOVED — always derive from currentTime/duration
  };

  // ===== CANVAS & RENDERING =====
  canvas: {
    width: number;
    height: number;
    aspectRatio: string;              // "16:9", "4:3", etc.
    resolution: string;               // "720p", "1080p", etc.
  };

  // ===== UI STATE =====
  ui: {
    selectedClipId: string | null;
    /** Index DANS la scene active, pas dans le tableau de toutes les scenes. */
    selectedAnnotationIndex: number | null;
    /** La scene dont on edite et dessine les annotations, deduite de la lecture. */
    activeScenePanelId: string | null;
    activePanel: 'timeline' | 'whiteboard' | 'inspector';
    isLoading: boolean;
    error: string | null;
  };
}

export interface UnifiedEngineActions {
  // Timeline & Playback
  setCurrentTime(time: number): void;
  setIsPlaying(playing: boolean): void;
  togglePlay(): void;
  setDuration(duration: number): void;
  setFps(fps: number): void;

  // Animation Settings
  setAnimStyle(style: string): void;
  setHandStyle(style: string): void;
  setRevealSpeed(speed: number): void;
  setHandSpeed(speed: number): void;
  setChunks(count: number): void;
  setCanvasBg(color: string): void;
  setUseAnnotation(enabled: boolean): void;

  // Annotations
  //
  // Le store tient TOUTES les scenes a plat. `setAnnotations` remplace ce
  // tableau entier (chargement unique) ; les autres actions agissent sur la
  // scene active, avec des index LOCAUX a cette scene.
  updateAnnotation(index: number, data: Partial<Annotation>): void;
  addAnnotation(annotation: Annotation): void;
  removeAnnotation(id: string): void;
  setAnnotations(annotations: Annotation[]): void;
  /** Remplace les seules annotations d'une scene, sans toucher aux autres. */
  setSceneAnnotations(panelId: string | null, annotations: Annotation[]): void;
  setActiveScenePanelId(panelId: string | null): void;

  // Layers
  addLayer(layer: InkplainerLayer): void;
  updateLayer(id: string, data: Partial<InkplainerLayer>): void;
  removeLayer(id: string): void;

  // Canvas
  setCanvasSize(width: number, height: number): void;
  setAspectRatio(ratio: string): void;
  setResolution(res: string): void;

  // UI
  setSelectedClip(clipId: string | null): void;
  setSelectedAnnotation(index: number | null): void;
  setActivePanel(panel: 'timeline' | 'whiteboard' | 'inspector'): void;
  setError(error: string | null): void;

  // Lifecycle
  reset(): void;
}

export type UnifiedEngineStore = UnifiedEngineState & UnifiedEngineActions;
