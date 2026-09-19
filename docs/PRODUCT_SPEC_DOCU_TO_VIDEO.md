# Documentation → Training Video Platform
## Technical Specification & Architecture

**Status**: MVP Specification  
**Version**: 1.0  
**Date**: 2026-09-19  

---

## 1. Executive Summary

A SaaS platform that converts documentation (PDF, Markdown, Notion) into auto-generated whiteboard training videos using AI-driven storyboarding and SkeletonTrace animation.

**Core Value Proposition**: *Turn your documentation into engaging training videos in minutes*

**Target Market**: SaaS companies, agencies, internal training teams  
**MVP Timeline**: 8-12 weeks  
**Key Differentiator**: Proprietary SkeletonTrace animation engine + documentation-first workflow

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────┐
│  Frontend Layer │  (Next.js)
│  /project       │
│  /editor        │
│  /preview       │
│  /export        │
└────────┬────────┘
         │
┌────────▼────────────────┐
│  API Layer              │  (Node.js / Hono)
│  /documents             │
│  /storyboards           │
│  /scenes                │
│  /render                │
│  /export                │
└────────┬────────────────┘
         │
    ┌────┴─────────────────────────────────┐
    │                                       │
┌───▼──────────────┐  ┌──────────────────┐ │
│  Processing      │  │  Storage Layer   │ │
│  Pipeline        │  │  - PostgreSQL    │ │
│                  │  │  - S3/R2         │ │
│ - LLM            │  │  - Cache (Redis) │ │
│ - Image Gen      │  │                  │ │
│ - SVG Render     │  │                  │ │
│ - SkeletonTrace  │  │                  │ │
│ - Remotion       │  │                  │ │
└──────────────────┘  └──────────────────┘
```

### 2.2 Data Flow Pipeline

```
STEP 1: Document Ingestion
  Input: PDF / Markdown / Notion / URL
    ↓
  Normalize → Extract text + metadata
    ↓
  Store raw document

STEP 2: AI Structuring (LLM)
  Input: Document text
    ↓
  LLM processes:
    - Identify key sections
    - Extract learning objectives
    - Generate scene breakpoints
    - Create narration scripts
    ↓
  Output: Storyboard JSON

STEP 3: Visual Planning
  Input: Storyboard
    ↓
  For each scene:
    - Determine visual type (diagram/illustration/text)
    - Generate prompt for visual content
    - Map to animation style
    ↓
  Output: Visual Plan JSON

STEP 4: Asset Generation
  Input: Visual Plan
    ↓
  For each visual:
    - If diagram: Generate SVG drawing paths
    - If illustration: Call image generation API
    - If text: Format and position
    ↓
  Output: Assets + drawing specs

STEP 5: Animation Rendering
  Input: Assets + scene config
    ↓
  SkeletonTrace engine:
    - Convert vector paths to skeleton
    - Compute animation timings
    - Generate frame sequences
    ↓
  Output: Animation sequences

STEP 6: Video Composition (Remotion)
  Input: Animation sequences + narration + branding
    ↓
  Remotion composes:
    - Video frames
    - Audio sync
    - Text overlays
    - Branding elements
    ↓
  Output: MP4

STEP 7: Post-Processing
  Input: MP4
    ↓
  - Add subtitles (STT → translate → burn)
  - Apply color grading
  - Optimize for platform
    ↓
  Output: Final MP4 + assets for sharing
```

---

## 3. Component Specifications

### 3.1 Frontend (Next.js)

#### Pages & Features

```
/dashboard
  ├── List of all projects
  ├── Upload document
  └── Recent activity

/project/[id]
  ├── /editor
  │   ├── Document preview (left)
  │   ├── Storyboard editor (center)
  │   │   ├── Scene list (drag-reorder)
  │   │   └── Scene detail view
  │   └── Preview (right)
  │
  ├── /preview
  │   ├── Real-time animation preview
  │   ├── Frame-by-frame scrubber
  │   └── Timing adjustments
  │
  ├── /settings
  │   ├── Branding (logo, colors)
  │   ├── Narration (voice, language)
  │   ├── Video quality
  │   └── Export formats
  │
  └── /export
      ├── Download MP4
      ├── Generate share link
      └── Embed code

