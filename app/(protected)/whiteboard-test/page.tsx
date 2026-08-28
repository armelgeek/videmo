'use client';

import { useState } from 'react';
import { WhiteboardEditorPanel } from '@/lib/whiteboard-animation';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/components/ui/sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function WhiteboardTestPage() {
  const { toast } = useToastContext();
  const [clipInfo, setClipInfo] = useState<{
    mediaId: string;
    startTime: number;
    duration: number;
  } | null>(null);

  const handleClipCreate = (clipData: {
    mediaId: string;
    startTime: number;
    duration: number;
  }) => {
    setClipInfo(clipData);
    toast.success(`Whiteboard clip created! Media ID: ${clipData.mediaId}`);
    console.log('Clip created:', clipData);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Whiteboard Editor Test</h1>
            <p className="text-sm text-muted-foreground">
              Test the whiteboard animation editor
            </p>
          </div>
        </div>

        {/* Status Info */}
        {clipInfo && (
          <div className="text-sm bg-green-500/10 border border-green-500/30 rounded-lg p-3 max-w-xs">
            <p className="font-semibold text-green-700 dark:text-green-400">
              Clip Created ✓
            </p>
            <div className="mt-2 text-xs space-y-1 font-mono text-muted-foreground">
              <p>Media: {clipInfo.mediaId}</p>
              <p>Start: {clipInfo.startTime}ms</p>
              <p>Duration: {clipInfo.duration}ms</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full rounded-lg border border-border overflow-hidden bg-card">
          <WhiteboardEditorPanel
            canvasWidth={1280}
            canvasHeight={720}
            onClipCreate={handleClipCreate}
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="border-t border-border px-6 py-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-sm font-semibold mb-3">Test Checklist</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="font-medium mb-1">Drawing</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>✓ Click on canvas to draw</li>
                <li>✓ Try different colors</li>
                <li>✓ Adjust line width</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Animations</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>✓ Change animation style</li>
                <li>✓ Adjust speed</li>
                <li>✓ Preview animation</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Projects</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>✓ Save a project</li>
                <li>✓ Load project</li>
                <li>✓ Duplicate project</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Export</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>✓ Export as PNG</li>
                <li>✓ Add to timeline</li>
                <li>✓ View clip info</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
