import { describe, it, expect } from 'vitest';
const { buildLineArtStrokes, pairJunctionBranches, outwardDirection } = require('./junction-resolver');

describe('junction-resolver (R2)', () => {
  it('computes unit outward direction tangent correctly', () => {
    const path = {
      core: [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 }]
    };
    const dirFromStart = outwardDirection(path, true);
    expect(dirFromStart.x).toBeCloseTo(1, 4);
    expect(dirFromStart.y).toBeCloseTo(0, 4);

    const dirFromEnd = outwardDirection(path, false);
    expect(dirFromEnd.x).toBeCloseTo(-1, 4);
    expect(dirFromEnd.y).toBeCloseTo(0, 4);
  });

  it('pairs opposite branches across a 4-way cross (+) into 2 continuous strokes', () => {
    // 4 branches meeting at node 1 (center x=10, y=10)
    const paths = [
      // Left arm: x from 5 to 10 at y=10, endNode=1
      { coords: [{x:5,y:10},{x:6,y:10},{x:7,y:10},{x:8,y:10},{x:9,y:10},{x:10,y:10}], core: [{x:5,y:10},{x:6,y:10},{x:7,y:10},{x:8,y:10},{x:9,y:10},{x:10,y:10}], startNode: null, endNode: 1, start: {x:5,y:10}, end: {x:10,y:10}, startIsEndpoint: true, endIsEndpoint: false },
      // Right arm: x from 10 to 15 at y=10, startNode=1
      { coords: [{x:10,y:10},{x:11,y:10},{x:12,y:10},{x:13,y:10},{x:14,y:10},{x:15,y:10}], core: [{x:10,y:10},{x:11,y:10},{x:12,y:10},{x:13,y:10},{x:14,y:10},{x:15,y:10}], startNode: 1, endNode: null, start: {x:10,y:10}, end: {x:15,y:10}, startIsEndpoint: false, endIsEndpoint: true },
      // Top arm: y from 5 to 10 at x=10, endNode=1
      { coords: [{x:10,y:5},{x:10,y:6},{x:10,y:7},{x:10,y:8},{x:10,y:9},{x:10,y:10}], core: [{x:10,y:5},{x:10,y:6},{x:10,y:7},{x:10,y:8},{x:10,y:9},{x:10,y:10}], startNode: null, endNode: 1, start: {x:10,y:5}, end: {x:10,y:10}, startIsEndpoint: true, endIsEndpoint: false },
      // Bottom arm: y from 10 to 15 at x=10, startNode=1
      { coords: [{x:10,y:10},{x:10,y:11},{x:10,y:12},{x:10,y:13},{x:10,y:14},{x:10,y:15}], core: [{x:10,y:10},{x:10,y:11},{x:10,y:12},{x:10,y:13},{x:10,y:14},{x:10,y:15}], startNode: 1, endNode: null, start: {x:10,y:10}, end: {x:10,y:15}, startIsEndpoint: false, endIsEndpoint: true }
    ];

    const distMap = new Float32Array(20 * 20).fill(2.0);
    const strokes = buildLineArtStrokes(paths, distMap, 20);

    // Must yield EXACTLY 2 continuous strokes (horizontal line + vertical line)
    expect(strokes.length).toBe(2);
    // Each stroke should span ~11 waypoints from one outer end through the center to the opposite end
    expect(strokes[0].waypoints.length).toBeGreaterThanOrEqual(10);
    expect(strokes[1].waypoints.length).toBeGreaterThanOrEqual(10);
  });

  it('handles T-junctions by continuing the straight through-line and leaving the stem separate', () => {
    // Left arm (y=10, x 5->10, endNode 1)
    // Right arm (y=10, x 10->15, startNode 1)
    // Stem (x=10, y 10->15, startNode 1)
    const paths = [
      { coords: [{x:5,y:10},{x:6,y:10},{x:7,y:10},{x:8,y:10},{x:9,y:10},{x:10,y:10}], core: [{x:5,y:10},{x:6,y:10},{x:7,y:10},{x:8,y:10},{x:9,y:10},{x:10,y:10}], startNode: null, endNode: 1, start: {x:5,y:10}, end: {x:10,y:10}, startIsEndpoint: true, endIsEndpoint: false },
      { coords: [{x:10,y:10},{x:11,y:10},{x:12,y:10},{x:13,y:10},{x:14,y:10},{x:15,y:10}], core: [{x:10,y:10},{x:11,y:10},{x:12,y:10},{x:13,y:10},{x:14,y:10},{x:15,y:10}], startNode: 1, endNode: null, start: {x:10,y:10}, end: {x:15,y:10}, startIsEndpoint: false, endIsEndpoint: true },
      { coords: [{x:10,y:10},{x:10,y:11},{x:10,y:12},{x:10,y:13},{x:10,y:14},{x:10,y:15}], core: [{x:10,y:10},{x:10,y:11},{x:10,y:12},{x:10,y:13},{x:10,y:14},{x:10,y:15}], startNode: 1, endNode: null, start: {x:10,y:10}, end: {x:10,y:15}, startIsEndpoint: false, endIsEndpoint: true }
    ];
    const distMap = new Float32Array(20 * 20).fill(1.5);
    const strokes = buildLineArtStrokes(paths, distMap, 20);

    // 2 strokes: 1 continuous through-bar (left+right) and 1 stem
    expect(strokes.length).toBe(2);
    const lengths = strokes.map(s => s.waypoints.length).sort((a, b) => b - a);
    expect(lengths[0]).toBeGreaterThanOrEqual(10); // through bar
    expect(lengths[1]).toBeGreaterThanOrEqual(5);  // stem
  });

  it('handles empty path list gracefully', () => {
    const strokes = buildLineArtStrokes([], null, 10);
    expect(strokes).toEqual([]);
  });
});