/account
  ├── Subscription
  ├── API keys
  └── Integrations
```

#### Key Components

```typescript
// lib/components/SceneEditor.tsx
interface Scene {
  id: string;
  title: string;
  duration: number;
  elements: VisualElement[];
  narration: {
    text: string;
    voiceId: string;
    duration: number;
  };
  animation_style: "skeletontrace" | "text" | "image";
}

interface VisualElement {
  id: string;
  type: "drawing" | "text" | "image";
  content: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  animation: AnimationType;
  timing: { start: number; duration: number };
}

// lib/components/VideoPreview.tsx
// Real-time preview using Remotion
// Frame scrubber, playback controls
// Performance: canvas rendering (not iframe)
```

#### State Management

```typescript
// State architecture:
// - Zustand for UI state (editing, preview, sidebar)
// - React Query for server state (documents, projects, renders)
// - Optimistic updates for scene editing

interface ProjectStore {
  currentProject: Project;
  storyboard: Scene[];
  isEditing: boolean;
  selectedScene: string | null;
  renderProgress: number;
  
  updateScene(id: string, scene: Partial<Scene>): Promise<void>;
  reorderScenes(from: number, to: number): void;
  regenerateStoryboard(): Promise<void>;
}
```

### 3.2 Backend (Node.js / Hono)

#### API Endpoints

```
POST /api/documents
  Upload document (PDF, MD, JSON)
  Returns: { documentId, status }

POST /api/documents/:id/process
  Trigger LLM processing
  Returns: { storyboardId, status }
  Body: { documentId, language, tone, targetAudience }

GET /api/storyboards/:id
  Fetch storyboard with all scenes
  Returns: Storyboard JSON

PATCH /api/storyboards/:id/scenes/:sceneId
  Update single scene
  Returns: { sceneId, updated }

POST /api/projects/:id/render
  Start video rendering
  Returns: { renderId, estimatedTime }

GET /api/renders/:id/progress
  WebSocket or polling endpoint for render progress
  Returns: { progress, status, eta }

GET /api/renders/:id/download
  Download rendered MP4
  Returns: signed S3 URL

POST /api/renders/:id/regenerate
  Regenerate from updated storyboard
  Returns: { renderId }
```

#### Processing Worker Queue

```typescript
// Using Bull/BullMQ for async jobs

interface RenderJob {
  projectId: string;
  storyboardId: string;
  renderId: string;
  config: {
    quality: "720p" | "1080p";
    fps: 30 | 60;
    format: "mp4" | "webm";
    subtitles: boolean;
    languages: string[];
  };
  priority: number;
}

// Worker process
async function renderVideo(job: RenderJob) {
  // 1. Load storyboard
  // 2. Generate scenes
  // 3. Compose with Remotion
  // 4. Post-process
  // 5. Upload to S3
  // 6. Update database
  // 7. Emit socket event to frontend
}

// Queue configuration:
// - Max 3 concurrent renders (to avoid GPU overload)
// - Retry failed jobs 2x
// - Timeout: 30 min per render
```

#### LLM Processing Pipeline

```typescript
interface LLMPrompt {
  document_text: string;
  document_type: "pdf" | "markdown" | "notion" | "web";
  target_audience: string;
  tone: "professional" | "casual" | "educational";
  duration_target: number; // minutes
  language: string;
}

interface StoryboardOutput {
  title: string;
  description: string;
  estimated_duration: number;
  scenes: Array<{
    scene_number: number;
    title: string;
    duration: number;
    visual_description: string;
    visual_type: "diagram" | "illustration" | "text" | "chart";
    animation_style: "skeletontrace" | "text_only";
    narration_script: string;
    key_points: string[];
    speaker_notes: string;
  }>;
  metadata: {
    source_sections: string[];
    key_themes: string[];
    recommended_images: number;
  };
}

// LLM call (using Claude API):
async function generateStoryboard(prompt: LLMPrompt): Promise<StoryboardOutput> {
  const systemPrompt = `
    You are an expert instructional designer.
    Convert documents into structured video storyboards.
    
    Output MUST be valid JSON matching StoryboardOutput type.
    Each scene should:
    - Be 20-60 seconds (realistic for animation)
    - Have clear visual direction
    - Include natural-sounding narration
    - Follow learning principles
  `;
  
  return claudeClient.messages.create({
    model: "claude-opus-5",
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: JSON.stringify(prompt)
    }]
  }).then(parseJSON);
}
```

### 3.3 Animation Engine Integration

#### SkeletonTrace Wrapper

```typescript
// lib/animation/skeleton-trace-renderer.ts

