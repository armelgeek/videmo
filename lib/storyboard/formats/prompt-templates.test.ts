import { describe, it, expect } from 'vitest'
import {
  generatePrompt,
  getPromptTemplate,
  PROMPT_TEMPLATES,
  type PromptConfig,
} from './prompt-templates'

describe('Prompt Templates', () => {
  const basicConfig: PromptConfig = {
    topic: 'React Hooks',
    targetAudience: 'Beginner developers',
    tone: 'instructional',
    duration: 120,
  }

  describe('getPromptTemplate', () => {
    it('returns template for known format', () => {
      expect(getPromptTemplate('tutorial')).toBeDefined()
      expect(getPromptTemplate('story')).toBeDefined()
      expect(getPromptTemplate('product-demo')).toBeDefined()
      expect(getPromptTemplate('educational')).toBeDefined()
    })

    it('returns undefined for unknown format', () => {
      expect(getPromptTemplate('unknown-format')).toBeUndefined()
    })
  })

  describe('generatePrompt', () => {
    it('generates prompt for tutorial format', () => {
      const prompt = generatePrompt('tutorial', basicConfig)
      expect(prompt).toBeTruthy()
      expect(prompt).toContain('React Hooks')
      expect(prompt).toContain('Beginner developers')
      expect(prompt).toContain('step-by-step')
    })

    it('generates prompt for story format', () => {
      const prompt = generatePrompt('story', basicConfig)
      expect(prompt).toBeTruthy()
      expect(prompt).toContain('React Hooks')
      expect(prompt).toContain('narrative')
      expect(prompt).toContain('character')
    })

    it('generates prompt for product-demo format', () => {
      const prompt = generatePrompt('product-demo', basicConfig)
      expect(prompt).toBeTruthy()
      expect(prompt).toContain('React Hooks')
      expect(prompt).toContain('feature')
      expect(prompt).toContain('benefit')
    })

    it('generates prompt for educational format', () => {
      const prompt = generatePrompt('educational', basicConfig)
      expect(prompt).toBeTruthy()
      expect(prompt).toContain('React Hooks')
      expect(prompt).toContain('learning objective')
      expect(prompt).toContain('concept')
    })

    it('includes key points when provided', () => {
      const config: PromptConfig = {
        ...basicConfig,
        keyPoints: ['useState', 'useEffect', 'useContext'],
      }
      const prompt = generatePrompt('tutorial', config)
      expect(prompt).toContain('useState')
      expect(prompt).toContain('useEffect')
      expect(prompt).toContain('useContext')
    })

    it('includes additional context when provided', () => {
      const config: PromptConfig = {
        ...basicConfig,
        additionalContext: 'This is for a coding bootcamp',
      }
      const prompt = generatePrompt('tutorial', config)
      expect(prompt).toContain('This is for a coding bootcamp')
    })

    it('returns null for unknown format', () => {
      const prompt = generatePrompt('unknown-format', basicConfig)
      expect(prompt).toBeNull()
    })
  })

  describe('all template formats', () => {
    const formats = Object.keys(PROMPT_TEMPLATES) as Array<keyof typeof PROMPT_TEMPLATES>

    formats.forEach((format) => {
      it(`${format} template produces non-empty prompt`, () => {
        const prompt = generatePrompt(format, basicConfig)
        expect(prompt).toBeTruthy()
        expect(prompt?.length).toBeGreaterThan(100)
      })
    })
  })
})
