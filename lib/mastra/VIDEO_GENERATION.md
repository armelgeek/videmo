# Mastra AI - Video Generation Integration

Complete AI-powered video generation using Mastra agents and workflows.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Chat Interface (User Request)                  │
│         "Create a 2-min anime video about AI"               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    POST /api/video/generate
                           │
┌──────────────────────────▼──────────────────────────────────┐
│          Mastra videoChatAgent                              │
│  • Interprets natural language                              │
│  • Extracts video parameters                                │
│  • Validates inputs with Zod                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                  Runs workflow with parameters
                           │
┌──────────────────────────▼──────────────────────────────────┐
│     Mastra videoGenerationWorkflow (5 steps)                │
│                                                              │
│  Step 1: Validate Parameters                                │
│  ↓                                                           │
│  Step 2: Generate Storyboard (AI Agent)                    │
│  ↓                                                           │
│  Step 3: Generate Images (Gemini/Service)                  │
│  ↓                                                           │
│  Step 4: Generate Narration (ElevenLabs/Service)           │
│  ↓                                                           │
│  Step 5: Combine into Video (FFmpeg)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
        Updates Job Store with progress & result
                           │
┌──────────────────────────▼──────────────────────────────────┐
│         UI: Display Progress & Preview Clips                │
│  • Real-time progress bar                                   │
│  • Generated image preview                                  │
│  • Final video player                                       │
└──────────────────────────────────────────────────────────────┘
```

## Agents

### videoChatAgent

**Purpose**: Interprets natural language requests and extracts video parameters

**Capabilities**:
- Parse user messages like "Create a 2-minute anime video about quantum physics"
- Intelligently determine video format (explainer vs brief)
- Suggest appropriate visual styles based on topic
- Detect language and aspect ratio preferences
- Handle optional parameters like custom instructions

**Example Usage**:

```typescript
import { mastra } from "@/lib/mastra";

const agent = mastra.getAgent("videoChatAgent");

const response = await agent.generate(
  'Create an explainer video about how photosynthesis works in a minimalist style',
  {
    schema: z.object({
      // Returns extracted parameters
      format: z.enum(["explainer", "brief"]),
      style: z.string(),
      content: z.string(),
    }),
  }
);
```

## Workflows

### videoGenerationWorkflow

**Purpose**: Orchestrates the complete video generation process

**Input Schema**:
```typescript
{
  content: string;              // Main video content
  format: "explainer" | "brief"; // Video type
  style: string;                 // Visual style
  aspectRatio: "16:9" | "9:16";  // Widescreen or vertical
  language: string;              // 16 languages supported
  customInstructions?: string;   // Optional custom guidance
  narrativeVoiceId?: string;     // ElevenLabs voice ID
  narrativeStyle?: string;       // "professional", "casual", etc.
}
```

**Output Schema**:
```typescript
{
  videoUrl: string;      // Path to generated video
  totalDuration: number; // Video length in seconds
  clipsCount: number;    // Number of clips in video
}
```

**Workflow Steps**:

1. **Validate Parameters**
   - Check content length (10-50,000 chars)
   - Validate format, style, aspect ratio
   - Return validation errors if any

2. **Generate Storyboard**
   - Use videoChatAgent to create story structure
   - Generate narrative flow and clip outlines
   - Return title, clips with narration and image prompts

3. **Generate Images**
   - Process each clip's image prompt
   - Call Gemini or image generation service
   - Return clip previews for real-time display

4. **Generate Narration**
   - Convert narration text to speech
   - Use ElevenLabs or system TTS
   - Calculate clip durations based on audio

5. **Combine Video**
   - Use FFmpeg to combine images and audio
   - Add transitions and effects
   - Return final video URL

## Integration Points

### For Open Video Overview Service

When deploying the full open-video-overview service:

1. Update environment variables:
```env
VIDEO_GENERATION_API_URL=http://video-service:3001
MAMMOUTH_API_KEY=xxx
ELEVENLABS_API_KEY=xxx
```

2. Modify steps to call actual services:

```typescript
// In video-generation-workflow.ts
const generateImagesStep = createStep({
  execute: async ({ inputData }) => {
    const response = await fetch(
      `${process.env.VIDEO_GENERATION_API_URL}/generate-images`,
      { method: "POST", body: JSON.stringify(inputData) }
    );
    return response.json();
  },
});
```

### For Custom Models

To use different AI models:

1. Update videoChatAgent model:
```typescript
export const videoChatAgent = createAgent({
  model: "claude-sonnet-5", // or other model
  // ...
});
```

2. Modify workflow steps to call your services

## Usage Examples

### Via API

```bash
curl -X POST http://localhost:3000/api/video/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Explain quantum entanglement in simple terms",
    "format": "explainer",
    "style": "cinematic",
    "aspectRatio": "16:9",
    "language": "en"
  }'