interface SceneConfig {
  width: number;
  height: number;
  background: string;
  elements: SkeletonElement[];
  duration: number; // seconds
  fps: number;
}

interface SkeletonElement {
  id: string;
  type: "drawing" | "text" | "image";
  svgPath?: string; // For drawing
  text?: string; // For text
  imageSrc?: string; // For image
  position: { x: number; y: number };
  size: { w: number; h: number };
  
  animation: {
    type: "draw" | "appear" | "fade" | "slide";
    startFrame: number;
    endFrame: number;
    easing: string;
  };
  
  styling: {
    stroke: string;
    strokeWidth: number;
    fill: string;
    opacity: number;
    fontSize?: number;
  };
}

class SkeletonTraceRenderer {
  private engine: WhiteboardAnimationEngine;
  
  async render(config: SceneConfig): Promise<Buffer> {
    // 1. Initialize canvas
    const canvas = createCanvas(config.width, config.height);
    
    // 2. For each element, determine SVG paths
    for (const element of config.elements) {
      if (element.type === "drawing") {
        // Call SkeletonTrace to extract skeleton
        const skeleton = await this.engine.extractSkeleton(element.svgPath);
        element.animationPath = skeleton;
      }
    }
    
    // 3. Render frame by frame
    const frames = [];
    for (let frame = 0; frame < config.fps * config.duration; frame++) {
      const frameCanvas = this.renderFrame(config, frame);
      frames.push(frameCanvas);
    }
    
    // 4. Return frame buffer or sequence
    return Buffer.concat(frames);
  }
  
  private renderFrame(config: SceneConfig, frame: number): Buffer {
    // Render single frame based on animation progress
    // Apply element animations based on timing
  }
}
```

#### Scene Renderer Pipeline

```typescript
// lib/animation/scene-renderer.ts

interface Scene {
  id: string;
  visualElements: VisualElement[];
  duration: number;
  narration: NarrationTrack;
}

async function renderScene(scene: Scene, assetMap: AssetMap): Promise<FrameSequence> {
  const width = 1920;
  const height = 1080;
  const fps = 30;
  const totalFrames = (scene.duration * fps);
  
  const frames: Canvas[] = [];
  
  for (let frameNum = 0; frameNum < totalFrames; frameNum++) {
    const progress = frameNum / totalFrames;
    const currentTime = frameNum / fps;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Render each element with animation applied
    for (const element of scene.visualElements) {
      if (element.type === 'drawing') {
        // Use SkeletonTrace
        const renderer = new SkeletonTraceRenderer();
        const elementProgress = calculateProgress(element, currentTime);
        renderer.drawAnimated(ctx, element, elementProgress);
      } else if (element.type === 'text') {
        // Text animation (typewriter, appear, fade)
        drawTextAnimated(ctx, element, currentTime);
      } else if (element.type === 'image') {
        // Image with fade/slide
        drawImageAnimated(ctx, element, currentTime);
      }
    }
    
    frames.push(canvas);
  }
  
  return { frames, duration: scene.duration };
}
```

### 3.4 Video Composition (Remotion)

```typescript
// lib/composition/VideoComposition.tsx

interface CompositionProps {
  storyboard: Storyboard;
  branding: BrandingConfig;
  narration: NarrationTrack[];
}

export const TrainingVideoComposition: React.FC<CompositionProps> = ({
  storyboard,
  branding,
  narration
}) => {
  const durationInFrames = calculateTotalFrames(storyboard);
  
  return (
    <Composition
      id="training-video"
      component={VideoSequence}
      durationInFrames={durationInFrames}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        storyboard,
        branding,
        narration
      }}
    />
  );
};

interface VideoSequenceProps {
  storyboard: Storyboard;
  branding: BrandingConfig;
  narration: NarrationTrack[];
}

