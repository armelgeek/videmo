'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoryboardStore } from '@/lib/storyboard/store';
import { useToastContext } from '@/components/ui/sonner';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import type { Annotation } from '../schema';

interface NarrationGenerationModalProps {
  annotation: Annotation;
  selectedVoiceId: string;
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (annotation: Annotation) => void;
}

export function NarrationGenerationModal({
  annotation,
  selectedVoiceId,
  isOpen,
  onClose,
  onGenerated,
}: NarrationGenerationModalProps) {
  const { toast } = useToastContext();
  const { setIsPlaying } = useUnifiedEngineStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateNarration = async () => {
    if (!annotation.text) {
      toast.error('Annotation text is empty');
      return;
    }

    setIsGenerating(true);
    setStatus('generating');
    setProgress(0);
    setErrorMessage(null);

    try {
      // Simulate progress (real API would stream)
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 15, 85));
      }, 200);

      // Call API to generate narration
      const response = await fetch('/api/generate-narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: annotation.text,
          voiceId: selectedVoiceId,
          annotationId: annotation.id,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate narration');
      }

      const data = await response.json();
      setProgress(100);
      setStatus('success');

      // Update annotation with generated audio + waveform
      const updatedAnnotation: Annotation = {
        ...annotation,
        narration: {
          text: annotation.text,
          audioUrl: data.audioUrl,
          waveformPeaks: data.waveformPeaks,
          durationMs: data.durationMs,
          transcriptText: data.transcript,
          generatedAt: Date.now(),
        },
      };

      toast.success('Narration generated successfully');
      onGenerated(updatedAnnotation);

      // Start animation playback when narration is ready
      // The audio-clock will drive the timeline from this point
      setIsPlaying(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      setStatus('error');
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(message);
      toast.error(message);
      setProgress(0);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h3 className="text-lg font-semibold">Generate Narration</h3>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Annotation Text Preview */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Annotation Text
            </label>
            <div className="p-3 bg-muted/50 rounded-lg border border-border/50 text-sm">
              {annotation.text || '(empty)'}
            </div>
          </div>

          {/* Voice Info */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Voice
            </label>
            <div className="p-3 bg-muted/50 rounded-lg border border-border/50 text-sm capitalize">
              {selectedVoiceId.replace(/-/g, ' ')}
            </div>
          </div>

          {/* Progress Bar */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Processing</span>
                <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/50">
                <div
                  className="bg-gradient-to-r from-primary to-primary/70 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Status Messages */}
          {status === 'success' && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm text-green-700 dark:text-green-400">
                Narration generated successfully!
              </span>
            </div>
          )}

          {status === 'error' && errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700 dark:text-red-400">{errorMessage}</span>
            </div>
          )}

          {/* Idle State Info */}
          {status === 'idle' && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-700 dark:text-blue-400">
              Click generate to create narration for this annotation using the selected voice.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-border/50">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerateNarration}
            disabled={isGenerating || status === 'success'}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : status === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Done
              </>
            ) : (
              'Generate'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
