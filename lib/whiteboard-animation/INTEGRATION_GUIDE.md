# Whiteboard Editor Integration Guide

This guide shows how to integrate the whiteboard editor into your video editing workflow.

## Quick Start

### 1. Add Whiteboard to Editor Sidebar

The whiteboard editor has already been added to the sidebar as option "4". Update your editor sidebar configuration in `lib/editor/components/editor-sidebar.tsx`:

```typescript
export type SidebarView = 
  | "library"
  | "inspector" 
  | "storyboard"
  | "create"
  | "settings"
  | "transitions"
  | "whiteboard";  // ✅ Already added
```

### 2. Render Whiteboard Panel in Editor

In your main editor component (likely `lib/editor/components/editor.tsx`), add the whiteboard panel to your sidebar rendering:

```typescript
import { WhiteboardSidebarPanel } from '@/lib/whiteboard-animation/components/whiteboard-sidebar-panel';

// In your editor component's JSX:
{activeView === 'whiteboard' && (
  <SidebarPanelWrapper title="Whiteboard Editor">
    <WhiteboardSidebarPanel
      canvasWidth={timeline.videoWidth || 1280}
      canvasHeight={timeline.videoHeight || 720}
      onClipAdd={(clipData) => {
        // Add to timeline
        timeline.handleAddClip({
          mediaId: clipData.mediaId,
          trackId: 'video-1',
          startTime: playback.currentTime,
          duration: clipData.duration,
        });
      }}
    />
  </SidebarPanelWrapper>
)}
```

### 3. Usage in Storyboard Page

Use the whiteboard editor directly in the storyboard page:

```typescript
import { WhiteboardEditorPanel } from '@/lib/whiteboard-animation/components/whiteboard-editor-panel';
import { useWhiteboard } from '@/lib/whiteboard-animation/hooks/use-whiteboard';

export function MyStoryboardPage() {
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  
  const handleAddWhiteboardClip = (clipData) => {
    // Add to your clips or timeline
    console.log('Adding whiteboard clip:', clipData);
  };

  return (
    <>
      <button onClick={() => setShowWhiteboard(!showWhiteboard)}>
        Toggle Whiteboard
      </button>
      
      {showWhiteboard && (
        <div className="w-full max-w-4xl">
          <WhiteboardEditorPanel
            onClipCreate={handleAddWhiteboardClip}
          />
        </div>
      )}
    </>
  );
}
```

## Advanced Usage

### Custom Animation Styles

Create custom animation effects:

```typescript
import { useWhiteboard } from '@/lib/whiteboard-animation/hooks/use-whiteboard';
import type { AnimationStyle } from '@/lib/whiteboard-animation';

const whiteboard = useWhiteboard();

const animationStyles: AnimationStyle[] = [
  'scanner',
  'contour',
  'scribble',
  'gesture',
];

whiteboard.setAnimationStyle('scanner');
whiteboard.setAnimationOptions({
  lineColor: '#FF0000',
  lineWidth: 3,
  speed: 1.5,
});
```

### Manage Projects

Save and load whiteboard projects:

```typescript
import { WhiteboardEditorService } from '@/lib/whiteboard-animation/services/whiteboard-editor-service';

// Save project
WhiteboardEditorService.saveWhiteboardProject({
  id: `project-${Date.now()}`,
  name: 'My Whiteboard',
  state: whiteboard.state,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Load project
const project = WhiteboardEditorService.loadWhiteboardProject(projectId);
if (project) {
  whiteboard.updateState(project.state);
}

// List all projects
const projects = WhiteboardEditorService.listWhiteboardProjects();

// Delete project
WhiteboardEditorService.deleteWhiteboardProject(projectId);
```

### Export Whiteboard

Export whiteboard content as images or prepare for video export:

```typescript
import { WhiteboardEditorService } from '@/lib/whiteboard-animation/services/whiteboard-editor-service';

// Export as PNG image
const canvas = document.querySelector('canvas');
if (canvas) {
  const blob = await WhiteboardEditorService.exportWhiteboardAsImage(canvas);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'whiteboard.png';
  link.click();
}

// Create thumbnail for project
const thumbnail = WhiteboardEditorService.createThumbnail(canvas, 120, 67);
console.log('Thumbnail:', thumbnail);
```

