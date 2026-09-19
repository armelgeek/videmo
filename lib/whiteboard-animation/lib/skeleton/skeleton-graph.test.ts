import { describe, it, expect } from 'vitest';
const { extractSkeletonPaths, skeletonDegree } = require('./skeleton-graph');

describe('skeleton-graph', () => {
  it('computes 8-neighbor degrees correctly', () => {
    const W = 5, H = 5;
    const skel = new Uint8Array(W * H);
    // Center point with horizontal line
    skel[2 * W + 1] = 1;
    skel[2 * W + 2] = 1;
    skel[2 * W + 3] = 1;
    const deg = skeletonDegree(skel, W, H);
    expect(deg[2 * W + 1]).toBe(1); // endpoint
    expect(deg[2 * W + 2]).toBe(2); // regular body
    expect(deg[2 * W + 3]).toBe(1); // endpoint
  });

  it('handles empty skeleton without throwing', () => {
    const W = 6, H = 6;
    const skel = new Uint8Array(W * H);
    const paths = extractSkeletonPaths(skel, W, H);
    expect(paths).toEqual([]);
  });

  it('extracts a single path for a simple straight line', () => {
    const W = 10, H = 10;
    const skel = new Uint8Array(W * H);
    for (let x = 2; x <= 7; x++) skel[5 * W + x] = 1;
    const paths = extractSkeletonPaths(skel, W, H);
    expect(paths.length).toBe(1);
    expect(paths[0].coords.length).toBe(6);
    expect(paths[0].startIsEndpoint).toBe(true);
    expect(paths[0].endIsEndpoint).toBe(true);
  });

  it('extracts 4 incident paths meeting at a central junction node for a cross (+)', () => {
    const W = 11, H = 11;
    const skel = new Uint8Array(W * H);
    for (let i = 2; i <= 8; i++) {
      skel[5 * W + i] = 1; // horizontal
      skel[i * W + 5] = 1; // vertical
    }
    const paths = extractSkeletonPaths(skel, W, H);
    // 4 branches: top, bottom, left, right
    expect(paths.length).toBe(4);
    // All 4 branches should share the same junction node at (5, 5)
    const nodeIds = new Set();
    paths.forEach((p: any) => {
      if (!p.startIsEndpoint) nodeIds.add(p.startNode);
      if (!p.endIsEndpoint) nodeIds.add(p.endNode);
    });
    expect(nodeIds.size).toBe(1);
  });

  it('extracts 3 incident paths for a T-junction', () => {
    const W = 11, H = 11;
    const skel = new Uint8Array(W * H);
    // Horizontal top bar
    for (let x = 2; x <= 8; x++) skel[3 * W + x] = 1;
    // Vertical stem going down from (5, 3)
    for (let y = 3; y <= 8; y++) skel[y * W + 5] = 1;

    const paths = extractSkeletonPaths(skel, W, H);
    expect(paths.length).toBe(3);
    const nodeIds = new Set();
    paths.forEach((p: any) => {
      if (!p.startIsEndpoint) nodeIds.add(p.startNode);
      if (!p.endIsEndpoint) nodeIds.add(p.endNode);
    });
    expect(nodeIds.size).toBe(1);
  });

  it('extracts multiple disjoint paths cleanly', () => {
    const W = 12, H = 12;
    const skel = new Uint8Array(W * H);
    // Line 1: row 2, x from 2 to 5
    for (let x = 2; x <= 5; x++) skel[2 * W + x] = 1;
    // Line 2: row 8, x from 6 to 9
    for (let x = 6; x <= 9; x++) skel[8 * W + x] = 1;

    const paths = extractSkeletonPaths(skel, W, H);
    expect(paths.length).toBe(2);
    expect(paths[0].startIsEndpoint).toBe(true);
    expect(paths[0].endIsEndpoint).toBe(true);
    expect(paths[1].startIsEndpoint).toBe(true);
    expect(paths[1].endIsEndpoint).toBe(true);
  });

  it('extracts a closed loop when no endpoints or junctions exist (circle)', () => {
    const W = 10, H = 10;
    const skel = new Uint8Array(W * H);
    // 4x4 square loop
    for (let x = 3; x <= 6; x++) { skel[3 * W + x] = 1; skel[6 * W + x] = 1; }
    for (let y = 3; y <= 6; y++) { skel[y * W + 3] = 1; skel[y * W + 6] = 1; }
    const paths = extractSkeletonPaths(skel, W, H);
    expect(paths.length).toBe(1);
    expect(paths[0].coords.length).toBeGreaterThanOrEqual(8);
  });
});
