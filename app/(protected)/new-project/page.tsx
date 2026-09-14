'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/client';
import { cn } from '@/lib/utils';
import { AppShell } from '@/lib/app-shell';

const FORMATS = [
  { value: '16:9', label: 'Landscape', hint: 'YouTube, slides', width: 56, height: 32 },
  { value: '9:16', label: 'Portrait', hint: 'Reels, Shorts, TikTok', width: 22, height: 40 },
  { value: '1:1', label: 'Square', hint: 'Feed posts', width: 36, height: 36 },
] as const;

type Format = (typeof FORMATS)[number]['value'];

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [aspectRatio, setAspectRatio] = useState<Format>('16:9');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    setIsCreating(true);
    const res = await api.post<{ id: string }>('/api/video-projects', {
      title: title.trim(),
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
    <AppShell contentClassName="bg-neutral-950">
      <div className="px-4 py-6 sm:px-8">
        <Link
          href="/workspace"
          className="inline-flex items-center gap-2 rounded-md text-sm text-gray-400 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-rose-500/70"
        >
          <ArrowLeft className="h-4 w-4" />
          Projects
        </Link>

        <form onSubmit={handleCreate} className="mx-auto mt-10 max-w-2xl space-y-10">
          <div>
            <h1 className="text-3xl font-bold text-white">New project</h1>
            <p className="mt-2 text-sm text-gray-400">
              Name it and pick a format. You write the script next.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="project-title" className="block text-sm font-semibold text-white">
              Project name
            </label>
            <input
              id="project-title"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
              placeholder="How photosynthesis works"
              className="h-12 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-base text-white placeholder:text-gray-600 outline-none transition focus:border-rose-500/50 focus:bg-white/10"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-white">Format</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {FORMATS.map((format) => {
                const selected = aspectRatio === format.value;
                return (
                  <label
                    key={format.value}
                    className={cn(
                      'relative flex cursor-pointer flex-col items-center rounded-xl border p-5 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rose-500/70',
                      selected
                        ? 'border-rose-500/50 bg-gradient-to-br from-rose-500/15 to-violet-500/15'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]',
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
                          selected ? 'border-rose-400 bg-rose-400/15' : 'border-gray-500',
                        )}
                        style={{ width: format.width, height: format.height }}
                      />
                    </span>
                    <span className="mt-3 text-sm font-semibold text-white">{format.label}</span>
                    <span className="mt-0.5 text-xs text-gray-500">
                      {format.value} · {format.hint}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
            <Link
              href="/workspace"
              className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!title.trim() || isCreating}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white outline-none transition hover:shadow-lg hover:shadow-rose-500/20 focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreating ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
