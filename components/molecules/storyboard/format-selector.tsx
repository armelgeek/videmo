'use client'

import { useState } from 'react'
import { listFormats, getFormat } from '@/lib/storyboard/formats'
import type { VideoFormat } from '@/lib/storyboard/formats'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface FormatSelectorProps {
  onFormatSelect?: (format: VideoFormat) => void
  onGenerateScript?: (formatId: string, config: any) => Promise<void>
  defaultFormatId?: string
}

export function FormatSelector({ onFormatSelect, onGenerateScript, defaultFormatId }: FormatSelectorProps) {
  const formats = listFormats()
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat>(
    defaultFormatId ? getFormat(defaultFormatId) : getFormat()
  )
  const [topic, setTopic] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [tone, setTone] = useState(selectedFormat.script.defaultTone)
  const [duration, setDuration] = useState(selectedFormat.script.paragraphs * 15)
  const [keyPoints, setKeyPoints] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleFormatChange = (formatId: string) => {
    const format = getFormat(formatId)
    setSelectedFormat(format)
    setTone(format.script.defaultTone)
    setDuration(format.script.paragraphs * 15)
    onFormatSelect?.(format)
  }

  const handleGenerateScript = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic')
      return
    }

    if (!onGenerateScript) {
      toast.error('Script generation not configured')
      return
    }

    setIsGenerating(true)
    try {
      await onGenerateScript(selectedFormat.id, {
        topic,
        targetAudience: targetAudience || undefined,
        tone: tone || undefined,
        duration: duration || undefined,
        keyPoints: keyPoints ? keyPoints.split(',').map((p) => p.trim()) : undefined,
      })
      toast.success('Script generated!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate script')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6 p-6 border rounded-lg bg-card">
      <div>
        <h2 className="text-lg font-semibold mb-4">Select Video Format</h2>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {formats.map((format) => (
            <button
              key={format.id}
              onClick={() => handleFormatChange(format.id)}
              className={`p-3 border rounded-lg text-left transition-colors ${
                selectedFormat.id === format.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-accent/50'
              }`}
            >
              <h3 className="font-semibold">{format.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">{format.hint}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {format.script.paragraphs} scenes
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold">Format Details</h3>
        <div className="text-sm space-y-2">
          <p>
            <strong>Family:</strong> {selectedFormat.family}
          </p>
          <p>
            <strong>Structure:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            {selectedFormat.script.structure.map((item, i) => (
              <li key={i} className="text-xs">
                {item}
              </li>
            ))}
          </ol>
          <p className="mt-3">
            <strong>Breakdown Rules:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            {selectedFormat.breakdown.rules.map((rule, i) => (
              <li key={i} className="text-xs">
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">Script Parameters</h3>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="topic">Topic *</Label>
            <Input
              id="topic"
              placeholder="e.g., How to use React hooks"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="audience">Target Audience</Label>
            <Input
              id="audience"
              placeholder="e.g., Beginner developers"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tone">Tone</Label>
            <Input
              id="tone"
              placeholder={selectedFormat.script.defaultTone}
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="duration">Duration (seconds)</Label>
            <Input
              id="duration"
              type="number"
              placeholder="120"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="keyPoints">Key Points (comma-separated)</Label>
          <Input
            id="keyPoints"
            placeholder="e.g., Component reuse, State management, Performance"
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
          />
        </div>
      </div>

      <Button
        onClick={handleGenerateScript}
        disabled={isGenerating || !topic.trim()}
        className="w-full"
      >
        {isGenerating ? 'Generating...' : 'Generate Script'}
      </Button>
    </div>
  )
}
