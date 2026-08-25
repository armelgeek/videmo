# Video Generation Module

Integrated video generation from the Open Video Overview project into your Next.js boilerplate.

## Features

- **Multiple Formats**: Explainer (detailed) and Brief (short) videos
- **25+ Visual Styles**: Anime, watercolor, cinematic, isometric, and more
- **Aspect Ratios**: 16:9 (widescreen) and 9:16 (vertical/mobile)
- **16 Languages**: English, Spanish, French, German, Italian, Portuguese, Polish, Turkish, Russian, Dutch, Czech, Arabic, Chinese, Japanese, Korean, Hindi
- **Real-time Progress**: Live updates on generation status with clip preview

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Video Generator UI                         │
│  (components/video-generation/video-generator.tsx)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    POST /api/video/generate
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              API Endpoint (route.ts)                        │
│  • Validates input with Zod schema                          │
│  • Creates job in in-memory store                           │
│  • Starts background generation                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    GET /api/video/status/[jobId]
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Video Store (store.ts)                         │
│  • In-memory job management                                 │
│  • Progress tracking                                        │
│  • Ready for database migration                             │
└──────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Environment Variables

Add to `.env.local`:

```env
# For connecting to open-video-overview service (when deployed)
VIDEO_GENERATION_API_URL=http://localhost:3001
MAMMOUTH_API_KEY=your_mammouth_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

### 2. Install Dependencies

All dependencies are already installed. If needed:

```bash
npm install zod
```

### 3. Usage

Navigate to `/video-generator` in your protected routes:

```
http://localhost:3000/video-generator
```

## API Endpoints

### Generate Video

```bash
POST /api/video/generate
Content-Type: application/json

{
  "content": "Your video content here...",
  "format": "explainer",           # "explainer" or "brief"
  "style": "anime",                # 25+ styles available
  "aspectRatio": "16:9",           # "16:9" or "9:16"
  "language": "en",                # 16 languages
  "customInstructions": "...",     # optional
  "narrativeVoiceId": "..."        # optional ElevenLabs voice
}
```

**Response** (202 Accepted):

```json
{
  "success": true,
  "jobId": "job-1234567890-abc123",
  "message": "Video generation started"
}
```

### Get Generation Status

```bash
GET /api/video/status/{jobId}
```

**Response**:

```json
{
  "jobId": "job-1234567890-abc123",
  "status": "processing",
  "progress": {
    "status": "processing",
    "stage": "Generating images",
    "progress": 45,
    "clips": [
      {
        "index": 0,
        "title": "Intro",
        "imageUrl": "/api/video/mock/...",
        "status": "generated"
      }
    ]
  },
  "createdAt": "2024-08-25T...",
  "updatedAt": "2024-08-25T..."
}
```

## Stages of Generation

1. **Creating storyboard** - AI generates the video structure and script
2. **Generating images** - Creates visual elements for each clip
3. **Creating narration** - Text-to-speech generation
4. **Combining clips** - Merges images and audio
5. **Finalizing video** - Produces final MP4 output

## Video Type Details

### Explainer Videos

- **Duration**: 2-5 minutes typically
- **Purpose**: Detailed explanation of concepts
- **Use Cases**: Education, product demos, tutorials
- **Structure**: Intro → Content sections → Outro

### Brief Videos

- **Duration**: 15-60 seconds
- **Purpose**: Quick overviews or highlights
- **Use Cases**: Social media, shorts, summaries
- **Structure**: Condensed content

## Available Visual Styles

### Original Styles
- watercolor, anime, retro, whiteboard, classic

### High-Impact Styles
- cinematic, isometric, flat, comic, neon

### Artistic Styles
- oil, sketch, papercut, popart

### Audience-Specific
- storybook, pixel, minimalist, infographic

### Mood-Based
- documentary, gothic, pastel

### Educational/Professional
- 3b1b, corporate, presentation, tech

## Database Migration

The current implementation uses in-memory storage. To persist videos:

1. Create a `VideoJob` table in your database:

```prisma
model VideoJob {
  id        String   @id @default(cuid())
  content   String   @db.Text
  format    String   // "explainer" | "brief"
  style     String
  aspectRatio String
  language  String
  status    String   // "pending" | "processing" | "completed" | "error"
  progress  Json     // Store GenerationProgress
  videoUrl  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  userId    String   @db.VarChar(255)

  @@index([userId])
  @@index([createdAt])
}
```

2. Update `lib/video-generation/store.ts` to use Prisma:

```typescript
import { db } from "@/lib/db";
import { type VideoGenerationJob } from "./types";

export const videoStore = {
  createJob: async (request, userId) => {
    return db.videoJob.create({
      data: {
        content: request.content,
        format: request.format,
        style: request.style,
        aspectRatio: request.aspectRatio,
        language: request.language,
        status: "pending",
        progress: { status: "pending" },
        userId,
      },
    });
  },
  // ... implement other methods with Prisma
};
```

## Integration with Open Video Overview

To use the actual video generation service from open-video-overview:

1. Deploy open-video-overview service
2. Update `app/api/video/generate/route.ts` to call the actual API:

```typescript
const response = await fetch(`${process.env.VIDEO_GENERATION_API_URL}/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(validatedData),
});

const { jobId } = await response.json();
```

3. Poll the actual service for progress:

```typescript
const statusResponse = await fetch(
  `${process.env.VIDEO_GENERATION_API_URL}/status/${jobId}`
);
```

## Error Handling

The system handles:
- Invalid input (Zod validation)
- Generation failures
- Network errors
- Timeout scenarios

All errors are returned with descriptive messages via the UI toast system.

## Performance Considerations

- Generation runs in background (non-blocking)
- Uses polling (could upgrade to WebSockets)
- In-memory storage (upgrade to database for production)
- Job retention: unlimited in current implementation

## Future Enhancements

- [ ] Database persistence
- [ ] WebSocket for real-time updates
- [ ] User authentication per video
- [ ] Video history/library
- [ ] Template system
- [ ] Batch generation
- [ ] Custom voice training
- [ ] Advanced editing features
- [ ] Export formats (MP4, WebM, GIF)
