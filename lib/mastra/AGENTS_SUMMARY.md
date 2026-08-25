# Mastra AI Agents - Video Generation

Complete set of 4 specialized agents for professional video generation, imported from open-video-overview and adapted for OpenAI.

## Agents Overview

### 1. **videoChatAgent**
**Purpose**: Interprets user requests in natural language

**Capabilities**:
- Parse user messages ("Create a 2-min anime video about quantum physics")
- Intelligently determine video format (explainer vs brief)
- Suggest visual styles based on topic
- Detect language preferences
- Extract all video generation parameters

**Example**:
```
User: "Make a short anime video about AI"
↓ Agent extracts:
- content: "about AI"
- format: "brief" (because "short")
- style: "anime"
- aspectRatio: "16:9"
- language: "en"
```

### 2. **storyboardAgent**
**Purpose**: Creates cohesive video storyboards with character consistency

**Key Features**:
- Character continuity (same faces/clothes across clips)
- Narrative coherence (smooth transitions)
- Professional storytelling structure (intro → content → outro)
- Detailed image prompts for AI generation
- Visual consistency guidelines

**Output**:
```json
{
  "title": "Video title",
  "clips": [
    {
      "index": 0,
      "clipType": "intro",
      "narration": "2-4 sentence narration",
      "imagePrompt": "Detailed visual description",
      "duration": 10
    }
  ]
}
```

### 3. **scriptEnhancerAgent**
**Purpose**: Enhances narration for professional voice-over

**Capabilities**:
- Adds emotional direction tags: [excited], [curious], [thoughtful]
- Preserves professional tone
- Adds pacing markers: [pauses], [short pause]
- Emphasizes important words with CAPITALS
- Compatible with TTS engines (ElevenLabs, Azure)

**Example**:
```
Input: "Here's the key insight about quantum entanglement"
Output: "[thoughtfully] Here's the KEY INSIGHT about quantum entanglement"
```

### 4. **summarizationAgent**
**Purpose**: Maintains continuity across multiple clips

**Tracks**:
- Character descriptions (exact face, hair, clothing, accessories)
- Visual progression (environments, lighting, motifs)
- Narrative flow (plot points, concepts explained)
- Style consistency (colors, composition patterns)

**Output Format**:
```
CHARACTERS:
- Dr. Sarah: Brown-haired scientist, white lab coat, glasses

VISUAL PROGRESSION:
- Scene changed from lab to outdoor park
- Maintained warm golden hour lighting

NARRATIVE:
- Introduced quantum entanglement concept
- Next clip needs to explain practical applications
```

## Agent Architecture

```
User Request
     ↓
videoChatAgent (interpret + extract params)
     ↓
storyboardAgent (create story structure)
     ↓
scriptEnhancerAgent (enhance narration)
     ↓
summarizationAgent (track continuity for next clip)
     ↓
Video Output
```

## Configuration

All agents configured with:
- **Model**: `gpt-4o` (OpenAI)
- **Tools**: Specialized for their domain
- **Instructions**: Adapted from open-video-overview best practices

## Usage

### Direct Agent Call
```typescript
import { mastra } from "@/lib/mastra";

// Get agent
const agent = mastra.getAgent("videoChatAgent");

// Use agent
const response = await agent.generate(userMessage, {
  schema: z.object({ /* ... */ })
});
```

### In Workflow
```typescript
const storyboard = await storyboardAgent.generate(
  "Create storyboard for: " + content,
  { schema: storyboardSchema }
);
```

## Integration Points

### With Video Generator UI
- **videoChatAgent** processes user input from chat interface
- Extracts parameters for API call
- Validates against schema

### With Video Generation API
- **storyboardAgent** creates structure
- **scriptEnhancerAgent** enhances narration
- **summarizationAgent** maintains continuity

### With Open Video Overview
When connected to full service:
```typescript
// Call actual video service
const images = await generateImages(imagePrompts);
const audio = await generateAudio(enhancedNarration);
const video = await encodeVideo(images, audio);
```

## Best Practices

### For videoChatAgent
- Provide full context in user message
- Let agent infer format/style from topic
- Provide explicit language if non-English needed

### For storyboardAgent
- Include detailed content description
- Specify target audience
- Mention any characters or recurring elements

### For scriptEnhancerAgent
- Use with scripted narration only
- Don't add tags manually (agent will)
- Compatible with ElevenLabs voice IDs

### For summarizationAgent
- Use between clip generation
- Feed previous clip summaries into next iteration
- Maintain character descriptions exactly

## Performance Characteristics

- **videoChatAgent**: < 1 second (parameter extraction)
- **storyboardAgent**: 5-15 seconds (story creation)
- **scriptEnhancerAgent**: 2-5 seconds (script enhancement)
- **summarizationAgent**: 2-4 seconds (context compaction)

**Total workflow time**: 10-30 seconds (depending on content)

## Future Enhancements

- [ ] Custom prompt templates
- [ ] Agent chaining/orchestration
- [ ] Caching for repeated content
- [ ] Custom voice training pipeline
- [ ] A/B testing different styles
- [ ] Multi-language optimization
- [ ] Brand voice customization

## Troubleshooting

### Agent not responding
- Check OpenAI API key in environment
- Verify `gpt-4o` model availability
- Check network connectivity

### Poor quality output
- Provide more detailed context
- Specify target audience
- Include reference materials/quotes

### Inconsistent character descriptions
- Use summarizationAgent output from previous clips
- Feed summary to next storyboardAgent call
- Reference exact descriptions in prompts

## References

- Original agents: `~/dev/Hayzar/SAAS/open-video-overview/src/mastra/agents/`
- Video generation workflow: `lib/mastra/workflows/video-generation-workflow.ts`
- UI integration: `components/video-generation/video-generator.tsx`
