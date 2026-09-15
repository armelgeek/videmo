'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { annotationColors } from "../schema";
import { Stage, Layer, Rect, Group, Label, Tag, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import { selectSceneAnnotations } from '@/lib/unified-engine/hooks/selectors';

/**
 * Calque d'edition SPATIALE des annotations.
 *
 * Il remplace le fillRect/strokeRect imperatif qu'ecrivait le renderer dans un
 * canvas `pointer-events-none` : ces rectangles etaient un simple repere, on ne
 * pouvait ni les saisir ni les redimensionner. Ici chaque region est un noeud
 * Konva deplacable, avec un Transformer pour la redimensionner.
 *
 * Les regions sont stockees en PIXELS CANVAS (voir use-whiteboard-renderer :
 * l'amorcage les projette sur le rectangle d'artwork puis reprojeterRegion les
 * transporte quand le canvas change de forme). Il n'y a donc aucun changement
 * de repere a faire : le Layer porte simplement l'echelle affichage/canvas, et
 * les noeuds vivent dans les memes coordonnees que le moteur.
 */

/** Taille minimale d'une region, en pixels canvas. En dessous elle n'est plus
 *  saisissable, et le moteur ne tamponnerait rien de visible. */
const MIN_REGION_PX = 24;

const DEFAULT_STROKE = '#2563eb';

export interface AnnotationOverlayProps {
  /** Largeur du repere canvas — celle des <canvas> empiles dessous. */
  canvasWidth: number;
  canvasHeight: number;
  /** Le calque est un outil d'edition : il masque le dessin qu'on regarde.
   *  On le retire pendant la lecture et le scrub. */
  hidden?: boolean;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  canvasWidth,
  canvasHeight,
  hidden = false,
}) => {
  // La scene active seulement : les index passes a updateAnnotation sont
  // locaux a cette scene, le store les traduit dans le tableau complet.
  const annotations = useUnifiedEngineStore(selectSceneAnnotations);
  const selectedIndex = useUnifiedEngineStore((s) => s.ui.selectedAnnotationIndex);
  const updateAnnotation = useUnifiedEngineStore((s) => s.updateAnnotation);
  const setSelectedAnnotation = useUnifiedEngineStore((s) => s.setSelectedAnnotation);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  // Taille AFFICHEE du canvas. Le Stage est rendu a cette taille et le Layer
  // porte l'echelle : les poignees restent ainsi nettes a la resolution ecran
  // au lieu d'etre un canvas 1920 etire par le CSS.
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

  // Le Transformer suit la selection. Il est rattache imperativement : Konva
  // veut le NOEUD, que React ne peut pas passer en prop.
  //
  // Le noeud est RETROUVE PAR NOM, pas garde dans une Map de refs : la callback
  // `ref` etant recreee a chaque rendu, React la detachait (null) et la
  // rattachait sans cesse, et l'effet tombait sur une entree absente — le
  // Transformer se retrouvait alors avec zero noeud et le redimensionnement
  // n'emettait plus rien.
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

  // Echap deselectionne. Sans cela les poignees restent sur une region qu'on a
  // fini d'editer et masquent le dessin en dessous.
  useEffect(() => {
    if (selectedIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedAnnotation(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIndex, setSelectedAnnotation]);

  /** Borne une region au canvas, en preservant sa taille quand c'est possible. */
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
      // Le noeud est repositionne sur la valeur bornee : sinon un drag hors du
      // canvas laisserait le rectangle a l'ecran a un endroit que le store ne
      // contient pas.
      node.position({ x: region.x, y: region.y });
      updateAnnotation(index, { region });
    },
    [clampRegion, updateAnnotation]
  );

  const handleTransformEnd = useCallback(
    (index: number, node: Konva.Rect) => {
      // Le Transformer travaille en ECHELLE, pas en taille. On la cuit dans
      // width/height et on la remet a 1, sinon elle se composerait au
      // redimensionnement suivant et le trait grossirait avec la region.
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

  // Konva ne rend rien tant qu'il ne connait pas sa taille, et un Stage 0x0
  // ferait clignoter le calque au montage.
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
          // Cliquer dans le vide deselectionne. On compare la cible au Stage
          // lui-meme : un clic sur une region remonte jusqu'ici aussi.
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
                    // Le Layer met tout a l'echelle : un trait divise par elle
                    // ressort donc a son epaisseur nominale a l'ecran, quelle
                    // que soit la taille de la preview.
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
                    <Tag fill={stroke} cornerRadius={3 / scale} />
                    <Text
                      text={isSelected && annot.text ? `${i + 1}. ${annot.text}` : `${i + 1}`}
                      fontSize={14 / scale}
                      fontStyle="bold"
                      fontFamily="Geist, sans-serif"
                      fill="#ffffff"
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
              // PAS divise par `scale` : le Transformer annule lui-meme
              // l'echelle du Layer pour se caler sur la position absolue de sa
              // cible, donc ces tailles sont deja en pixels ECRAN.
              anchorSize={8}
              anchorCornerRadius={2}
              anchorStrokeWidth={1}
              borderStrokeWidth={1}
              borderStroke={DEFAULT_STROKE}
              anchorStroke={DEFAULT_STROKE}
              anchorFill="#ffffff"
              // Les bornes sont en coordonnees ABSOLUES du Stage, donc a
              // l'echelle de l'affichage — d'ou le facteur.
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
