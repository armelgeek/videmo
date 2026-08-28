# Whiteboard Editor - Quick Start Guide

## 🎯 5-Minute Setup

### 1. Import Components

```typescript
import {
  WhiteboardEditorPanel,
  WhiteboardCanvas,
  WhiteboardSettings,
  useWhiteboard,
} from '@/lib/whiteboard-animation';
```

### 2. Use in Component

```typescript
export function MyEditor() {
  return (
    <WhiteboardEditorPanel
      canvasWidth={1280}
      canvasHeight={720}
      onClipCreate={(clipData) => {
        console.log('New clip:', clipData);
        // Add to timeline
      }}
    />
  );
}
```

### 3. Done! 🎉

The whiteboard editor is ready to use with:
- ✅ Drawing canvas
- ✅ Animation styles
- ✅ Settings panel
- ✅ Project management
- ✅ Timeline integration

## 🎨 Drawing

1. Click on the canvas area to draw
2. Use the toolbar to:
   - Play/Pause animations
   - Zoom in/out
   - Clear canvas
   - Export as image

## ⚙️ Animation Styles

Click "Settings" tab to:
- Select animation style (scanner, contour, scribble, etc.)
- Change line color & width
- Adjust animation speed
- View canvas info

## 💾 Save Projects

1. Enter project name in the header
2. Click "Save" button
3. Access saved projects in "Projects" tab

## ➕ Add to Timeline

Click "Add to Timeline" button to:
- Create media item from whiteboard
- Add clip to video timeline
- Start at current timeline position
- Use whiteboard duration

## 🎬 Export

Click "Export" to download whiteboard as PNG image.

## 🎯 Use the Hook (Advanced)

```typescript
import { useWhiteboard } from '@/lib/whiteboard-animation';

const whiteboard = useWhiteboard({
  initialWidth: 1280,
  initialHeight: 720,
  autoSave: true,  // Save to localStorage
});

// Change animation style
whiteboard.setAnimationStyle('scanner');

// Customize options
whiteboard.setAnimationOptions({
  lineColor: '#FF0000',
  lineWidth: 3,
  speed: 1.5,
});

// Playback control
whiteboard.play();
whiteboard.pause();
whiteboard.stop();

// Project management
whiteboard.addLayer(layer);
whiteboard.removeLayer(layerId);
```

## 📍 In Sidebar

The whiteboard editor is available in the editor sidebar:
1. Click the "Whiteboard" icon (4th icon)
2. Full editor opens in sidebar
3. Create whiteboard content
4. Add to timeline directly

## 🎮 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `Delete` | Clear canvas |
| `Scroll` | Zoom (coming soon) |

## 🎨 Animation Styles

Quick reference of available styles:

- **scanner** - Progressive left-to-right
- **contour** - Outline drawing
- **scribble** - Quick sketches
- **gesture** - Gesture animations
- **specialized** - Object-specific
- **nervous** - Shaky style
- **topanchor** - Anchor from top
- **illustfill** - Illustration style

And 15+ more!

## 📦 Project Structure

Your projects automatically save to browser localStorage:
- Projects: `whiteboard-project-<id>`
- State: `whiteboard-state`
- All data persists across browser sessions

## 💡 Common Tasks

### Create a New Whiteboard

```typescript
const whiteboard = useWhiteboard({
  initialStyle: 'scanner',
});

// Start drawing on the canvas
```

### Save a Project

```typescript
import { WhiteboardEditorService } from '@/lib/whiteboard-animation';

WhiteboardEditorService.saveWhiteboardProject({
  id: `project-${Date.now()}`,
  name: 'My Animation',
  state: whiteboard.state,
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

### Load a Project

```typescript
const project = WhiteboardEditorService.loadWhiteboardProject(projectId);
whiteboard.updateState(project.state);
```

### Export as Image

```typescript
const canvas = document.querySelector('canvas');
const blob = await WhiteboardEditorService.exportWhiteboardAsImage(canvas);
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'whiteboard.png';
link.click();
```

### Add to Timeline

```typescript
const media = WhiteboardEditorService.createMediaFromWhiteboard(
  whiteboard.state,
  'My Whiteboard'
);

const clip = WhiteboardEditorService.createClipFromWhiteboard(
  media.id,
  0,  // start time
  5000,  // duration
  whiteboard.state
);

timeline.addClip(clip);
```

## ⚡ Performance Tips

1. **Use appropriate canvas size** (1280x720 is good default)
2. **Simplify animations** for complex content
3. **Limit layers** to ~50 per project
4. **Export to image** before creating video

## 🐛 Troubleshooting

### Canvas not showing?
- Check parent container has dimensions
- Ensure CSS is loaded (Tailwind)
- Check browser console for errors

### Animations too slow?
- Increase `speed` value (0.25-2x range)
- Use simpler animation style
- Close other browser tabs

### Projects not saving?
- Check localStorage is enabled
- Verify auto-save is turned on
- Manually save projects to ensure

### Can't export?
- Ensure canvas has content
- Check browser allows downloads
- Try different format or size

## 📚 Full Documentation

- **README.md** - Complete API reference
- **INTEGRATION_GUIDE.md** - Advanced usage
- **types.ts** - TypeScript interfaces

## 🚀 Next Steps

1. ✅ Import and use components
2. ✅ Draw on the whiteboard
3. ✅ Try different animation styles
4. ✅ Save a project
5. ✅ Add to timeline
6. ✅ Export your creation

## 💬 Questions?

Check the full documentation files in the same directory or look at type definitions for detailed prop information.

---

**Happy Drawing!** 🎨
