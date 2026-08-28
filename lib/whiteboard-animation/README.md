# Whiteboard Animation Editor

This module provides a complete whiteboard drawing and animation system integrated into the video editor. It includes animation styles from the sketchpilot project adapted for React and TypeScript.

## Features

- **Multiple Animation Styles**: Scanner, Contour, Scribble, Gesture, Specialized, and more
- **Drawing Canvas**: HTML5 canvas-based drawing with pressure sensitivity support
- **Real-time Preview**: See animations as they're being created
- **Timeline Integration**: Add whiteboard clips to your video timeline
- **Project Management**: Save, load, and duplicate whiteboard projects
- **Export Options**: Export as PNG images or video (with FFmpeg)
- **Customizable Options**: Control line color, width, speed, and animation parameters

## Structure

```
lib/whiteboard-animation/
├── index.js                          # Animation factory
├── types.ts                          # TypeScript type definitions
├── Animation.js                      # Core animation engine
├── AnimationUtils.js                 # Utility functions
├── styles/                           # Animation style implementations
├── editor/                           # Editor engine components
├── components/                       # React components
│   ├── whiteboard-canvas.tsx         # Main drawing canvas
│   ├── whiteboard-settings.tsx       # Animation settings panel
│   └── whiteboard-editor-panel.tsx   # Integrated editor panel
├── hooks/
│   └── use-whiteboard.ts             # State management hook
└── services/
    └── whiteboard-editor-service.ts  # Integration service
```

## Usage

### Basic Setup

```typescript
import { WhiteboardEditorPanel } from '@/lib/whiteboard-animation/components/whiteboard-editor-panel';
import { useWhiteboard } from '@/lib/whiteboard-animation/hooks/use-whiteboard';

export function MyComponent() {
  const whiteboard = useWhiteboard({
    initialWidth: 1280,
    initialHeight: 720,
    initialStyle: 'scanner',
    autoSave: true,
  });

  return (
    <WhiteboardEditorPanel
      canvasWidth={1280}
      canvasHeight={720}
      onClipCreate={(clipData) => {
        // Handle adding to timeline
        console.log('Add clip:', clipData);
      }}
    />
  );
}
```

### Animation Styles

Available animation styles:

- `scanner` - Line appears progressively from left to right
- `contour` - Draws outline of shapes
- `outlinechunks` - Chunked outline animation
- `chunkjump` - Chunks jump into position
- `outlinefill` - Fills outline with color
- `nervous` - Shaky/nervous drawing style
- `topanchor` - Draws from top anchor point
- `scribble` - Quick scribble style
- `specialized` - Specialized drawing for objects
- `gesture` - Gesture-based animation
- `illustfill` - Illustration fill style
- `outlineonly` - Just the outline
- `spec-text` - Text specialization
- `spec-human` - Human figure specialization
- `spec-animal` - Animal figure specialization
- `spec-portrait` - Portrait specialization
- And more...

### Hooks

#### `useWhiteboard()`

```typescript
const whiteboard = useWhiteboard({
  initialWidth?: number;      // Canvas width (default: 1280)
  initialHeight?: number;     // Canvas height (default: 720)
  initialStyle?: AnimationStyle;  // Initial style (default: 'scanner')
  autoSave?: boolean;         // Auto-save to localStorage (default: false)
});

// State
whiteboard.state.canvasWidth
whiteboard.state.canvasHeight
whiteboard.state.animationStyle
whiteboard.state.animationOptions
whiteboard.state.layers
whiteboard.state.speed
whiteboard.state.playing
whiteboard.state.currentTime
whiteboard.state.duration

// Methods
whiteboard.updateState(updates)
whiteboard.addLayer(layer)
whiteboard.removeLayer(layerId)
whiteboard.updateLayer(layerId, updates)
whiteboard.setSelectedLayer(layerId)
whiteboard.play()
whiteboard.pause()
whiteboard.stop()
whiteboard.seek(time)
whiteboard.reset()
whiteboard.setAnimationStyle(style)
whiteboard.setAnimationOptions(options)
whiteboard.setSpeed(speed)
```

