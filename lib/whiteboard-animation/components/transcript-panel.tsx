'use client';

import { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useStoryboardStore } from '@/lib/storyboard/store';
import { parseTranscript } from '../audio/transcript';
import { applyCueToAnnotation, linkCueToAnnotation } from '../audio/apply-cue';
import type { TranscriptCue } from '../audio/types';

function detectFormat(filename: string): 'srt' | 'vtt' | 'json' {
  if (filename.endsWith('.vtt')) return 'vtt';
  if (filename.endsWith('.json')) return 'json';
  return 'srt';
}

export function TranscriptPanel() {
  const transcript = useStoryboardStore((s) => s.whiteboardConfig.transcript);
  const annotations = useStoryboardStore((s) => s.whiteboardConfig.annotations);
  const setTranscript = useStoryboardStore((s) => s.setTranscript);
  const updateAnnotation = useStoryboardStore((s) => s.updateAnnotation);

  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const cues = parseTranscript(text, detectFormat(file.name));
      setTranscript(cues);
    } catch (err) {
      console.error('Failed to parse transcript:', err);
    }
  };

  const handleLinkToAnnotation = (cue: TranscriptCue, annotationId: string) => {
    const annotation = annotations.find((a) => a.id === annotationId);
    if (!annotation) return;

    const updated = applyCueToAnnotation(cue, annotation);
    updateAnnotation(annotationId, updated);

    const linkedCue = linkCueToAnnotation(cue, annotationId);
    setTranscript(
      transcript.map((c) => (c.id === cue.id ? linkedCue : c))
    );
    setSelectedCueId(null);
  };

  return (
    <div className="space-y-4 p-6 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold">Transcript</h3>

      <div className="grid gap-2">
        <Label>Import transcript (SRT, VTT, or JSON)</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".srt,.vtt,.json"
          onChange={handleFileSelect}
          className="text-sm"
        />
      </div>

      {transcript.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {transcript.length} cues
          </p>
          {transcript.map((cue) => (
            <div
              key={cue.id}
              className="p-2 border border-border rounded bg-muted/10 text-xs space-y-1"
            >
              <div className="flex justify-between">
                <span className="font-mono text-muted-foreground">
                  {(cue.startMs / 1000).toFixed(1)}s – {(cue.endMs / 1000).toFixed(1)}s
                </span>
                {cue.annotationId ? (
                  <span className="text-primary font-medium">
                    → {cue.annotationId}
                  </span>
                ) : selectedCueId === cue.id ? (
                  <select
                    autoFocus
                    onChange={(e) => handleLinkToAnnotation(cue, e.target.value)}
                    onBlur={() => setSelectedCueId(null)}
                    className="text-xs border border-border rounded"
                  >
                    <option value="">Select annotation…</option>
                    {annotations.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[10px]"
                    onClick={() => setSelectedCueId(cue.id)}
                  >
                    Link
                  </Button>
                )}
              </div>
              <p className="text-foreground">{cue.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
