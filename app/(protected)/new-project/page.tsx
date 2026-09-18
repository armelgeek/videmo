'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/client';
import { cn } from '@/lib/utils';
import { AppShell } from '@/lib/app-shell';
import { SketchHint } from '@/components/molecules/sketch-hint';

const FORMATS = [
  { value: '16:9', label: 'Landscape', hint: 'YouTube, slides', width: 56, height: 32 },
  { value: '9:16', label: 'Portrait', hint: 'Reels, Shorts, TikTok', width: 22, height: 40 },
  { value: '1:1', label: 'Square', hint: 'Feed posts', width: 36, height: 36 },
] as const;

type Format = (typeof FORMATS)[number]['value'];

export default function NewProjectPage() {
  const router = useRouter();
  const [script, setScript] = useState('');
  const [aspectRatio, setAspectRatio] = useState<Format>('16:9');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!script.trim()) return;

    setIsCreating(true);
    const res = await api.post<{ id: string }>('/api/video-projects', {
      title: `Project ${new Date().toLocaleDateString()}`,
      script: script.trim(),
      aspectRatio,
    });
    if (!res.ok) {
      setIsCreating(false);
      toast.error(res.error ?? 'Project could not be created.');
      return;
    }
    router.push(`/storyboard?project=${res.data.id}`);
  };

  return (
    <AppShell contentClassName="bg-background">
      <div className="px-4 py-6 sm:px-8">
        <Link
          href="/workspace"
          className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-highlight"
        >
          <ArrowLeft className="h-4 w-4" />
          Projects
        </Link>

        <form onSubmit={handleCreate} className="mx-auto mt-10 max-w-2xl space-y-10">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Create your video</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Write your script, pick a format, and we'll generate it.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="script" className="block text-sm font-semibold text-foreground">
              Your script
            </label>
            <textarea
              id="script"
              autoFocus
              value={script}
              onChange={(event) => setScript(event.target.value)}
              rows={6}
              placeholder="Describe what you want to show: the message, key points, your audience…"
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground outline-none transition focus:border-ink focus:bg-accent resize-none"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">Format</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {FORMATS.map((format) => {
                const selected = aspectRatio === format.value;
                return (
                  <label
                    key={format.value}
                    className={cn(
                      'relative flex cursor-pointer flex-col items-center rounded-xl border p-5 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-highlight',
                      selected
                        ? 'border-ink bg-gradient-to-br from-highlight/15 to-highlight/15'
                        : 'border-border bg-card hover:border-ink hover:bg-accent',
                    )}
                  >
                    <input
                      type="radio"
                      name="aspect-ratio"
                      value={format.value}
                      checked={selected}
                      onChange={() => setAspectRatio(format.value)}
                      className="sr-only"
                    />
                    <span className="flex h-12 items-center justify-center">
                      <span
                        className={cn(
                          'rounded-[3px] border-2 transition-colors',
                          selected ? 'border-ink bg-highlight/20' : 'border-border',
                        )}
                        style={{ width: format.width, height: format.height }}
                      />
                    </span>
                    <span className="mt-3 text-sm font-semibold text-foreground">{format.label}</span>
                    <span className="mt-0.5 text-xs text-muted-foreground">
                      {format.value} · {format.hint}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <Link
              href="/workspace"
              className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!script.trim() || isCreating}
              className="inline-flex items-center gap-2 rounded-lg bg-highlight text-highlight-foreground border-2 border-ink px-5 py-2.5 text-sm font-semibold outline-none transition hover:shadow-lg hover:shadow-rose-500/20 focus-visible:ring-2 focus-visible:ring-highlight disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreating ? 'Generating…' : 'Generate video'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
