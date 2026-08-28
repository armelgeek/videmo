'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { useWhiteboard } from '../hooks/use-whiteboard';
import { WhiteboardCanvas } from './whiteboard-canvas';
import { WhiteboardSettings } from './whiteboard-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Download,
  Save,
  Copy,
  Trash2,
  Plus,
} from 'lucide-react';
import { useToastContext } from '@/components/ui/sonner';

interface WhiteboardEditorPanelProps {
  onClipCreate?: (clipData: {
    mediaId: string;
    startTime: number;
    duration: number;
  }) => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

export const WhiteboardEditorPanel: React.FC<WhiteboardEditorPanelProps> = ({
  onClipCreate,
  canvasWidth = 1280,
  canvasHeight = 720,
}) => {
  const { toast } = useToastContext();
  const whiteboard = useWhiteboard({
    initialWidth: canvasWidth,
    initialHeight: canvasHeight,
    autoSave: true,
  });
  const [projectName, setProjectName] = useState('Untitled Whiteboard');
  const [savedProjects, setSavedProjects] = useState<
    Array<{ id: string; name: string }>
  >([]);

  // Load saved projects
  useEffect(() => {
    const projects = loadWhiteboardProjects();
    setSavedProjects(projects);
  }, []);

  const handleSaveProject = () => {
    const project = {
      id: `whiteboard-${Date.now()}`,
      name: projectName,
      state: whiteboard.state,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    localStorage.setItem(`whiteboard-project-${project.id}`, JSON.stringify(project));
    setSavedProjects([...savedProjects, { id: project.id, name: projectName }]);
    toast.success('Whiteboard project saved');
  };

  const handleDuplicate = () => {
    setProjectName(`${projectName} (Copy)`);
    toast.success('Whiteboard state duplicated');
  };

  const handleExportImage = async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      toast.error('No canvas found');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${projectName}-${Date.now()}.png`;
      link.click();
      toast.success('Image exported successfully');
    } catch (error) {
      toast.error('Failed to export image');
    }
  };

  const handleAddToTimeline = () => {
    if (!onClipCreate) {
      toast.error('Timeline integration not available');
      return;
    }

    onClipCreate({
      mediaId: `whiteboard-${Date.now()}`,
      startTime: 0,
      duration: whiteboard.state.duration,
    });

    toast.success('Whiteboard clip added to timeline');
  };

  const handleClear = () => {
    if (confirm('Clear all whiteboard content? This cannot be undone.')) {
      whiteboard.reset();
      toast.info('Whiteboard cleared');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name..."
            className="text-sm"
          />
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveProject}
            className="text-xs"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDuplicate}
            className="text-xs"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportImage}
            className="text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
          {onClipCreate && (
            <Button
              size="sm"
              onClick={handleAddToTimeline}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add to Timeline
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={handleClear}
            className="text-xs"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="editor" className="flex-1 flex flex-col">
        <TabsList className="px-4 pt-2 bg-transparent border-b border-border w-full justify-start rounded-none">
          <TabsTrigger value="editor" className="text-xs">
            Editor
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">
            Settings
          </TabsTrigger>
          <TabsTrigger value="projects" className="text-xs">
            Projects
          </TabsTrigger>
        </TabsList>

        {/* Editor Tab */}
        <TabsContent value="editor" className="flex-1 overflow-hidden">
          <WhiteboardCanvas
            state={whiteboard.state}
            onStateChange={whiteboard.updateState}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="flex-1 overflow-auto">
          <WhiteboardSettings
            state={whiteboard.state}
            onStateChange={whiteboard.updateState}
          />
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="flex-1 overflow-auto">
          <div className="p-6 space-y-4">
            {savedProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No saved projects yet</p>
                <p className="text-xs">Save your first whiteboard project to get started</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {savedProjects.map((project) => (
                  <Card key={project.id} className="p-3 hover:border-primary/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.id}</p>
                      </div>
                      <Button size="sm" variant="ghost">
                        Load
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function loadWhiteboardProjects() {
  const projects = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('whiteboard-project-')) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const project = JSON.parse(data);
          projects.push({ id: project.id, name: project.name });
        } catch {
          // Skip invalid projects
        }
      }
    }
  }
  return projects;
}
