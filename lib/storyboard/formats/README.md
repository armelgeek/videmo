# Video Format System

A modular system for managing different types of video formats, each with its own script structure, visual style, and prompt template.

## Overview

The format system consists of:

1. **Video Formats** — defined in `*.ts` files (e.g., `tutorial.ts`, `story.ts`)
2. **Visual Presets** — defined in `visual-presets.ts` (color schemes, vocabularies, animation styles)
3. **Prompt Templates** — in `prompt-templates.ts` (AI-powered script generation)
4. **Format Registry** — in `index.ts` (lookup and validation)

## Supported Formats

### 1. Brief
- **ID:** `brief`
- **Family:** explainer
- **Duration:** ~30 seconds
- **Structure:** Hook → Problem → Solution → Benefit → Proof → CTA
- **Best for:** Quick product announcements, elevator pitches
- **Visual Style:** Doodles with labels and arrows

### 2. Explainer
- **ID:** `explainer`
- **Family:** explainer
- **Duration:** ~120 seconds
- **Structure:** Hook → Problem → Root Cause → Solution Overview → Details (2 parts) → How it Works → Benefits → Example → Summary
- **Best for:** Comprehensive product/concept explanations
- **Visual Style:** Labeled diagrams with arrows and connections

### 3. Tutorial
- **ID:** `tutorial`
- **Family:** explainer
- **Duration:** ~180 seconds
- **Structure:** Intro → Prerequisites → Step 1 → Steps 2-5 → Verification → Next Steps → Summary
- **Best for:** How-to guides, step-by-step instructions
- **Visual Style:** Numbered steps, checkmarks, UI callouts

### 4. Story
- **ID:** `story`
- **Family:** story
- **Duration:** ~180 seconds
- **Structure:** Setup → Inciting Incident → Rising Action → Turning Point → Climax → Resolution → Reflection
- **Best for:** Narrative-driven content, customer journeys, emotional storytelling
- **Visual Style:** Characters, scenes, dialogue, emotional expressions

### 5. Product Demo
- **ID:** `product-demo`
- **Family:** explainer
- **Duration:** ~120 seconds
- **Structure:** Hook → Problem → Intro → Feature 1 → Feature 2 → Feature 3 → Social Proof → CTA
- **Best for:** SaaS products, feature showcases, sales videos
- **Visual Style:** UI elements, features highlighted, clean layout

### 6. Educational
- **ID:** `educational`
- **Family:** explainer
- **Duration:** ~180 seconds
- **Structure:** Learning Objective → Context → Foundation 1 → Foundation 2 → Core Concept → Example 1 → Example 2 → Misconceptions → Summary → Advanced Topic → Resources
- **Best for:** Learning content, conceptual explanations, academic videos
- **Visual Style:** Diagrams, formulas, concept connections

## Usage

### Getting a Format

```typescript
import { getFormat, listFormats, isKnownFormat } from '@/lib/storyboard/formats'

// Get a single format
const format = getFormat('tutorial')

// List all formats
const all = listFormats()

// Filter by family
import { listFormatsByFamily } from '@/lib/storyboard/formats'
const explainers = listFormatsByFamily('explainer')

// Check if format exists
if (isKnownFormat('story')) {
  // ...
}
```

### Generating Scripts

```typescript
import { generatePrompt } from '@/lib/storyboard/formats'

const config = {
  topic: 'React Hooks',
  targetAudience: 'Beginner developers',
  tone: 'instructional',
  keyPoints: ['useState', 'useEffect', 'useContext'],
  duration: 180,
  additionalContext: 'For a coding bootcamp'
}

// Get the prompt template for an LLM
const prompt = generatePrompt('tutorial', config)

// Send this to OpenAI, Claude, etc.
const response = await openai.createCompletion({
  prompt: prompt,
  // ... other params
})
```

### Using the Server Action

```typescript
'use client'

import { generateFormatScript } from '@/actions/storyboard/generate-format-script'

const response = await generateFormatScript({
  formatId: 'tutorial',
  topic: 'React Hooks',
  targetAudience: 'Beginners',
  tone: 'instructional',
  keyPoints: ['useState', 'useEffect'],
  duration: 180,
})

if (response.success) {
  console.log('Script prompt:', response.script)
}
```

### Using the Format Selector Component

```typescript
'use client'

import { FormatSelector } from '@/components/molecules/storyboard/format-selector'
import { generateFormatScript } from '@/actions/storyboard/generate-format-script'

export default function MyPage() {
  const handleGenerateScript = async (formatId: string, config: any) => {
    const response = await generateFormatScript({
      formatId,
      ...config,
    })
    // Handle response
  }

  return (
    <FormatSelector
      onGenerateScript={handleGenerateScript}
      defaultFormatId="tutorial"
    />
  )
}
```

