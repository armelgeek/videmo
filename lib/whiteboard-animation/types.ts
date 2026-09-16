export type AnimationStyle =
  | "scanner"
  | "contour"
  | "outlinechunks"
  | "chunkjump"
  | "outlinefill"
  | "brushfill"
  | "nervous"
  | "topanchor"
  | "scribble"
  | "specialized"
  | "gesture"
  | "illustfill"
  | "outlineonly"
  | "spec-text"
  | "spec-human"
  | "spec-animal"
  | "spec-portrait"
  | "spec-vehicle"
  | "spec-building"
  | "spec-landscape"
  | "spec-spiral"
  | "spec-nature"
  | "spec-explode";

export interface AnimationOptions {
  lineColor?: string;
  lineWidth?: number;
  speed?: number;
  delay?: number;
  kind?: string;
  [key: string]: any;
}

export interface WhiteboardState {
  canvasWidth: number;
  canvasHeight: number;
  animationStyle: AnimationStyle;
  animationOptions: AnimationOptions;
  layers: WhiteboardLayer[];
  speed: number;
  playing: boolean;
  currentTime: number;
  duration: number;
  selectedLayerId?: string;
}

export interface WhiteboardLayer {
  id: string;
  name: string;
  type: "shape" | "text" | "image" | "annotation";
  visible: boolean;
  locked: boolean;
  opacity: number;
  data: Record<string, any>;
  startTime: number;
  duration: number;
  animationStyle?: AnimationStyle;
  animationOptions?: AnimationOptions;
}

export interface WhiteboardProject {
  id: string;
  name: string;
  state: WhiteboardState;
  createdAt: Date;
  updatedAt: Date;
  thumbnail?: string;
}

export interface DrawingPath {
  points: Array<{ x: number; y: number }>;
  pressure?: number[];
  timestamp: number;
  strokeColor: string;
  strokeWidth: number;
}

export interface EditorEngineConfig {
  canvas: HTMLCanvasElement;
  handCanvas: HTMLCanvasElement;
  selCanvas: HTMLCanvasElement;
  state: WhiteboardState;
  options: Record<string, any>;
  hooks: Record<string, any>;
}

export interface TimelineConfig {
  engine: any;
  project: any;
  hooks: Record<string, any>;
}
