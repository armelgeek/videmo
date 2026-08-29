'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Folder } from 'lucide-react';

interface InkplainerProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject?: (proj: { id: string; name: string }) => void;
  projects?: Array<{ id: string; name: string }>;
}

export const InkplainerProjectsModal: React.FC<InkplainerProjectsModalProps> = ({
  isOpen,
  onClose,
  onSelectProject,
  projects = [{ id: '1', name: 'Demo Bag Scene' }],
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-lg font-bold">Saved Projects</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelectProject?.(p)}
              className="p-3 border border-border rounded-lg hover:border-primary cursor-pointer flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Folder className="w-4 h-4 text-primary" />
                <span>{p.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};