### Components

#### WhiteboardCanvas

The main drawing canvas component.

```typescript
<WhiteboardCanvas
  state={whiteboardState}
  onStateChange={handleStateChange}
  readOnly={false}
/>
```

#### WhiteboardSettings

Settings and configuration panel.

```typescript
<WhiteboardSettings
  state={whiteboardState}
  onStateChange={handleStateChange}
/>
```

#### WhiteboardEditorPanel

Complete integrated editor with canvas, settings, and project management.

```typescript
<WhiteboardEditorPanel
  canvasWidth={1280}
  canvasHeight={720}
  onClipCreate={handleClipCreate}
/>
```

### Services

#### WhiteboardEditorService

Service for integrating whiteboard into the editor workflow.

```typescript
import { WhiteboardEditorService } from '@/lib/whiteboard-animation/services/whiteboard-editor-service';

// Create media from whiteboard state
const media = WhiteboardEditorService.createMediaFromWhiteboard(
  whiteboardState,
  'My Project',
  'media-id'
);

// Create timeline clip
const clip = WhiteboardEditorService.createClipFromWhiteboard(
  mediaId,
  startTime,
  duration,
  whiteboardState
);

// Export as image
const blob = await WhiteboardEditorService.exportWhiteboardAsImage(canvas);

// Manage projects
WhiteboardEditorService.saveWhiteboardProject(project);
const project = WhiteboardEditorService.loadWhiteboardProject(projectId);
const projects = WhiteboardEditorService.listWhiteboardProjects();
WhiteboardEditorService.deleteWhiteboardProject(projectId);

// Create thumbnail
const thumbnail = WhiteboardEditorService.createThumbnail(canvas, 120, 67);
```

## Keyboard Shortcuts

- `Space` - Play/Pause
- `Delete` - Clear canvas
- Scroll wheel - Zoom in/out

## Local Storage

Whiteboard projects are automatically saved to browser localStorage:

```javascript
// All projects are stored with keys like:
localStorage.getItem('whiteboard-project-<projectId>')

// Whiteboard state for current session:
localStorage.getItem('whiteboard-state')
```

## Integration with Video Editor

To add whiteboard clips to your video timeline:

```typescript
<WhiteboardEditorPanel
  onClipCreate={(clipData) => {
    // Add to timeline
    timeline.handleAddClip({
      mediaId: clipData.mediaId,
      trackId: 'video-1',
      startTime: clipData.startTime,
      duration: clipData.duration,
    });
  }}
/>
```

## Performance Notes

- Drawing is optimized using requestAnimationFrame
- Canvas rendering uses hardware acceleration when available
- Large projects (many layers) may experience performance degradation
- Export to video requires FFmpeg.wasm or server-side encoding

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires Canvas API and Web Audio API support

## Animation Engine

The core animation engine is derived from sketchpilot's animation system. It uses:

- Canvas 2D context for rendering
- SVG path data for shape definitions
- Timing calculations for smooth playback
- Layer-based composition system

## Troubleshooting

### Canvas not rendering

Ensure the canvas element has proper dimensions set and the context is available.

### Animations playing too fast/slow

Adjust the `speed` property in animation options (0.25x to 2x supported).

### Projects not persisting

Enable `autoSave` in the `useWhiteboard` hook or manually call `saveWhiteboardProject()`.

### Performance issues

- Reduce number of layers
- Decrease canvas resolution
- Simplify animation styles
- Close other browser tabs

## Future Enhancements

- [ ] Touch gesture support
- [ ] Collaborative editing
- [ ] Vector export (SVG)
- [ ] Real-time video export
- [ ] Animation presets library
- [ ] Layer effects and filters
- [ ] Bezier curve tools
- [ ] Text layer support