## Architecture

### Format Definition

Each format is defined as a `VideoFormat` object:

```typescript
interface VideoFormat {
  id: string                          // Unique identifier (never change for existing formats)
  version: number                     // Increment on breaking changes
  label: string                       // Display name
  hint: string                        // Short description
  family: FormatFamily                // 'explainer' or 'story'
  thumbnailUrl: string                // Visual preview
  script: {
    paragraphs: number                // Expected number of scenes
    structure: string[]               // Breakdown of structure
    defaultTone: string               // Suggested tone
  }
  breakdown: {
    rules: string[]                   // Key guidelines for creators
  }
  visual: VisualPreset                // Visual style configuration
  character?: FormatCharacter         // Optional recurring character
}
```

### Visual Preset

Defines the visual appearance and animation style:

```typescript
interface VisualPreset {
  id: string                          // e.g., 'tutorial-steps'
  vocabulary: string[]                // Visual elements (arrows, numbers, etc)
  accentColors: string[]              // Color palette
  labels: LabelPolicy                 // 'every-subject' | 'key-subjects' | 'none'
  defaultAnimationStyle: string       // 'chunkjump', 'sequential', 'fade', etc
}
```

### Prompt Template

Each format has a prompt template for LLM-based script generation:

```typescript
interface PromptConfig {
  topic: string
  targetAudience?: string
  tone?: string
  keyPoints?: string[]
  duration?: number                   // in seconds
  additionalContext?: string
}

const template = PROMPT_TEMPLATES['tutorial']
const prompt = template(config)
// Send to LLM for script generation
```

## Adding a New Format

1. **Create a visual preset** in `visual-presets.ts`:

```typescript
export const MY_PRESET: VisualPreset = {
  id: 'my-preset',
  vocabulary: ['element1', 'element2'],
  accentColors: ['red', 'blue'],
  labels: 'key-subjects',
  defaultAnimationStyle: 'fade',
}
```

2. **Define the format** in a new file (e.g., `my-format.ts`):

```typescript
import { MY_PRESET } from './visual-presets'
import type { VideoFormat } from './types'

export const myFormat: VideoFormat = {
  id: 'my-format',
  version: 1,
  label: 'My Format',
  hint: 'Description of format',
  family: 'explainer',
  thumbnailUrl: '/formats/my-format.webp',
  script: {
    paragraphs: 8,
    structure: ['Part 1', 'Part 2', /* ... */],
    defaultTone: 'conversational',
  },
  breakdown: { rules: ['Rule 1', 'Rule 2'] },
  visual: MY_PRESET,
}
```

3. **Add prompt template** in `prompt-templates.ts`:

```typescript
export const PROMPT_TEMPLATES = {
  'my-format': (config: PromptConfig): string => `
    Your instructions here...
    Topic: ${config.topic}
    // ... rest of template
  `,
  // ... other templates
}
```

4. **Import and register** in `index.ts`:

```typescript
import { myFormat } from './my-format'

const FORMATS: readonly VideoFormat[] = [
  // ... existing formats
  myFormat,
]
```

5. **Add tests** in `prompt-templates.test.ts`

6. **Update thumbnails** — add preview image to `/public/formats/my-format.webp`

## Testing

```bash
npm test -- lib/storyboard/formats/prompt-templates.test.ts
```

Tests verify:
- All formats have valid templates
- Prompt generation includes topic, audience, key points
- Configuration fallbacks work correctly
- Unknown formats return null

## Future Enhancements

- [ ] Branching narratives (multiple story paths)
- [ ] Multi-language format customization
- [ ] Format templates for specific industries
- [ ] A/B testing different formats for the same content
- [ ] Format performance metrics (engagement, conversion)
- [ ] Custom format builder UI
- [ ] Format presets for common topics (SaaS, B2B, B2C, education, etc.)

## Integration with LLM APIs

The `generatePrompt()` function returns a prompt string ready for:

- **OpenAI:** `gpt-4`, `gpt-3.5-turbo`
- **Claude:** `claude-3-opus`, `claude-3-sonnet`
- **Any other API** that accepts text prompts

Example integration:

```typescript
import { generatePrompt } from '@/lib/storyboard/formats'

async function generateScriptWithOpenAI(formatId: string, config) {
  const prompt = generatePrompt(formatId, config)

  const response = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a professional scriptwriter.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  return response.choices[0].message.content
}
```
