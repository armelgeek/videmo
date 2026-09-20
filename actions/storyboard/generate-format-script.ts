'use server'

import { generatePrompt, getFormat } from '@/lib/storyboard/formats'
import type { PromptConfig } from '@/lib/storyboard/formats'
import { auth } from '@/lib/auth'

export interface GenerateFormatScriptRequest {
  formatId: string
  topic: string
  targetAudience?: string
  tone?: string
  keyPoints?: string[]
  duration?: number
  additionalContext?: string
}

export interface GenerateFormatScriptResponse {
  success: boolean
  script?: string
  format?: string
  error?: string
}

/**
 * Generate a script for a video based on its format and parameters.
 * This action constructs the appropriate prompt template and would typically
 * call an LLM (OpenAI, etc.) to generate the actual script.
 */
export async function generateFormatScript(
  request: GenerateFormatScriptRequest
): Promise<GenerateFormatScriptResponse> {
  try {
    const session = await auth.getSession()
    if (!session) {
      return { success: false, error: 'Unauthorized' }
    }

    const { formatId, topic, targetAudience, tone, keyPoints, duration, additionalContext } =
      request

    // Validate format exists
    const format = getFormat(formatId)
    if (!format) {
      return { success: false, error: `Unknown format: ${formatId}` }
    }

    // Build prompt config
    const config: PromptConfig = {
      topic,
      targetAudience,
      tone: tone || format.script.defaultTone,
      keyPoints,
      duration,
      additionalContext,
    }

    // Generate the prompt
    const prompt = generatePrompt(formatId, config)
    if (!prompt) {
      return { success: false, error: `No prompt template for format: ${formatId}` }
    }

    // TODO: Call your LLM API here (OpenAI, Claude, etc.)
    // Example:
    // const script = await callOpenAI(prompt);

    // For now, return the prompt so you can test
    return {
      success: true,
      script: prompt,
      format: format.label,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate script',
    }
  }
}