```

### Via UI

Navigate to `/video-generator` and:
1. Enter your content
2. Select format (explainer/brief)
3. Choose visual style
4. Pick aspect ratio and language
5. Click "Generate Video"
6. Monitor progress in real-time
7. Download completed video

### Programmatically

```typescript
import { mastra } from "@/lib/mastra";

const result = await mastra.runWorkflow("videoGenerationWorkflow", {
  content: "Your video content here",
  format: "brief",
  style: "anime",
  aspectRatio: "9:16",
  language: "ja",
});

console.log(`Video ready: ${result.videoUrl}`);
```

## Configuration

### Video Formats

- **Explainer**: 2-5 minute detailed videos for education and explanation
- **Brief**: 15-60 second quick videos for social media and summaries

### Visual Styles (25 options)

**Original**: watercolor, anime, retro, whiteboard, classic
**High-Impact**: cinematic, isometric, flat, comic, neon
**Artistic**: oil, sketch, papercut, popart
**Audience**: storybook, pixel, minimalist, infographic
**Mood**: documentary, gothic, pastel
**Professional**: 3b1b, corporate, presentation, tech

### Supported Languages

en, es, fr, de, it, pt, pl, tr, ru, nl, cs, ar, zh, ja, ko, hi

### Aspect Ratios

- **16:9**: Desktop, TV, YouTube
- **9:16**: Mobile, TikTok, Instagram Reels, Shorts

## Error Handling

The workflow handles:

- **Validation errors**: Invalid content, format, or parameters
- **Generation failures**: API timeouts, service errors
- **Missing services**: Graceful fallback if image/audio services unavailable
- **Resource limits**: Content length, processing time

All errors are logged and returned to the client with descriptive messages.

## Performance

- Validation: < 1 second
- Storyboard generation: 5-15 seconds (depends on model)
- Image generation: 30-60 seconds per clip
- Audio generation: 5-10 seconds per clip
- Video combining: 10-20 seconds
- **Total**: 2-3 minutes for typical video

## Monitoring

Track video generation via:
- Job store (in-memory or database)
- Mastra observability and logging
- Real-time progress updates via polling
- Error tracking and retry logic

## Future Enhancements

- [ ] WebSocket for real-time updates (replaces polling)
- [ ] Batch video generation
- [ ] Video templates and presets
- [ ] Custom voice training
- [ ] Advanced editing tools
- [ ] Multiple export formats
- [ ] Concurrent clip processing
- [ ] Caching for repeated content
- [ ] Analytics dashboard
- [ ] Subscription quotas

## Troubleshooting

### Agent not responding
- Check Mastra configuration in `lib/mastra/index.ts`
- Verify API keys for AI services
- Check network connectivity

### Workflow timeout
- Increase timeout in workflow configuration
- Check service availability (Gemini, ElevenLabs, etc.)
- Reduce content length

### Missing imports
- Ensure all agents and workflows are exported
- Check imports in API routes
- Rebuild TypeScript

See main `lib/video-generation/README.md` for additional setup details.
