import type { Annotation } from '@/lib/unified-engine/types';

// Transcribed from public/scene-premium-bag.annotation.json.
// Coordinates are in SOURCE space and must be projected before drawing.
export const SCENE_PREMIUM_BAG_SOURCE = { width: 1536, height: 864 } as const;

export const SCENE_PREMIUM_BAG_DURATION_MS = 11700;

const PALETTE = [
  { strokeColor: '#2563eb', fillColor: 'rgba(37, 99, 235, 0.12)' },
  { strokeColor: '#ef4444', fillColor: 'rgba(239, 68, 68, 0.12)' },
  { strokeColor: '#10b981', fillColor: 'rgba(16, 185, 129, 0.12)' },
  { strokeColor: '#a855f7', fillColor: 'rgba(168, 85, 247, 0.12)' },
  { strokeColor: '#f97316', fillColor: 'rgba(249, 115, 22, 0.12)' },
];

interface RawElement {
  id: string;
  text: string;
  region: { x: number; y: number; width: number; height: number };
  startMs: number;
  durationMs: number;
}

const ELEMENTS: RawElement[] = [
  {
    id: 'title',
    text: 'Titre "Premium Image"',
    region: { x: 100, y: 75, width: 680, height: 117 },
    startMs: 300,
    durationMs: 1600,
  },
  {
    id: 'bag',
    text: 'Sac à main',
    region: { x: 770, y: 230, width: 400, height: 535 },
    startMs: 2000,
    durationMs: 3400,
  },
  {
    id: 'tag',
    text: 'Étiquette de prix',
    region: { x: 595, y: 405, width: 204, height: 247 },
    startMs: 5500,
    durationMs: 2000,
  },
  {
    id: 'question',
    text: "Point d'interrogation",
    region: { x: 1170, y: 220, width: 201, height: 380 },
    startMs: 7600,
    durationMs: 1400,
  },
  {
    id: 'region_5',
    text: 'Zone 5',
    region: { x: 104, y: 192, width: 672, height: 101 },
    startMs: 9200,
    durationMs: 2000,
  },
];

export const SCENE_PREMIUM_BAG_ANNOTATIONS: Annotation[] = ELEMENTS.map(
  (el, i) => ({
    id: el.id,
    text: el.text,
    region: el.region,
    reveal: {
      from: el.startMs,
      to: el.startMs + el.durationMs,
      startMs: el.startMs,
      durationMs: el.durationMs,
    },
    style: { ...PALETTE[i % PALETTE.length], strokeWidth: 2, opacity: 1 },
  })
);

/** Scale source-space annotations onto a canvas of a different size. */
export function projectAnnotations(
  annotations: Annotation[],
  targetWidth: number,
  targetHeight: number,
  source = SCENE_PREMIUM_BAG_SOURCE
): Annotation[] {
  const scaleX = targetWidth / source.width;
  const scaleY = targetHeight / source.height;

  return annotations.map((a) => ({
    ...a,
    region: {
      x: Math.round(a.region.x * scaleX),
      y: Math.round(a.region.y * scaleY),
      width: Math.round(a.region.width * scaleX),
      height: Math.round(a.region.height * scaleY),
    },
  }));
}
