'use client';

import React, { useRef, useState } from 'react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
import { InkplainerTopbar } from './inkplainer-topbar';
import { InkplainerSidebar } from './inkplainer-sidebar';
import { InkplainerCanvasArea } from './inkplainer-canvas-area';
import { InkplainerRightPanel } from './inkplainer-right-panel';
import { InkplainerProjectsModal } from './inkplainer-projects-modal';

interface WhiteboardEditorPanelProps {
  onClipCreate?: (clipData: { mediaId: string; startTime: number; duration: number }) => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

export const WhiteboardEditorPanel: React.FC<WhiteboardEditorPanelProps> = ({
  onClipCreate,
  canvasWidth = 1280,
  canvasHeight = 720,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    isPlaying,
    progress,
    togglePlay,
    animStyle,
    setAnimStyle,
    handStyle,
    setHandStyle,
    revealSpeed,
    setRevealSpeed,
    handSpeed,
    setHandSpeed,
    chunks,
    setChunks,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    canvasBg,
    setCanvasBg,
    layers,
    useAnnotation,
    setUseAnnotation,
    annotations,
    setCurrentTime,
  } = useUnifiedEngine();

  // Reset animation when needed
  const resetAnimation = () => {
    setCurrentTime(0);
  };

  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'animation' | 'drawing' | 'scenes' | 'annotation'>('animation');
  const [projectName, setProjectName] = useState('Whiteboard Project');

  return (
    <div id="whiteboard-app-root" className="w-full h-full flex flex-col bg-background font-sans overflow-hidden text-foreground">
      {/* Topbar */}
      <InkplainerTopbar
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onOpenProjectsModal={() => setIsProjectsModalOpen(true)}
      />

      {/* Main Body */}
      <div id="app-body" className="flex-1 flex w-full h-full overflow-hidden">
        {/* Left Sidebar */}
        <InkplainerSidebar
          selectedLayerName="scene-premium-bag"
          animStyle={animStyle}
          onAnimStyleChange={setAnimStyle}
          handStyle={handStyle}
          onHandStyleChange={setHandStyle}
          revealSpeed={revealSpeed}
          onRevealSpeedChange={setRevealSpeed}
          handSpeed={handSpeed}
          onHandSpeedChange={setHandSpeed}
          chunks={chunks}
          onChunksChange={setChunks}
          aspectRatio={aspectRatio}
          onAspectRatioChange={setAspectRatio}
          resolution={resolution}
          onResolutionChange={setResolution}
          activeTab={sidebarTab}
          onActiveTabChange={setSidebarTab}
          useAnnotation={useAnnotation}
          onToggleAnnotation={setUseAnnotation}
          annotations={annotations}
          onGenerateAnimation={togglePlay}
        />

        {/* Center Canvas */}
        <InkplainerCanvasArea
          canvasRef={canvasRef}
          handCanvasRef={handCanvasRef}
          annotationCanvasRef={annotationCanvasRef}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          animStyleLabel={animStyle.toUpperCase()}
          isPlaying={isPlaying}
          progress={progress}
          useAnnotation={useAnnotation}
          onTogglePlay={togglePlay}
          onResetAnimation={resetAnimation}
          onOpenAnnotate={() => {
            setUseAnnotation(!useAnnotation);
            setSidebarTab('annotation');
          }}
        />

        {/* Right Panel */}
        <InkplainerRightPanel
          canvasBg={canvasBg}
          onCanvasBgChange={setCanvasBg}
          layers={layers}
          onLayersChange={setLayers}
        />
      </div>

      {/* Projects Modal */}
      <InkplainerProjectsModal
        isOpen={isProjectsModalOpen}
        onClose={() => setIsProjectsModalOpen(false)}
        onSelectProject={(proj) => {
          setProjectName(proj.name);
          setIsProjectsModalOpen(false);
        }}
      />
    </div>
  );
};