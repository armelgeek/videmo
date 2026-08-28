# Whiteboard Editor - Testing Guide

## 🧪 Testing Your Whiteboard Implementation

### Quick Test Page

A test page is available at:
```
/whiteboard-test
```

Navigate to this route to test all whiteboard features immediately.

---

## ✅ What to Test

### 1. Drawing Canvas
- [ ] Canvas renders correctly
- [ ] Can draw with mouse
- [ ] Colors change when selecting new color
- [ ] Line width changes affect stroke
- [ ] Clear button clears canvas
- [ ] Export button downloads PNG

### 2. Animation Styles
- [ ] Can select different animation styles
- [ ] Styles change in dropdown
- [ ] Animation preview updates
- [ ] All 23+ styles are available

### 3. Playback Controls
- [ ] Play button starts animation
- [ ] Pause button stops animation
- [ ] Stop button resets to start
- [ ] Current time updates during playback
- [ ] Speed slider changes playback speed

### 4. Settings Panel
- [ ] Color picker works
- [ ] Line width slider works
- [ ] Speed slider works (0.25x to 2x)
- [ ] Canvas dimensions display correctly
- [ ] Animation style selector works

### 5. Project Management
- [ ] Can save a project with a name
- [ ] Saved projects appear in Projects tab
- [ ] Can load a saved project
- [ ] Can duplicate a project
- [ ] Can delete a project

### 6. Timeline Integration
- [ ] "Add to Timeline" button appears
- [ ] Clicking creates a clip
- [ ] Clip info displays correctly
- [ ] Clip data includes mediaId, startTime, duration

### 7. Export
- [ ] Export button downloads PNG file
- [ ] PNG file is named correctly
- [ ] PNG contains canvas content

---

## 🚀 Manual Testing Steps

### Test 1: Basic Drawing (5 minutes)
```
1. Navigate to /whiteboard-test
2. Click on canvas area
3. Draw something (move mouse around)
4. Change line color - draw again
5. Change line width - draw again
6. Click "Clear" button
7. Verify canvas is empty
```

### Test 2: Animation Styles (10 minutes)
```
1. Click "Settings" tab
2. Open Animation Style selector
3. Select "scanner" style
4. Draw on canvas
5. Click Play button
6. Watch animation play
7. Try different styles: contour, scribble, gesture
8. Adjust speed slider
9. Verify speed changes
```

### Test 3: Projects (10 minutes)
```
1. Draw something on canvas
2. Enter project name: "Test Project"
3. Click "Save" button
4. Success message appears
5. Click "Projects" tab
6. See "Test Project" in list
7. Draw something different
8. Click "Save" again with name "Test Project 2"
9. Click "Duplicate" on Test Project
10. Verify new project appears
11. Click "Load" on any project
12. Verify canvas loads that project's content
```

### Test 4: Timeline Integration (5 minutes)
```
1. Draw on canvas
2. Click "Add to Timeline" button
3. Verify success message
4. Check "Clip Created" info box
5. Verify mediaId is populated
6. Verify startTime and duration are set
```

### Test 5: Export (5 minutes)
```
1. Draw something on canvas
2. Click "Export" button in toolbar
3. Verify PNG file downloads
4. Open PNG file
5. Verify it contains your drawing
```

---

## 🔍 Debugging Tips

### Canvas Not Rendering
```typescript
// Check browser console for errors
console.log('Canvas element:', canvas);
console.log('Context:', ctx);
```

### Drawing Not Working
- Verify canvas has dimensions (1280x720)
- Check mouse events are firing
- Ensure context is 2D

### Animations Not Playing
- Check animation style is valid
- Verify state.duration is > 0
- Check play button clicks

### Projects Not Saving
- Verify localStorage is enabled
- Check browser developer tools Storage tab
- Look for "whiteboard-project-*" keys

### Type Errors
- All components should be fully typed
- Check type definitions in `types.ts`
- IDE should show autocomplete

---

## 📊 Performance Testing

### Metrics to Check

```
1. Load Time
   - Should load in < 1 second
   - Check Network tab in DevTools

2. Drawing Responsiveness
   - Should update immediately when drawing
   - No lag when moving mouse

3. Animation Playback
   - Should play smoothly
   - Check for frame drops (< 60 FPS)

4. Memory Usage
   - Monitor Memory tab in DevTools
   - Should stay < 100MB for typical usage
```

---

## 🧬 Component Testing

