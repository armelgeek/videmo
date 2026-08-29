'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Scissors, Check } from 'lucide-react';

interface InkplainerSlicerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InkplainerSlicerModal: React.FC<InkplainerSlicerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[640px] max-w-[90vw] bg-white rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Image Slicer Tool</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-center">
          <div className="w-full h-48 bg-slate-100 border border-dashed border-border rounded-xl flex items-center justify-center text-xs text-muted-foreground">
            Slicer Canvas Preview Area — Draw slice regions across your image
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={onClose} className="bg-black hover:bg-zinc-800 text-white">
              <Check className="w-3.5 h-3.5 mr-1" />
              Apply Slices
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