### Integrate into Timeline

Create timeline clips from whiteboard content:

```typescript
import { WhiteboardEditorService } from '@/lib/whiteboard-animation/services/whiteboard-editor-service';

// Create media item from whiteboard
const media = WhiteboardEditorService.createMediaFromWhiteboard(
  whiteboard.state,
  'My Whiteboard Project'
);

// Add to media library
timeline.addMedia(media);

// Create clip on timeline
const clip = WhiteboardEditorService.createClipFromWhiteboard(
  media.id,
  playback.currentTime,  // start time
  5000,                   // duration in ms
  whiteboard.state
);

// Add to timeline
timeline.addClip(clip);
```

## Keyboard Shortcuts

The whiteboard editor includes these shortcuts:

- `Space` - Play/Pause animation
- `R` - Reset animation
- `Delete` - Clear canvas
- `Ctrl/Cmd + S` - Save project
- `Ctrl/Cmd + Z` - Undo (if implemented)
- `Ctrl/Cmd + Y` - Redo (if implemented)

To add more shortcuts, extend the component:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveProject();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

## Styling & Theming

The whiteboard editor uses shadcn/ui components and respects the current theme. Customize appearance:

```typescript
// Canvas styling
<WhiteboardCanvas
  state={whiteboard.state}
  onStateChange={whiteboard.updateState}
  // Add custom className wrapper
/>

// Settings styling
<WhiteboardSettings
  state={whiteboard.state}
  onStateChange={whiteboard.updateState}
/>
```

## Performance Optimization

For better performance with large projects:

1. **Reduce canvas size**: Use appropriate dimensions for your use case
2. **Limit layers**: Keep layer count reasonable (typically < 50)
3. **Simplify animations**: Use simpler animation styles for complex scenes
4. **Optimize exports**: Reduce resolution for faster image/video export

```typescript
// Use smaller canvas for previews
<WhiteboardEditorPanel
  canvasWidth={640}
  canvasHeight={360}
/>

// Use larger canvas for final exports
const exportCanvas = document.createElement('canvas');
exportCanvas.width = 1920;
exportCanvas.height = 1080;
```

## Troubleshooting

### Canvas not displaying

Ensure the parent container has proper dimensions:

```tsx
<div className="w-full h-screen flex flex-col">
  <WhiteboardEditorPanel />
</div>
```

### Animations not smooth

Check your browser's hardware acceleration settings and ensure you're not running other intensive tasks.

### Projects not saving

Enable auto-save or manually save:

```typescript
<WhiteboardEditorPanel
  onClipCreate={handleClipCreate}
  // Projects auto-save to localStorage
/>
```

### Performance issues

Reduce canvas resolution and simplify animations:

```typescript
whiteboard.setAnimationStyle('scanner');  // Simpler than 'specialized'
whiteboard.setSpeed(1);  // Avoid very high speeds
```

## API Reference

### WhiteboardEditorPanel Props

```typescript
interface WhiteboardEditorPanelProps {
  onClipCreate?: (clipData: {
    mediaId: string;
    startTime: number;
    duration: number;
  }) => void;
  canvasWidth?: number;      // Default: 1280
  canvasHeight?: number;     // Default: 720
}
```

### useWhiteboard Hook

```typescript
const whiteboard = useWhiteboard({
  initialWidth?: number;
  initialHeight?: number;
  initialStyle?: AnimationStyle;
  autoSave?: boolean;
});
```

Returns object with:
- `state` - Current whiteboard state
- `updateState()` - Update state
- `play()`, `pause()`, `stop()` - Playback controls
- `seek()` - Jump to time
- `addLayer()`, `removeLayer()` - Layer management
- `setAnimationStyle()` - Change animation
- `setAnimationOptions()` - Customize animation
- `setSpeed()` - Control playback speed

## Next Steps

1. Test the whiteboard editor in your browser
2. Customize animation styles for your needs
3. Integrate with your timeline workflow
4. Export whiteboard content to video
5. Share whiteboard projects with team members

For more details, see [README.md](./README.md)
