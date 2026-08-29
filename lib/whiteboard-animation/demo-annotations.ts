import { Annotation } from './schema';

// Demo annotations for scene-premium-bag
export const DEMO_ANNOTATIONS: Annotation[] = [
  {
    id: 'annot-1',
    text: 'Premium Material',
    region: { x: 50, y: 80, width: 300, height: 180 },
    reveal: { from: 0, to: 2000, durationMs: 2000 },
    style: {
      strokeColor: '#2563eb',
      strokeWidth: 2,
      fillColor: 'rgba(37, 99, 235, 0.12)',
      opacity: 1,
    },
  },
  {
    id: 'annot-2',
    text: 'Leather Stitching',
    region: { x: 400, y: 150, width: 250, height: 200 },
    reveal: { from: 2100, to: 4100, durationMs: 2000 },
    style: {
      strokeColor: '#ef4444',
      strokeWidth: 2,
      fillColor: 'rgba(239, 68, 68, 0.12)',
      opacity: 1,
    },
  },
  {
    id: 'annot-3',
    text: 'Structural Design',
    region: { x: 150, y: 350, width: 320, height: 240 },
    reveal: { from: 4200, to: 6200, durationMs: 2000 },
    style: {
      strokeColor: '#10b981',
      strokeWidth: 2,
      fillColor: 'rgba(16, 185, 129, 0.12)',
      opacity: 1,
    },
  },
  {
    id: 'annot-4',
    text: 'Finishing Touch',
    region: { x: 600, y: 300, width: 200, height: 150 },
    reveal: { from: 6300, to: 8300, durationMs: 2000 },
    style: {
      strokeColor: '#a855f7',
      strokeWidth: 2,
      fillColor: 'rgba(168, 85, 247, 0.12)',
      opacity: 1,
    },
  },
];