### WhiteboardCanvas
```typescript
test('renders canvas', () => {
  const { container } = render(
    <WhiteboardCanvas 
      state={mockState}
      onStateChange={jest.fn()}
    />
  );
  expect(container.querySelector('canvas')).toBeInTheDocument();
});
```

### WhiteboardSettings
```typescript
test('shows animation styles', () => {
  const { getByDisplayValue } = render(
    <WhiteboardSettings 
      state={mockState}
      onStateChange={jest.fn()}
    />
  );
  expect(getByDisplayValue('scanner')).toBeInTheDocument();
});
```

### WhiteboardEditorPanel
```typescript
test('calls onClipCreate when button clicked', () => {
  const onClipCreate = jest.fn();
  const { getByText } = render(
    <WhiteboardEditorPanel onClipCreate={onClipCreate} />
  );
  fireEvent.click(getByText('Add to Timeline'));
  expect(onClipCreate).toHaveBeenCalled();
});
```

---

## 🔧 Browser DevTools Checks

### Console
- No errors logged
- No warnings about missing props
- No type-related warnings

### Network
- No failed requests
- Canvas rendering is smooth
- Asset loading is fast

### Performance
- Frame rate stays > 30 FPS during drawing
- No jank or stuttering
- Smooth animations

### Storage
- Projects save to localStorage
- Can retrieve saved projects
- Auto-save works (check timestamps)

---

## 🚨 Common Issues & Solutions

### Issue: Canvas shows blank
**Solution:**
- Check canvas dimensions are set
- Verify context is obtained
- Ensure canvas is visible in DOM

### Issue: Drawing doesn't appear
**Solution:**
- Check mouse event listeners are attached
- Verify context.stroke() is called
- Check line color is not same as background

### Issue: Animations don't play
**Solution:**
- Verify animation style is in the list
- Check state.duration > 0
- Ensure play() method is called

### Issue: Projects don't save
**Solution:**
- Check localStorage is enabled
- Verify JSON serialization works
- Look in DevTools Storage tab

### Issue: Type errors in editor
**Solution:**
- Check types.ts has required interfaces
- Verify component prop types match
- Run TypeScript compiler: `tsc --noEmit`

---

## ✨ Success Criteria

The implementation is successful if:

✅ All tests above pass  
✅ No console errors  
✅ Drawing is responsive  
✅ Animations play smoothly  
✅ Projects persist  
✅ Export works  
✅ Timeline integration works  
✅ All TypeScript types are correct  
✅ UI is responsive  
✅ Performance is good  

---

## 📋 Test Summary Checklist

```
Drawing & Canvas
  ☐ Canvas renders
  ☐ Can draw on canvas
  ☐ Color changes work
  ☐ Line width changes work
  ☐ Clear button works
  ☐ Export works

Animations
  ☐ All styles available
  ☐ Styles change
  ☐ Play/Pause works
  ☐ Speed control works
  ☐ Animations preview

Projects
  ☐ Save works
  ☐ Load works
  ☐ Duplicate works
  ☐ Delete works
  ☐ Auto-save works

Integration
  ☐ Sidebar icon visible
  ☐ Add to timeline works
  ☐ Clip data is correct

TypeScript
  ☐ No type errors
  ☐ Full autocomplete
  ☐ All types correct

Performance
  ☐ Responsive drawing
  ☐ Smooth animations
  ☐ Fast load time
  ☐ Reasonable memory usage
```

---

## 🎯 Final Verification

Run this checklist before deployment:

1. **Functionality**
   - [ ] All features work as expected
   - [ ] No console errors
   - [ ] No warnings

2. **TypeScript**
   - [ ] Build succeeds: `npm run build`
   - [ ] Type check passes: `tsc --noEmit`
   - [ ] No type errors

3. **Performance**
   - [ ] Drawing is responsive
   - [ ] Animations are smooth
   - [ ] Page loads quickly

4. **Browser Support**
   - [ ] Chrome 90+
   - [ ] Firefox 88+
   - [ ] Safari 14+
   - [ ] Edge 90+

5. **Documentation**
   - [ ] All docs are accurate
   - [ ] Examples work
   - [ ] Types are documented

---

## 📞 Getting Help

If tests fail:
1. Check browser console for errors
2. Review the relevant documentation
3. Check types.ts for type definitions
4. Look at component examples
5. Try the basic test page

---

**Test Page URL:** `/whiteboard-test`  
**Documentation:** `lib/whiteboard-animation/`  
**Last Updated:** 2026-08-28  
**Status:** ✅ Ready for Testing