export const VideoSequence: React.FC<VideoSequenceProps> = ({
  storyboard,
  branding,
  narration
}) => {
  const { frame } = useVideoConfig();
  
  let currentTime = frame / 30; // seconds
  let sceneIndex = 0;
  let timeInScene = 0;
  
  // Determine current scene
  for (let i = 0; i < storyboard.scenes.length; i++) {
    if (currentTime < timeInScene + storyboard.scenes[i].duration) {
      sceneIndex = i;
      break;
    }
    timeInScene += storyboard.scenes[i].duration;
  }
  
  const currentScene = storyboard.scenes[sceneIndex];
  const sceneProgress = (currentTime - timeInScene) / currentScene.duration;
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#fff' }}>
      {/* Background */}
      <Img src={branding.backgroundImage} />
      
      {/* Animated scene */}
      <SceneRenderer
        scene={currentScene}
        progress={sceneProgress}
      />
      
      {/* Narration audio */}
      <Audio
        src={narration[sceneIndex].audioUrl}
        startFrom={(currentTime - timeInScene) * 30}
      />
      
      {/* Subtitles */}
      {narration[sceneIndex].subtitles && (
        <SubtitleOverlay
          subtitles={narration[sceneIndex].subtitles}
          progress={sceneProgress}
        />
      )}
      
      {/* Branding overlay (optional) */}
      {branding.logoPosition && (
        <Logo
          src={branding.logoUrl}
          position={branding.logoPosition}
          opacity={branding.logoOpacity}
        />
      )}
    </AbsoluteFill>
  );
};

// Render to MP4
async function renderVideo(props: CompositionProps): Promise<string> {
  const outputPath = `/tmp/training-video-${Date.now()}.mp4`;
  
  await renderMedia({
    composition: TrainingVideoComposition,
    serveUrl: "http://localhost:3000",
    outputLocation: outputPath,
    inputProps: props,
    codec: "h264",
    crf: 18,
    pixelFormat: "yuv420p"
  });
  
  // Upload to S3
  const s3Url = await uploadToS3(outputPath);
  
  return s3Url;
}
```

### 3.5 Image Generation Pipeline

```typescript
// lib/image-generation/asset-generator.ts

interface ImageAssetRequest {
  description: string;
  style: "diagram" | "illustration" | "photo";
  width: number;
  height: number;
  format: "png" | "svg" | "webp";
}

async function generateVisual(request: ImageAssetRequest): Promise<string> {
  // For diagrams: generate SVG drawing paths
  if (request.style === "diagram") {
    return generateDiagramSVG(request.description);
  }
  
  // For illustrations: call Flux or DALL-E
  if (request.style === "illustration") {
    const prompt = `
      Professional whiteboard-style illustration.
      ${request.description}
      Style: clean, minimalist, educational
      Format: transparent background, high contrast
    `;
    
    const imageUrl = await fluxClient.generate({
      prompt,
      width: request.width,
      height: request.height,
      model: "flux-pro"
    });
    
    return imageUrl;
  }
  
  // For photos: search stock library
  if (request.style === "photo") {
    const photoUrl = await unsplashClient.search(request.description);
    return photoUrl;
  }
}

