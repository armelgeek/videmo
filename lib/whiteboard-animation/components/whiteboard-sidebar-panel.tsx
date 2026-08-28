'use client';

import type React from 'react';
import { WhiteboardEditorPanel } from './whiteboard-editor-panel';
import { useToastContext } from '@/components/ui/sonner';

interface WhiteboardSidebarPanelProps {
  onClipAdd?: (clipData: {
    mediaId: string;
    startTime: number;
    duration: number;
  }) => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

/**
 * Whiteboard Editor Panel designed to integrate into the editor's sidebar.
 * This wrapper connects the whiteboard editor to the main timeline.
 */
export const WhiteboardSidebarPanel: React.FC<WhiteboardSidebarPanelProps> = ({
  onClipAdd,
  canvasWidth = 1280,
  canvasHeight = 720,
}) => {
  const { toast } = useToastContext();

  const handleClipCreate = (clipData: {
    mediaId: string;
    startTime: number;
    duration: number;
  }) => {
    if (!onClipAdd) {
      toast.error('Timeline integration not available');
      return;
    }

    onClipAdd(clipData);
  };

  return (
    <div className="h-full w-full flex flex-col">
      <WhiteboardEditorPanel
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        onClipCreate={handleClipCreate}
      />
    </div>
  );
};
