'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client';
import { ProjectThumbnail } from '@/components/organisms/workspace/project-thumbnail';
import type { ProjectListResponse } from '@/components/organisms/workspace/types';

interface InkplainerProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject?: (proj: { id: string; name: string }) => void;
}

export const InkplainerProjectsModal: React.FC<InkplainerProjectsModalProps> = ({
  isOpen,
  onClose,
  onSelectProject,
}) => {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectListResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setProjects(null);
    api.get<ProjectListResponse>('/api/video-projects?limit=20').then((res) => {
      if (res.ok) setProjects(res.data.data);
      else setError(res.error ?? 'Projects could not be loaded.');
    });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-lg font-bold">Open a project</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0" aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {error ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{error}</p>
          ) : projects === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  onSelectProject?.({ id: project.id, name: project.title });
                  router.push(`/storyboard?project=${project.id}`);
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-transparent p-2 text-left transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none"
              >
                <ProjectThumbnail
                  compact
                  previewUrl={project.previewUrl}
                  aspectRatio={project.aspectRatio}
                  className="w-16 shrink-0 rounded"
                />
                <span className="truncate text-sm font-medium">{project.title}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
