'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FolderOpen } from 'lucide-react';

interface InkplainerTopbarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onOpenProjectsModal?: () => void;
  onOpenProjects?: () => void;
  onExport?: () => void;
}

export const InkplainerTopbar: React.FC<InkplainerTopbarProps> = ({
  projectName,
  onProjectNameChange,
  onOpenProjectsModal,
  onOpenProjects,
  onExport,
}) => {
  const handleProjects = onOpenProjectsModal || onOpenProjects || (() => {});

  return (
    <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={handleProjects} className="flex gap-2 text-xs font-medium">
          <FolderOpen className="w-4 h-4 text-primary" />
          <span>Projects</span>
        </Button>
        <div className="h-4 w-px bg-border" />
        <input
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          className="bg-transparent text-sm font-semibold focus:outline-none border-b border-transparent focus:border-primary px-1"
          placeholder="Project Title"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onExport} className="flex gap-2 text-xs">
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </Button>
      </div>
    </header>
  );
};