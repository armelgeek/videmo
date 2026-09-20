'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { annotationColors } from "../schema";
import { Stage, Layer, Rect, Group, Label, Tag, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import { selectSceneAnnotations } from '@/lib/unified-engine/hooks/selectors';

/**
  * SPATIAL editing layer for annotations.
 *
  * It replaces the imperative fillRect/strokeRect the renderer wrote into a
  * `pointer-events-none` canvas: those rectangles were a mere marker, you could
  * neither grab nor resize them. Here each region is a draggable Konva node,
  * with a Transformer to resize it.
  *
  * Regions are stored in CANVAS PIXELS (see use-whiteboard-renderer: seeding
  * projects them onto the artwork rectangle, then reprojectRegion carries them
  * when the canvas changes shape). So there is no change of coordinate frame
  * to make: the Layer simply carries the display/canvas scale, and the nodes
  * live in the same coordinates as the engine.
 */

/** Minimum size of a region, in canvas pixels. Below it the region can no
 *  longer be grabbed, and the engine would stamp nothing visible. */
const MIN_REGION_PX = 24;

const DEFAULT_STROKE = '#18181b';

export interface AnnotationOverlayProps {
  /** Width of the canvas frame — that of the <canvas> elements stacked below. */
  canvasWidth: number;
  canvasHeight: number;
  /** The layer is an editing tool: it hides the drawing being watched.
   *  It is removed during playback and scrubbing. */
  hidden?: boolean;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  canvasWidth,
  canvasHeight,
  hidden = false,
}) => {
  // Active scene only: indices passed to updateAnnotation are local to this
  // scene; the store maps them into the full array.
  const annotations = useUnifiedEngineStore(selectSceneAnnotations);
  const selectedIndex = useUnifiedEngineStore((s) => s.ui.selectedAnnotationIndex);
  const updateAnnotation = useUnifiedEngineStore((s) => s.updateAnnotation);
  const setSelectedAnnotation = useUnifiedEngineStore((s) => s.setSelectedAnnotation);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  // DISPLAYED size of the canvas. The Stage is rendered at this size and the Layer
  // carries the scale: the handles thus stay sharp at screen resolution
  // instead of being a 1920 canvas stretched by CSS.
  const [display, setDisplay] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      setDisplay({ width: r.width, height: r.height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = display.width > 0 ? display.width / canvasWidth : 0;

  // The Transformer follows the selection. It is attached imperatively: Konva
  // wants the NODE, which React cannot pass as a prop.
  //
  // The node is LOOKED UP BY NAME, not kept in a Map of refs: since the `ref`
  // callback was recreated on every render, React kept detaching it (null) and
  // reattaching it, and the effect hit a missing entry — the Transformer then
  // ended up with zero nodes and resizing emitted nothing.
  useEffect(() => {
    const tr = trRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;

    const node =
      selectedIndex == null
        ? null
        : layer.findOne<Konva.Rect>(`.annot-${selectedIndex}`);

    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedIndex, annotations, scale]);

  // Escape deselects. Without it the handles stay on a region you have
  // finished editing and hide the drawing underneath.
  useEffect(() => {
    if (selectedIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedAnnotation(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIndex, setSelectedAnnotation]);

  /** Clamps a region to the canvas, preserving its size when possible. */
  const clampRegion = useCallback(
    (r: { x: number; y: number; width: number; height: number }) => {
      const width = Math.min(Math.max(r.width, MIN_REGION_PX), canvasWidth);
      const height = Math.min(Math.max(r.height, MIN_REGION_PX), canvasHeight);
      return {
        x: Math.min(Math.max(r.x, 0), canvasWidth - width),
        y: Math.min(Math.max(r.y, 0), canvasHeight - height),
        width,
        height,
      };
    },
    [canvasWidth, canvasHeight]
  );

  const handleDragEnd = useCallback(
    (index: number, node: Konva.Rect) => {
      const region = clampRegion({
        x: node.x(),
        y: node.y(),
        width: node.width(),
        height: node.height(),
      });
      // The node is repositioned on the clamped value: otherwise a drag outside
      // the canvas would leave the on-screen rectangle at a place the store does
      // not contain.
      node.position({ x: region.x, y: region.y });
      updateAnnotation(index, { region });
    },
    [clampRegion, updateAnnotation]
  );

  const handleTransformEnd = useCallback(
    (index: number, node: Konva.Rect) => {
      // The Transformer works in SCALE, not size. We bake it into
      // width/height and reset it to 1, otherwise it would compound on the
      // next resize and the stroke would thicken with the region.
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);

      const region = clampRegion({
        x: node.x(),
        y: node.y(),
        width: node.width() * scaleX,
        height: node.height() * scaleY,
      });

      node.setAttrs(region);
      updateAnnotation(index, { region });
    },
    [clampRegion, updateAnnotation]
  );

  // Konva renders nothing until it knows its size, and a 0x0 Stage
  // would make the layer flicker on mount.
  const ready = display.width > 0 && display.height > 0;

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 z-30"
      style={{
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      {ready && (
        <Stage
          width={display.width}
          height={display.height}
          // Clicking empty space deselects. We compare the target to the Stage
          // itself: a click on a region bubbles up here too.
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) setSelectedAnnotation(null);
          }}
        >
          <Layer ref={layerRef} scaleX={scale} scaleY={scale}>
            {annotations.map((annot, i) => {
              const region = annot.region;
              if (!region) return null;

              const { stroke, fill } = annotationColors(annot, i);
              const isSelected = selectedIndex === i;

              return (
                <Group key={annot.id ?? i}>
                  <Rect
                    name={`annot-${i}`}
                    x={region.x}
                    y={region.y}
                    width={region.width}
                    height={region.height}
                    fill={fill}
                    stroke={stroke}
                    // The Layer scales everything: a stroke divided by the scale
                    // thus comes out at its nominal thickness on screen, whatever
                    // the preview size.
                    strokeWidth={(annot.style?.strokeWidth ?? 2) / scale}
                    opacity={annot.style?.opacity ?? 1}
                    draggable
                    onMouseDown={() => setSelectedAnnotation(i)}
                    onTap={() => setSelectedAnnotation(i)}
                    onDragEnd={(e) => handleDragEnd(i, e.target as Konva.Rect)}
                    onTransformEnd={(e) => handleTransformEnd(i, e.target as Konva.Rect)}
                    onMouseEnter={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'move';
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                  />

                  {/* Inside the zone, top-left, so labels of overlapping zones
                      don't stack on one line; the name only when selected. */}
                  <Label
                    x={region.x + 4 / scale}
                    y={region.y + 4 / scale}
                    listening={false}
                    opacity={isSelected ? 1 : 0.9}
                  >
                    <Tag
                      fill={isSelected ? '#ffde59' : '#ffffff'}
                      stroke="#18181b"
                      strokeWidth={1.5 / scale}
                      cornerRadius={3 / scale}
                    />
                    <Text
                      text={isSelected && annot.text ? `${i + 1}. ${annot.text}` : `${i + 1}`}
                      fontSize={13 / scale}
                      fontStyle="bold"
                      fontFamily="sans-serif"
                      fill="#18181b"
                      padding={4 / scale}
                    />
                  </Label>
                </Group>
              );
            })}

            <Transformer
              ref={trRef}
              rotateEnabled={false}
              flipEnabled={false}
              ignoreStroke
              // NOT divided by `scale`: the Transformer itself cancels
              // the Layer's scale to align with its target's absolute position,
              // so these sizes are already in SCREEN pixels.
              anchorSize={9}
              anchorCornerRadius={2}
              anchorStrokeWidth={1.5}
              borderStrokeWidth={1.5}
              borderStroke="#18181b"
              borderDash={[4, 4]}
              anchorStroke="#18181b"
              anchorFill="#ffde59"
              // Bounds are in ABSOLUTE Stage coordinates, hence at
              // display scale — thus the factor.
              boundBoxFunc={(oldBox, newBox) => {
                if (
                  newBox.width < MIN_REGION_PX * scale ||
                  newBox.height < MIN_REGION_PX * scale
                ) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      )}
    </div>
  );
};