async function generateDiagramSVG(description: string): Promise<string> {
  // Use LLM to generate SVG code from description
  const svgCode = await claudeClient.messages.create({
    model: "claude-opus-5",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `
        Generate clean SVG code for this diagram:
        ${description}
        
        Requirements:
        - Simple geometric shapes
        - Clear labels
        - High contrast (black/white)
        - 400x300 viewBox
        - No external resources
        
        Return ONLY valid SVG code.
      `
    }]
  });
  
  return svgCode.content[0].text;
}
```

---

## 4. Data Models

### 4.1 Database Schema (PostgreSQL)

```sql
-- Users & Accounts
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  tier VARCHAR(50), -- free, pro, enterprise
  status VARCHAR(50), -- active, cancelled, expired
  monthly_quota INT, -- video minutes allowed
  monthly_used INT,
  renewal_date DATE,
  created_at TIMESTAMP DEFAULT now()
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title VARCHAR(255),
  content TEXT,
  format VARCHAR(50), -- pdf, markdown, notion, url
  raw_url VARCHAR(2048), -- S3 URL of original
  status VARCHAR(50), -- uploaded, processing, ready, failed
  language VARCHAR(10) DEFAULT 'en',
  extracted_text TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Projects (collection of scenes for single video)
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  document_id UUID REFERENCES documents(id),
  title VARCHAR(255),
  description TEXT,
  status VARCHAR(50), -- draft, storyboard_generated, rendering, complete, failed
  config JSONB, -- branding, voice, quality settings
  estimated_duration INT, -- seconds
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Storyboards (AI-generated structure)
CREATE TABLE storyboards (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id) UNIQUE,
  content JSONB, -- Full storyboard structure
  version INT DEFAULT 1,
  llm_model VARCHAR(100), -- claude-opus-5, etc
  llm_prompt JSONB, -- For audit/regeneration
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Scenes
CREATE TABLE scenes (
  id UUID PRIMARY KEY,
  storyboard_id UUID REFERENCES storyboards(id),
  scene_number INT,
  title VARCHAR(255),
  duration FLOAT, -- seconds
  narration_script TEXT,
  visual_description TEXT,
  visual_type VARCHAR(50), -- diagram, illustration, text, chart
  animation_style VARCHAR(50), -- skeletontrace, text, fade
  assets JSONB, -- { drawing_svg, images, etc }
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Renders (video output jobs)
CREATE TABLE renders (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  status VARCHAR(50), -- queued, processing, complete, failed
  progress FLOAT, -- 0-100
  output_url VARCHAR(2048), -- S3 URL of final MP4
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INT,
  file_size_bytes BIGINT,
  created_at TIMESTAMP DEFAULT now()
);

-- Assets (images, SVGs, audio)
CREATE TABLE assets (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  type VARCHAR(50), -- image, svg, audio, video
  url VARCHAR(2048), -- S3 URL
  mime_type VARCHAR(100),
  file_size_bytes INT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_document ON projects(document_id);
CREATE INDEX idx_renders_project ON renders(project_id);
```

### 4.2 TypeScript Types

```typescript
// types/domain.ts

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  tier: "free" | "pro" | "enterprise";
  status: "active" | "cancelled" | "expired";
  monthlyQuota: number;
  monthlyUsed: number;
  renewalDate: Date;
}

export interface Document {
  id: string;
  userId: string;
  title: string;
  format: "pdf" | "markdown" | "notion" | "url";
  rawUrl: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  extractedText: string;
  language: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  userId: string;
  documentId: string;
  title: string;
  description: string;
  status: "draft" | "storyboard_generated" | "rendering" | "complete" | "failed";
  config: {
    branding: BrandingConfig;
    narration: NarrationConfig;
    quality: "720p" | "1080p";
    fps: 30 | 60;
  };
  estimatedDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Storyboard {
  id: string;
  projectId: string;
  scenes: Scene[];
  title: string;
  description: string;
  estimatedDuration: number;
  metadata: {
    sourceLanguage: string;
    targetLanguage: string;
    tone: string;
    audienceLevel: string;
  };
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Scene {
  id: string;
  sceneNumber: number;
  title: string;
  duration: number; // seconds
  narrationScript: string;
  visualDescription: string;
  visualType: "diagram" | "illustration" | "text" | "chart";
  animationStyle: "skeletontrace" | "text_only" | "fade";
  elements: VisualElement[];
  assets: SceneAssets;
}

export interface VisualElement {
  id: string;
  type: "drawing" | "text" | "image" | "shape";
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  styling: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    fontSize?: number;
    fontFamily?: string;
  };
  animation: {
    type: "draw" | "appear" | "fade" | "slide" | "scale";
    duration: number;
    delay: number;
    easing: string;
  };
}

export interface SceneAssets {
  drawings?: Array<{ id: string; svgPath: string }>;
  images?: Array<{ id: string; url: string }>;
  audio?: { id: string; url: string };
}

export interface Render {
  id: string;
  projectId: string;
  status: "queued" | "processing" | "complete" | "failed";
  progress: number; // 0-100
  outputUrl?: string;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  durationSeconds?: number;
  fileSizeBytes?: number;
}

export interface BrandingConfig {
  companyName: string;
  logoUrl: string;
  logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  logoOpacity: number;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  backgroundColor: string;
}

export interface NarrationConfig {
  voiceProvider: "elevenlabs" | "google" | "aws";
  voiceId: string;
  speed: number;
  language: string;
  includeSubtitles: boolean;
  subtitleLanguages: string[];
}
```

---

## 5. API Specification

### 5.1 Document Upload & Processing

```http
POST /api/documents
Content-Type: multipart/form-data

File: <pdf/markdown/document>
Metadata: {
  title: "Employee Onboarding Guide",
  language: "en",
  targetAudience: "new_employees"
}

Response 200:
{
  documentId: "doc_123",
  status: "processing",
  estimatedProcessingTime: 30
}
```

### 5.2 Storyboard Generation

```http
POST /api/documents/:documentId/generate-storyboard
Content-Type: application/json

{
  tone: "professional",
  targetDuration: 10,
  scenes: 8,
  animationStyle: "skeletontrace",
  language: "en"
}

Response 202 (Accepted):
{
  storyboardId: "sb_456",
  projectId: "proj_789",
  status: "generating",
  estimatedTime: 60
}

# Poll progress:
GET /api/storyboards/:storyboardId/status

Response 200:
{
  status: "complete",
  scenes: [
    {
      sceneNumber: 1,
      title: "Welcome",
      duration: 15,
      visualType: "illustration"
    },
    ...
  ]
}
```

### 5.3 Video Rendering

```http
POST /api/projects/:projectId/render
Content-Type: application/json

{
  quality: "1080p",
  fps: 30,
  includeSubtitles: true,
  subtitleLanguages: ["en", "fr"]
}

Response 202 (Accepted):
{
  renderId: "render_001",
  estimatedDuration: 180,
  status: "queued"
}

# Real-time progress (WebSocket):
WebSocket /ws/renders/:renderId

{
  type: "progress",
  progress: 45,
  stage: "composing_video",
  eta: 90
}

{
  type: "complete",
  outputUrl: "https://s3.../video.mp4",
  duration: 175,
  fileSize: 245000000
}
```

### 5.4 Project Management

```http
GET /api/projects

Response 200:
{
  projects: [
    {
      id: "proj_001",
      documentId: "doc_001",
      title: "Q4 Security Training",
      status: "complete",
      createdAt: "2026-09-19T10:00:00Z",
      render: {
        status: "complete",
        videoUrl: "https://..."
      }
    }
  ]
}

PATCH /api/projects/:projectId
Content-Type: application/json

{
  config: {
    branding: {
      primaryColor: "#0066CC"
    },
    narration: {
      language: "fr"
    }
  }
}

Response 200:
{ updated: true }
```

---

## 6. Scalability & Infrastructure

### 6.1 Deployment Architecture

```
┌─────────────────────────────────────────┐
│  CDN (Cloudflare)                       │
│  - Static assets                        │
│  - Video delivery                       │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  Application Layer (Vercel/Railway)     │
│  - Next.js frontend                     │
│  - API routes                           │
│  - Real-time (WebSocket)                │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴───────────┐
    │                      │
┌───▼──────────┐  ┌────────▼─────────┐
│ Queue Worker │  │ Database         │
│ (Bull/Redis) │  │ (PostgreSQL)     │
│              │  │                  │
│ - Render     │  │ - Documents      │
│ - Process    │  │ - Projects       │
│ - TTS        │  │ - Storyboards    │
└───┬──────────┘  └────────┬─────────┘
    │                      │
    │  ┌────────────────┐  │
    │  │  Cache/Queue   │  │
    │  │  (Redis)       │  │
    │  └────────────────┘  │
    │                      │
┌───▴──────────────────────▴────────────┐
│  Storage (S3/R2)                       │
│  - Documents                           │
│  - Assets                              │
│  - Videos                              │
│  - Cache                               │
└────────────────────────────────────────┘
```

### 6.2 Scaling Considerations

```
# Video Rendering Bottleneck
- Max 3 concurrent Remotion renders (GPU memory)
- Queue other renders with priority (pro > free)
- Cache intermediate results (storyboards)
- Precompute common elements

# LLM Calls
- Batch document processing during off-peak
- Cache storyboard generations (same doc = same output)
- Rate limit: 10 req/min per user

# Image Generation
- Queue requests (Flux has rate limits)
- Cache generated images
- Use placeholder for rapid preview

# Database
- Read replicas for analytics queries
- Connection pooling (PgBouncer)
- Periodic cleanup of old renders

# Monitoring
- Render queue depth
- GPU utilization
- LLM API costs
- Storage usage
```

---

## 7. User Workflows

### 7.1 Happy Path: Document → Video

```
User Flow:
1. [Upload] Drag PDF into upload box
   → Notification: "Processing document..."
   
2. [Review] System extracts text, shows preview
   → Option to confirm or edit

3. [Generate] Click "Generate Storyboard"
   → LLM processes, creates 8 scenes
   → Estimated duration: 12 min

4. [Edit] Review storyboard, can:
   - Edit narration text
   - Adjust scene duration
   - Change animation style per scene
   - Reorder scenes (drag-drop)

5. [Customize] Set branding:
   - Upload company logo
   - Choose colors
   - Select voice for narration

6. [Preview] Real-time video preview:
   - Play/pause, scrub timeline
   - Adjust timings
   - See animations in-browser

7. [Render] Click "Generate Video"
   → Estimated time: 3-5 minutes
   → Real-time progress with WebSocket

8. [Download] Video ready
   → Download MP4
   → Copy share link
   → Embed code
   → Social media snippets
```

### 7.2 Regenerate Workflow (Document Updated)

```
User: "I updated the training PDF"

System:
1. Upload new version
2. Compare with previous (diff view)
3. Re-run LLM on updated sections
4. Preview changes
5. Re-render video (same branding/voice)
6. Show "What changed" report
```

---

## 8. Quality Assurance

### 8.1 Testing Strategy

```
Unit Tests
└─ LLM prompt generation
└─ Scene duration calculation
└─ Animation path generation
└─ SkeletonTrace integration

Integration Tests
└─ Document upload → Storyboard
└─ Storyboard → Scene generation
└─ Scene → Video composition
└─ Full pipeline end-to-end

E2E Tests (Cypress/Playwright)
└─ Upload document
└─ Review storyboard
└─ Edit scene
└─ Render video
└─ Download & verify output

Performance Tests
└─ 1000 document uploads
└─ 100 concurrent renders
└─ LLM response times
└─ Remotion composition speed

Manual QA Checklist
□ Video audio sync
□ Text readability
□ Animation smoothness
□ Subtitle accuracy
□ Branding placement
□ Export quality (720p/1080p)
```

### 8.2 Monitoring & Analytics

```
Key Metrics:
- Document processing success rate (target: 99%)
- Storyboard generation quality (manual review sample)
- Average render time (target: < 5 min for 10 min video)
- Video playback errors (target: < 0.1%)
- User retention (30d, 60d, 90d)

Dashboards:
- Processing pipeline (queue depth, failures)
- Render performance (duration, GPU utilization)
- API response times
- LLM costs & token usage
- Storage usage trend

Alerts:
- Render queue > 10 pending
- Failed renders > 5% of total
- API error rate > 1%
- Database connection pool exhausted
```

---

## 9. MVP Scope & Timeline

### 9.1 MVP Features

**Phase 1 (Weeks 1-4)**: Core Infrastructure
- [ ] Document upload (PDF, Markdown)
- [ ] LLM integration (storyboard generation)
- [ ] Database setup
- [ ] API scaffolding

**Phase 2 (Weeks 5-8)**: Animation Pipeline
- [ ] SkeletonTrace integration
- [ ] Scene rendering
- [ ] Remotion composition
- [ ] MP4 export

**Phase 3 (Weeks 9-12)**: Polish & Launch
- [ ] Web UI (edit, preview, export)
- [ ] Branding customization
- [ ] Voice narration (TTS)
- [ ] Video sharing
- [ ] Analytics dashboard

### 9.2 Post-MVP Roadmap

**Q4 2026**:
- [ ] Multi-language subtitles
- [ ] Custom voice upload
- [ ] Animated characters
- [ ] Team collaboration
- [ ] API for partners

**Q1 2027**:
- [ ] Notion/Airtable integration
- [ ] Video templates
- [ ] Watermark removal (pro)
- [ ] Bulk upload
- [ ] Zapier integration

---

## 10. Technical Decisions & Rationale

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|------------|
| Animation Engine | Remotion / Three.js / FFmpeg | Remotion + SkeletonTrace | React-native, predictable output, can integrate SkeletonTrace |
| LLM | GPT-4 / Claude / Llama | Claude Opus | Context window, cost, quality for structured output |
| Image Gen | DALL-E / Flux / Midjourney | Flux | Cost, speed, API reliability |
| Database | PostgreSQL / MongoDB | PostgreSQL | ACID guarantees, Jsonb for flexibility |
| Queue | Bull / RQ / Celery | Bull (Node native) | Simplicity, Redis-backed, monitoring |
| Frontend Framework | Next.js / Remix / Vite | Next.js | Aligned with existing codebase |
| Hosting | Vercel / Railway / Fly | Vercel + Railway workers | Serverless for API, dedicated for workers |
| Storage | AWS S3 / Cloudflare R2 | Cloudflare R2 | Cost, performance, no egress fees |
| Real-time | WebSocket / Socket.io / Server-sent events | WebSocket + Fallback SSE | Lower latency, no extra library |

---

## 11. Security & Compliance

### 11.1 Security Measures

```
Authentication:
- OAuth2 with email/password fallback
- Session tokens (JWT, 7d expiry)
- TOTP 2FA for pro+ tiers

Authorization:
- User owns their projects/documents
- API key scoping (read/write/admin)
- Role-based access (user/admin/superadmin)

Data Protection:
- HTTPS/TLS only
- Encryption at rest (database, S3)
- PII redaction (documents)
- Audit logs for API access

Rate Limiting:
- 10 req/min per user (API)
- 3 concurrent renders per user
- 100 documents/month (free tier)

Privacy:
- No training on user documents
- GDPR compliance (data deletion, export)
- Privacy policy & terms
- No third-party data sharing
```

### 11.2 Compliance

```
GDPR:
- Data processing agreement (DPA)
- User consent for cookies
- Right to be forgotten (delete account)
- Data portability (export all data)

SOC 2:
- Access controls (least privilege)
- Audit logging
- Incident response plan
- Regular security training

CCPA (if US customers):
- Transparency in data collection
- User opt-out for data sale
- Service provider contracts
```

---

## 12. Success Metrics & KPIs

### 12.1 Product Metrics

```
Engagement:
- Documents uploaded per month (target: 1,000+)
- Storyboards generated (target: 95% success rate)
- Videos rendered (target: 5,000+/month by Q4)
- Average session duration (target: 15+ minutes)

Quality:
- Render success rate (target: 98%+)
- User satisfaction score (target: 4.5/5.0)
- Video playback errors (target: <0.1%)
- LLM output acceptance rate (target: 85%+)

Retention:
- 30-day retention (target: 45%+)
- 90-day retention (target: 25%+)
- Churn rate (target: <5%/month)
- NPS score (target: 40+)
```

### 12.2 Business Metrics

```
Acquisition:
- New signups/month (target: 500+)
- Conversion to paid (target: 5-10%)
- CAC payback period (target: < 12 months)

Revenue:
- MRR target: $50K by end of 2026
- ARPU target: $50/month pro, $200/month enterprise
- Gross margin target: 70%+

Growth:
- YoY growth (target: 300%+)
- Market share in docs → video (target: 5%+ by 2027)
```

---

## Appendix A: Technology Stack Summary

```
Frontend:
- Next.js 16+ (React 19)
- TypeScript
- Tailwind CSS
- Zustand (state)
- React Query (server state)
- Remotion (video composition)

Backend:
- Node.js 20+
- Hono (API framework)
- PostgreSQL 15+
- Bull/BullMQ (queue)
- Redis (cache)
- Prisma ORM

AI/ML:
- Claude API (Anthropic)
- Flux (image generation)
- ElevenLabs (TTS)

Infrastructure:
- Vercel (frontend)
- Railway/AWS EC2 (workers)
- PostgreSQL (managed)
- S3/R2 (storage)
- Cloudflare (CDN)

Tools:
- FFmpeg (video processing)
- canvas-node (image rendering)
- Remotion (video composition)
- Bull (job queue)
```

---

**End of Specification Document**

*Prepared: 2026-09-19*  
*Version: 1.0 (MVP Specification)*  
*Status: Ready for Development*
