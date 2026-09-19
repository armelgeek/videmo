# SkeletonTrace Animation Style & Junction Resolution (R1 + R2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `SkeletonTrace` animation style for the whiteboard engine, porting R1 (morphological skeleton tracing) and R2 (cosine junction resolution) in pure TypeScript/JavaScript to draw complex line art stroke-by-stroke with human-like pen continuity.

**Architecture:** A modular pipeline under `lib/whiteboard-animation/lib/skeleton/` containing pure algorithmic units (Zhang-Suen thinning, Chamfer distance transform, topological graph extraction with BFS node clustering, and cosine tangent junction pairing). This pipeline feeds an `Animation` subclass `SkeletonTrace` that consumes waypoints via `paceStep()`, stamps adaptive capsules on a reveal mask canvas, and tracks the hand tip at 60 FPS.

**Tech Stack:** JavaScript (CommonJS runtime matching existing engine), TypeScript (typings and wrappers), Canvas 2D API, Vitest (test runner).

## Global Constraints

- Pure JS/TS implementation: 0 external native or C++ binary dependencies (no OpenCV, no SciPy, no node-gyp).
- 100% non-breaking integration with existing styles (`Contour`, `OutlineFill`, `ChunkJump`).
- All new algorithmic modules in `lib/skeleton/` must be pure functions operating on TypedArrays (`Uint8Array`, `Float32Array`) and independent of the DOM/Canvas.
- Canvas operations confined to `SkeletonTrace.js`.

---

### Task 1: Morphological Thinning (Zhang-Suen 2-passes)

**Files:**
- Create: `lib/whiteboard-animation/lib/skeleton/thinning.js`
- Test: `lib/whiteboard-animation/lib/skeleton/thinning.test.ts`

**Interfaces:**
- Consumes: `mask: Uint8Array`, `width: number`, `height: number` where `mask[y * width + x] === 1` for foreground pixels and `0` for background.
- Produces: `thinZhangSuen(mask: Uint8Array, width: number, height: number): Uint8Array` returning a new `Uint8Array` of size `width * height` containing the 1-pixel skeleton.

- [x] **Step 1: Write the failing test**

Create `lib/whiteboard-animation/lib/skeleton/thinning.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
const { thinZhangSuen } = require('./thinning');

describe('thinZhangSuen', () => {
  it('handles empty masks without error', () => {
    const mask = new Uint8Array(10 * 10);
    const skel = thinZhangSuen(mask, 10, 10);
    expect(skel.every((v: number) => v === 0)).toBe(true);
  });

  it('thins a solid 3x10 rectangle to a 1-pixel wide line', () => {
    const W = 10, H = 10;
    const mask = new Uint8Array(W * H);
    // Draw horizontal bar of height 3 (y = 4, 5, 6)
    for (let y = 4; y <= 6; y++) {
      for (let x = 2; x <= 7; x++) {
        mask[y * W + x] = 1;
      }
    }
    const skel = thinZhangSuen(mask, W, H);
    // Center row (y=5) should be retained
    for (let x = 2; x <= 7; x++) {
      expect(skel[5 * W + x]).toBe(1);
    }
    // Outer rows should be thinned away
    for (let x = 2; x <= 7; x++) {
      expect(skel[4 * W + x]).toBe(0);
      expect(skel[6 * W + x]).toBe(0);
    }
  });

  it('preserves connectivity of a cross shape (+)', () => {
    const W = 15, H = 15;
    const mask = new Uint8Array(W * H);
    // Thick cross
    for (let y = 3; y <= 11; y++) {
      for (let x = 6; x <= 8; x++) mask[y * W + x] = 1;
    }
    for (let y = 6; y <= 8; y++) {
      for (let x = 3; x <= 11; x++) mask[y * W + x] = 1;
    }
    const skel = thinZhangSuen(mask, W, H);
    // Intersection center must be present
    expect(skel[7 * W + 7]).toBe(1);
    // Total skeleton pixels must be significantly less than original mask
    const originalCount = mask.reduce((s, v) => s + v, 0);
    const skelCount = skel.reduce((s: number, v: number) => s + v, 0);
    expect(skelCount).toBeLessThan(originalCount / 2);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whiteboard-animation/lib/skeleton/thinning.test.ts`
Expected: FAIL with `Cannot find module './thinning'`

- [x] **Step 3: Write minimal implementation**

Create `lib/whiteboard-animation/lib/skeleton/thinning.js`:
```javascript
/**
 * Zhang-Suen Thinning Algorithm in pure JS.
 * Operates on a binary Uint8Array (0 = background, 1 = foreground).
 */

function thinZhangSuen(mask, width, height) {
  const W = width, H = height;
  const skel = new Uint8Array(mask);
  let changed = true;

  // Neighbors lookup relative to (y * W + x)
  // P9 P2 P3
  // P8 P1 P4
  // P7 P6 P5
  const toDelete = [];

  while (changed) {
    changed = false;

    // Sub-iteration 1
    toDelete.length = 0;
    for (let y = 1; y < H - 1; y++) {
      const yw = y * W;
      for (let x = 1; x < W - 1; x++) {
        const idx = yw + x;
        if (!skel[idx]) continue;

        const p2 = skel[idx - W];
        const p3 = skel[idx - W + 1];
        const p4 = skel[idx + 1];
        const p5 = skel[idx + W + 1];
        const p6 = skel[idx + W];
        const p7 = skel[idx + W - 1];
        const p8 = skel[idx - 1];
        const p9 = skel[idx - W - 1];

        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;

        let a = 0;
        if (!p2 && p3) a++;
        if (!p3 && p4) a++;
        if (!p4 && p5) a++;
        if (!p5 && p6) a++;
        if (!p6 && p7) a++;
        if (!p7 && p8) a++;
        if (!p8 && p9) a++;
        if (!p9 && p2) a++;
        if (a !== 1) continue;

        if (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) {
          toDelete.push(idx);
        }
      }
    }
    if (toDelete.length > 0) {
      changed = true;
      for (let i = 0; i < toDelete.length; i++) skel[toDelete[i]] = 0;
    }

    // Sub-iteration 2
    toDelete.length = 0;
    for (let y = 1; y < H - 1; y++) {
      const yw = y * W;
      for (let x = 1; x < W - 1; x++) {
        const idx = yw + x;
        if (!skel[idx]) continue;

        const p2 = skel[idx - W];
        const p3 = skel[idx - W + 1];
        const p4 = skel[idx + 1];
        const p5 = skel[idx + W + 1];
        const p6 = skel[idx + W];
        const p7 = skel[idx + W - 1];
        const p8 = skel[idx - 1];
        const p9 = skel[idx - W - 1];

        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;

        let a = 0;
        if (!p2 && p3) a++;
        if (!p3 && p4) a++;
        if (!p4 && p5) a++;
        if (!p5 && p6) a++;
        if (!p6 && p7) a++;
        if (!p7 && p8) a++;
        if (!p8 && p9) a++;
        if (!p9 && p2) a++;
        if (a !== 1) continue;

        if (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) {
          toDelete.push(idx);
        }
      }
    }
    if (toDelete.length > 0) {
      changed = true;
      for (let i = 0; i < toDelete.length; i++) skel[toDelete[i]] = 0;
    }
  }

  return skel;
}

module.exports = { thinZhangSuen };
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/lib/skeleton/thinning.test.ts`
Expected: PASS (3 tests passed)

- [x] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/lib/skeleton/thinning.js lib/whiteboard-animation/lib/skeleton/thinning.test.ts
git commit -m "feat(skeleton): add Zhang-Suen morphological thinning module"
```

---

### Task 2: Distance Transform Chamfer 3-4 (Adaptive Radius)

**Files:**
- Create: `lib/whiteboard-animation/lib/skeleton/distance-transform.js`
- Test: `lib/whiteboard-animation/lib/skeleton/distance-transform.test.ts`

**Interfaces:**
- Consumes: `mask: Uint8Array`, `width: number`, `height: number`
- Produces: `distanceTransformChamfer(mask: Uint8Array, width: number, height: number): Float32Array` returning local radius in pixels for each pixel.

- [x] **Step 1: Write the failing test**

Create `lib/whiteboard-animation/lib/skeleton/distance-transform.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
const { distanceTransformChamfer } = require('./distance-transform');

describe('distanceTransformChamfer', () => {
  it('returns 0 for background pixels', () => {
    const W = 8, H = 8;
    const mask = new Uint8Array(W * H);
    const dist = distanceTransformChamfer(mask, W, H);
    expect(dist.every((v: number) => v === 0)).toBe(true);
  });

  it('assigns radius = 1 to a 1-pixel wide line', () => {
    const W = 10, H = 5;
    const mask = new Uint8Array(W * H);
    for (let x = 1; x < 9; x++) mask[2 * W + x] = 1; // 1px horizontal line
    const dist = distanceTransformChamfer(mask, W, H);
    for (let x = 2; x < 8; x++) {
      expect(dist[2 * W + x]).toBeCloseTo(1, 0.5);
    }
  });

  it('computes larger radius at center of thick stripe', () => {
    const W = 15, H = 15;
    const mask = new Uint8Array(W * H);
    // Draw 7px thick square in center (y from 4 to 10, x from 4 to 10)
    for (let y = 4; y <= 10; y++) {
      for (let x = 4; x <= 10; x++) {
        mask[y * W + x] = 1;
      }
    }
    const dist = distanceTransformChamfer(mask, W, H);
    const centerRadius = dist[7 * W + 7];
    const edgeRadius = dist[4 * W + 7];
    expect(centerRadius).toBeGreaterThan(edgeRadius);
    expect(centerRadius).toBeGreaterThanOrEqual(3);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whiteboard-animation/lib/skeleton/distance-transform.test.ts`
Expected: FAIL with `Cannot find module './distance-transform'`

- [x] **Step 3: Write minimal implementation**

Create `lib/whiteboard-animation/lib/skeleton/distance-transform.js`:
```javascript
/**
 * 2-Pass Chamfer 3-4 Distance Transform.
 * Returns local stroke radius in pixels for each pixel.
 * Chamfer weights: 3 for orthogonal, 4 for diagonal. Divisor is 3.
 */

const INF = 1e7;

function distanceTransformChamfer(mask, width, height) {
  const W = width, H = height;
  const rawDist = new Int32Array(W * H);

  // Initialize: 0 for background, INF for foreground
  for (let i = 0; i < W * H; i++) {
    rawDist[i] = mask[i] ? INF : 0;
  }

  // Forward pass: top-to-bottom, left-to-right
  for (let y = 0; y < H; y++) {
    const yw = y * W;
    for (let x = 0; x < W; x++) {
      const idx = yw + x;
      if (rawDist[idx] === 0) continue;

      let d = rawDist[idx];
      if (x > 0) d = Math.min(d, rawDist[idx - 1] + 3);
      if (y > 0) {
        d = Math.min(d, rawDist[idx - W] + 3);
        if (x > 0) d = Math.min(d, rawDist[idx - W - 1] + 4);
        if (x < W - 1) d = Math.min(d, rawDist[idx - W + 1] + 4);
      }
      rawDist[idx] = d;
    }
  }

  // Backward pass: bottom-to-top, right-to-left
  for (let y = H - 1; y >= 0; y--) {
    const yw = y * W;
    for (let x = W - 1; x >= 0; x--) {
      const idx = yw + x;
      if (rawDist[idx] === 0) continue;

      let d = rawDist[idx];
      if (x < W - 1) d = Math.min(d, rawDist[idx + 1] + 3);
      if (y < H - 1) {
        d = Math.min(d, rawDist[idx + W] + 3);
        if (x < W - 1) d = Math.min(d, rawDist[idx + W + 1] + 4);
        if (x > 0) d = Math.min(d, rawDist[idx + W - 1] + 4);
      }
      rawDist[idx] = d;
    }
  }

  // Convert raw Chamfer distance (weight 3 = 1px) to float pixel radius
  const radius = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (mask[i]) {
      radius[i] = Math.max(1.0, rawDist[i] / 3.0);
    }
  }

  return radius;
}

module.exports = { distanceTransformChamfer };
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/lib/skeleton/distance-transform.test.ts`
Expected: PASS (3 tests passed)

- [x] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/lib/skeleton/distance-transform.js lib/whiteboard-animation/lib/skeleton/distance-transform.test.ts
git commit -m "feat(skeleton): add Chamfer 3-4 distance transform module"
```

---

### Task 3: Topological Graph Extraction & Node BFS Clustering

**Files:**
- Create: `lib/whiteboard-animation/lib/skeleton/skeleton-graph.js`
- Test: `lib/whiteboard-animation/lib/skeleton/skeleton-graph.test.ts`

**Interfaces:**
- Consumes: `skeleton: Uint8Array`, `width: number`, `height: number`
- Produces: `extractSkeletonPaths(skeleton: Uint8Array, width: number, height: number): SkeletonPath[]` where each path has `{ coords: Array<{x, y}>, core: Array<{x, y}>, startNode, endNode, start: {x,y}, end: {x,y}, startIsEndpoint: boolean, endIsEndpoint: boolean }`.

- [x] **Step 1: Write the failing test**

Create `lib/whiteboard-animation/lib/skeleton/skeleton-graph.test.ts`:
```typescript
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whiteboard-animation/lib/skeleton/skeleton-graph.test.ts`
Expected: FAIL with `Cannot find module './skeleton-graph'`

- [x] **Step 3: Write minimal implementation**

Create `lib/whiteboard-animation/lib/skeleton/skeleton-graph.js`:
```javascript
/**
 * Skeleton graph extraction and node BFS clustering.
 * Port of python whiteboard_animator/skeleton_paths.py
 */

function skeletonDegree(skeleton, W, H) {
  const degree = new Int16Array(W * H);
  for (let y = 0; y < H; y++) {
    const yw = y * W;
    for (let x = 0; x < W; x++) {
      const idx = yw + x;
      if (!skeleton[idx]) continue;
      let count = 0;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(H - 1, y + 1); ny++) {
        const nyw = ny * W;
        for (let nx = Math.max(0, x - 1); nx <= Math.min(W - 1, x + 1); nx++) {
          if (ny === y && nx === x) continue;
          if (skeleton[nyw + nx]) count++;
        }
      }
      degree[idx] = count;
    }
  }
  return degree;
}

function extractSkeletonPaths(skeleton, W, H) {
  const degree = skeletonDegree(skeleton, W, H);
  const nodeMask = new Uint8Array(W * H);
  let hasNodes = false;

  for (let i = 0; i < W * H; i++) {
    if (skeleton[i] && degree[i] !== 2) {
      nodeMask[i] = 1;
      hasNodes = true;
    }
  }

  if (!hasNodes) {
    return extractCyclePaths(skeleton, W, H);
  }

  // Group adjacent node pixels via BFS into single nodes (replaces scipy.ndimage.label)
  const labeledNodes = new Int32Array(W * H);
  let nextNodeId = 1;
  const nodePixels = new Map(); // nodeId -> Array<{x, y}>
  const nodeCenters = new Map(); // nodeId -> {x, y}

  for (let y = 0; y < H; y++) {
    const yw = y * W;
    for (let x = 0; x < W; x++) {
      const idx = yw + x;
      if (!nodeMask[idx] || labeledNodes[idx] !== 0) continue;

      const nodeId = nextNodeId++;
      const pixels = [];
      const queue = [{ x, y }];
      labeledNodes[idx] = nodeId;

      while (queue.length > 0) {
        const curr = queue.shift();
        pixels.push(curr);

        for (let ny = Math.max(0, curr.y - 1); ny <= Math.min(H - 1, curr.y + 1); ny++) {
          const nyw = ny * W;
          for (let nx = Math.max(0, curr.x - 1); nx <= Math.min(W - 1, curr.x + 1); nx++) {
            const nidx = nyw + nx;
            if (nodeMask[nidx] && labeledNodes[nidx] === 0) {
              labeledNodes[nidx] = nodeId;
              queue.push({ x: nx, y: ny });
            }
          }
        }
      }

      nodePixels.set(nodeId, pixels);
      const avgX = pixels.reduce((s, p) => s + p.x, 0) / pixels.length;
      const avgY = pixels.reduce((s, p) => s + p.y, 0) / pixels.length;
      nodeCenters.set(nodeId, { x: avgX, y: avgY });
    }
  }

  // Walk edges between nodes
  const visited = new Uint8Array(W * H);
  const paths = [];

  for (const [nodeId, pts] of nodePixels.entries()) {
    for (const pt of pts) {
      // Look at 8-neighbors on skeleton
      for (let ny = Math.max(0, pt.y - 1); ny <= Math.min(H - 1, pt.y + 1); ny++) {
        const nyw = ny * W;
        for (let nx = Math.max(0, pt.x - 1); nx <= Math.min(W - 1, pt.x + 1); nx++) {
          const nidx = nyw + nx;
          if (!skeleton[nidx] || nodeMask[nidx] || visited[nidx]) continue;

          const path = walkSkeletonPath(
            skeleton, nodeMask, labeledNodes, visited,
            nodeId, pt, { x: nx, y: ny }, W, H
          );
          if (path) {
            appendSkeletonPath(paths, path, nodePixels, nodeCenters, degree, W);
          }
        }
      }
    }
  }

  if (paths.length === 0) {
    return extractCyclePaths(skeleton, W, H);
  }

  return paths;
}

function walkSkeletonPath(skeleton, nodeMask, labeledNodes, visited, startNode, prev, curr, W, H) {
  const core = [];
  let endNode = null;
  let cur = curr;
  let prv = prev;

  while (true) {
    const idx = cur.y * W + cur.x;
    if (nodeMask[idx]) {
      endNode = labeledNodes[idx];
      break;
    }
    if (visited[idx]) break;

    visited[idx] = 1;
    core.push(cur);

    // Find neighbors excluding previous
    const neighbors = [];
    for (let ny = Math.max(0, cur.y - 1); ny <= Math.min(H - 1, cur.y + 1); ny++) {
      const nyw = ny * W;
      for (let nx = Math.max(0, cur.x - 1); nx <= Math.min(W - 1, cur.x + 1); nx++) {
        if (nx === cur.x && ny === cur.y) continue;
        if (nx === prv.x && ny === prv.y) continue;
        if (skeleton[nyw + nx]) neighbors.push({ x: nx, y: ny });
      }
    }

    const nodeNeighbors = neighbors.filter(p => nodeMask[p.y * W + p.x]);
    if (nodeNeighbors.length > 0) {
      endNode = labeledNodes[nodeNeighbors[0].y * W + nodeNeighbors[0].x];
      break;
    }

    const nextPixels = neighbors.filter(p => !visited[p.y * W + p.x]);
    if (nextPixels.length === 0) break;

    prv = cur;
    cur = nextPixels[0];
  }

  if (core.length === 0 && endNode === null) return null;
  return { startNode, endNode, core };
}

function appendSkeletonPath(paths, path, nodePixels, nodeCenters, degree, W) {
  const startNode = path.startNode;
  const endNode = path.endNode;
  const startPts = nodePixels.get(startNode) || [];
  const endPts = endNode !== null ? (nodePixels.get(endNode) || []) : [];

  const allCoords = [];
  const seen = new Set();
  const addPoint = (p) => {
    const key = `${p.x},${p.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      allCoords.push(p);
    }
  };

  startPts.forEach(addPoint);
  path.core.forEach(addPoint);
  endPts.forEach(addPoint);

  if (allCoords.length < 2) return;

  const startCenter = nodeCenters.get(startNode) || allCoords[0];
  const endCenter = endNode !== null && nodeCenters.has(endNode)
    ? nodeCenters.get(endNode)
    : allCoords[allCoords.length - 1];

  const startIsEndpoint = startPts.some(p => degree[p.y * W + p.x] === 1) &&
    !startPts.some(p => degree[p.y * W + p.x] >= 3);
  const endIsEndpoint = endNode !== null &&
    endPts.some(p => degree[p.y * W + p.x] === 1) &&
    !endPts.some(p => degree[p.y * W + p.x] >= 3);

  paths.push({
    coords: allCoords,
    core: path.core.length ? path.core : allCoords,
    startNode,
    endNode,
    start: startCenter,
    end: endCenter,
    startIsEndpoint,
    endIsEndpoint
  });
}

function extractCyclePaths(skeleton, W, H) {
  const visited = new Uint8Array(W * H);
  const paths = [];

  for (let y = 0; y < H; y++) {
    const yw = y * W;
    for (let x = 0; x < W; x++) {
      const idx = yw + x;
      if (!skeleton[idx] || visited[idx]) continue;

      const coords = [];
      let cur = { x, y };
      let prv = null;

      while (cur) {
        const cidx = cur.y * W + cur.x;
        if (visited[cidx]) break;
        visited[cidx] = 1;
        coords.push(cur);

        let next = null;
        for (let ny = Math.max(0, cur.y - 1); ny <= Math.min(H - 1, cur.y + 1); ny++) {
          const nyw = ny * W;
          for (let nx = Math.max(0, cur.x - 1); nx <= Math.min(W - 1, cur.x + 1); nx++) {
            if (nx === cur.x && ny === cur.y) continue;
            if (prv && nx === prv.x && ny === prv.y) continue;
            const nidx = nyw + nx;
            if (skeleton[nidx] && !visited[nidx]) {
              next = { x: nx, y: ny };
              break;
            }
          }
          if (next) break;
        }
        prv = cur;
        cur = next;
      }

      if (coords.length >= 3) {
        paths.push({
          coords,
          core: coords,
          startNode: null,
          endNode: null,
          start: coords[0],
          end: coords[coords.length - 1],
          startIsEndpoint: false,
          endIsEndpoint: false
        });
      }
    }
  }

  return paths;
}

module.exports = { extractSkeletonPaths, skeletonDegree };
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/lib/skeleton/skeleton-graph.test.ts`
Expected: PASS (4 tests passed)

- [x] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/lib/skeleton/skeleton-graph.js lib/whiteboard-animation/lib/skeleton/skeleton-graph.test.ts
git commit -m "feat(skeleton): add skeleton graph extraction and BFS node clustering"
```

---

### Task 4: Junction Resolution (R2) & Stroke Assembly

**Files:**
- Create: `lib/whiteboard-animation/lib/skeleton/junction-resolver.js`
- Test: `lib/whiteboard-animation/lib/skeleton/junction-resolver.test.ts`

**Interfaces:**
- Consumes: `paths: SkeletonPath[]`, `distMap: Float32Array`, `width: number`
- Produces: `buildLineArtStrokes(paths: SkeletonPath[], distMap: Float32Array, width: number): Stroke[]` where each stroke has `{ waypoints: Array<{ x, y, r }>, weight: number }`.

- [x] **Step 1: Write the failing test**

Create `lib/whiteboard-animation/lib/skeleton/junction-resolver.test.ts`:
```typescript
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
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whiteboard-animation/lib/skeleton/junction-resolver.test.ts`
Expected: FAIL with `Cannot find module './junction-resolver'`

- [x] **Step 3: Write minimal implementation**

Create `lib/whiteboard-animation/lib/skeleton/junction-resolver.js`:
```javascript
/**
 * R2: Junction Resolution & Continuous Stroke Assembly.
 * Pairs incident branches by cosine continuity of outward tangents.
 * Port of whiteboard_animator/skeleton_paths.py
 */

function orientedCore(path, fromStart) {
  const coords = path.core && path.core.length ? path.core : path.coords;
  return fromStart ? coords.slice() : coords.slice().reverse();
}

function outwardDirection(path, fromStart) {
  const coords = orientedCore(path, fromStart);
  if (coords.length < 2) return { x: 0, y: 0 };
  const lookahead = Math.min(5, coords.length - 1);
  const p0 = coords[0];
  const pL = coords[lookahead];
  const dx = pL.x - p0.x;
  const dy = pL.y - p0.y;
  const norm = Math.hypot(dx, dy);
  if (norm <= 1e-6) return { x: 0, y: 0 };
  return { x: dx / norm, y: dy / norm };
}

function pairJunctionBranches(paths) {
  // Map node -> list of tokens { pathIndex, fromStart }
  const incident = new Map();
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (p.startNode !== null) {
      if (!incident.has(p.startNode)) incident.set(p.startNode, []);
      incident.get(p.startNode).push({ pathIndex: i, fromStart: true });
    }
    if (p.endNode !== null) {
      if (!incident.has(p.endNode)) incident.set(p.endNode, []);
      incident.get(p.endNode).push({ pathIndex: i, fromStart: false });
    }
  }

  const tokenKey = (t) => `${t.pathIndex}:${t.fromStart}`;
  const pairings = new Map(); // tokenKey -> token

  for (const tokens of incident.values()) {
    const available = new Set(tokens.map(tokenKey));
    const tokenMap = new Map(tokens.map(t => [tokenKey(t), t]));
    const candidates = [];

    for (let i = 0; i < tokens.length; i++) {
      const left = tokens[i];
      const dirLeft = outwardDirection(paths[left.pathIndex], left.fromStart);
      if (dirLeft.x === 0 && dirLeft.y === 0) continue;

      for (let j = i + 1; j < tokens.length; j++) {
        const right = tokens[j];
        if (left.pathIndex === right.pathIndex) continue;
        const dirRight = outwardDirection(paths[right.pathIndex], right.fromStart);
        if (dirRight.x === 0 && dirRight.y === 0) continue;

        // Cosine of angle between outward tangents. Lower cosine (closer to -1) is straighter.
        const cosine = dirLeft.x * dirRight.x + dirLeft.y * dirRight.y;
        candidates.push({ cosine, left, right });
      }
    }

    candidates.sort((a, b) => a.cosine - b.cosine);

    for (const cand of candidates) {
      const kLeft = tokenKey(cand.left);
      const kRight = tokenKey(cand.right);
      if (!available.has(kLeft) || !available.has(kRight)) continue;

      pairings.set(kLeft, cand.right);
      pairings.set(kRight, cand.left);
      available.delete(kLeft);
      available.delete(kRight);
    }
  }

  return { pairings, tokenKey };
}

function buildLineArtStrokes(paths, distMap, W) {
  const validPaths = paths.filter(p => p.coords && p.coords.length >= 2);
  if (!validPaths.length) return [];

  const { pairings, tokenKey } = pairJunctionBranches(validPaths);
  const usedPaths = new Set();
  const strokes = [];

  function appendTrail(firstToken) {
    const trail = [];
    let token = firstToken;

    while (token) {
      if (usedPaths.has(token.pathIndex)) break;
      const path = validPaths[token.pathIndex];

      let coords;
      if (path.startNode === null && path.endNode === null) {
        // Closed loop / cycle
        coords = path.coords.slice();
      } else {
        coords = orientedCore(path, token.fromStart);
      }

      if (coords.length > 0) trail.push(...coords);
      usedPaths.add(token.pathIndex);

      const exitToken = { pathIndex: token.pathIndex, fromStart: !token.fromStart };
      token = pairings.get(tokenKey(exitToken)) || null;
    }

    if (!trail.length) return;

    // Deduplicate consecutive identical points
    const dedup = [];
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      if (dedup.length === 0 || dedup[dedup.length - 1].x !== p.x || dedup[dedup.length - 1].y !== p.y) {
        const radius = distMap ? (distMap[p.y * W + p.x] || 1.5) : 1.5;
        dedup.push({ x: p.x, y: p.y, r: radius });
      }
    }

    if (dedup.length >= 2) {
      strokes.push({
        waypoints: dedup,
        weight: dedup.length
      });
    }
  }

  // 1. Start from endpoints or unpaired branches
  const startTokens = [];
  for (let i = 0; i < validPaths.length; i++) {
    const p = validPaths[i];
    for (const fromStart of [true, false]) {
      const token = { pathIndex: i, fromStart };
      const node = fromStart ? p.startNode : p.endNode;
      if (node === null || !pairings.has(tokenKey(token))) {
        startTokens.push(token);
      }
    }
  }

  // Sort starts by: natural endpoint first (0), then y, then x
  startTokens.sort((a, b) => {
    const pA = validPaths[a.pathIndex];
    const pB = validPaths[b.pathIndex];
    const epA = a.fromStart ? pA.startIsEndpoint : pA.endIsEndpoint;
    const epB = b.fromStart ? pB.startIsEndpoint : pB.endIsEndpoint;
    if (epA !== epB) return epA ? -1 : 1;
    const ptA = a.fromStart ? pA.start : pA.end;
    const ptB = b.fromStart ? pB.start : pB.end;
    return (ptA.y - ptB.y) || (ptA.x - ptB.x);
  });

  for (const tok of startTokens) {
    appendTrail(tok);
  }

  // 2. Closed loops / remaining cycles
  for (let i = 0; i < validPaths.length; i++) {
    if (!usedPaths.has(i)) {
      appendTrail({ pathIndex: i, fromStart: true });
    }
  }

  return strokes;
}

module.exports = {
  buildLineArtStrokes,
  pairJunctionBranches,
  outwardDirection
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/lib/skeleton/junction-resolver.test.ts`
Expected: PASS (2 tests passed)

- [x] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/lib/skeleton/junction-resolver.js lib/whiteboard-animation/lib/skeleton/junction-resolver.test.ts
git commit -m "feat(skeleton): add R2 junction resolution and continuous stroke assembly"
```

---

### Task 5: SkeletonTrace Animation Style Integration & Factory Registration

**Files:**
- Create: `lib/whiteboard-animation/lib/styles/SkeletonTrace.js`
- Modify: `lib/whiteboard-animation/lib/styles/index.js`
- Modify: `lib/whiteboard-animation/types.ts:1-25`
- Test: `lib/whiteboard-animation/lib/styles/SkeletonTrace.test.ts`

**Interfaces:**
- Consumes: `thinZhangSuen`, `distanceTransformChamfer`, `extractSkeletonPaths`, `buildLineArtStrokes`
- Produces: `SkeletonTrace extends Animation`, registered as `"skeletontrace"` in `lib/styles/index.js` and `types.ts`.

- [ ] **Step 1: Write the failing test**

Create `lib/whiteboard-animation/lib/styles/SkeletonTrace.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
const SkeletonTrace = require('./SkeletonTrace');
const styles = require('./index');

describe('SkeletonTrace style', () => {
  it('is exported from lib/styles/index.js as SkeletonTrace', () => {
    expect(styles.SkeletonTrace).toBeDefined();
  });

  it('runs setup and initializes waypoints without error', () => {
    const W = 50, H = 50;
    const offscreen = {
      width: W,
      height: H,
      getContext: () => ({
        getImageData: () => ({
          data: new Uint8ClampedArray(W * H * 4)
        })
      })
    };
    const ctx = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      globalCompositeOperation: 'source-over'
    };
    const hctx = {
      clearRect: vi.fn()
    };
    const state = {
      canvasW: W,
      canvasH: H,
      contentBounds: { x: 0, y: 0, w: W, h: H },
      handSpeed: 5,
      hand: null
    };

    const anim = new SkeletonTrace({
      state,
      ctx,
      hctx,
      offscreen,
      callbacks: {
        drawHand: vi.fn(),
        finishAnim: vi.fn(),
        resScale: () => 1
      }
    });

    // Mock buildPresenceMap to return an empty map
    anim.buildPresenceMap = () => new Uint8Array(W * H);
    anim.setup();

    expect(state.skeletonStrokes).toBeDefined();
    expect(state.skeletonStrokes.length).toBe(0);

    // Mock tick() with 0 strokes calls finishAnim immediately
    anim.tick(10);
    expect(anim.finishAnim).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whiteboard-animation/lib/styles/SkeletonTrace.test.ts`
Expected: FAIL with `Cannot find module './SkeletonTrace'`

- [ ] **Step 3: Write implementation**

1. Create `lib/whiteboard-animation/lib/styles/SkeletonTrace.js`:
```javascript
/**
 * SkeletonTrace animation style.
 * Renders line art along topological skeleton paths with R2 junction continuity.
 */

const Animation = require('../Animation');
const { thinZhangSuen } = require('../skeleton/thinning');
const { distanceTransformChamfer } = require('../skeleton/distance-transform');
const { extractSkeletonPaths } = require('../skeleton/skeleton-graph');
const { buildLineArtStrokes } = require('../skeleton/junction-resolver');

class SkeletonTrace extends Animation {
  setup() {
    const cb = this.state.contentBounds;
    const W = Math.max(1, Math.round(cb.w));
    const H = Math.max(1, Math.round(cb.h));
    const presenceMap = this.buildPresenceMap();

    // Check for empty region
    let hasPixels = false;
    for (let i = 0; i < presenceMap.length; i++) {
      if (presenceMap[i]) { hasPixels = true; break; }
    }

    if (!hasPixels) {
      this.state.skeletonStrokes = [];
      this.state.skeletonTotalPts = 0;
      this.state.skeletonCurrentPt = 0;
      return;
    }

    // Pipeline: Thinning -> Distance Transform -> Graph -> Junction Pairing
    const skeleton = thinZhangSuen(presenceMap, W, H);
    const distMap = distanceTransformChamfer(presenceMap, W, H);
    const paths = extractSkeletonPaths(skeleton, W, H);
    const localStrokes = buildLineArtStrokes(paths, distMap, W);

    // Transform local coordinates (0..W, 0..H) to global canvas coordinates (+ cb.x, + cb.y)
    const scale = this.resScale ? this.resScale() : 1;
    const strokes = localStrokes.map(stroke => ({
      weight: stroke.weight,
      waypoints: stroke.waypoints.map(pt => ({
        x: cb.x + pt.x,
        y: cb.y + pt.y,
        r: Math.max(1.2 * scale, pt.r * scale)
      }))
    }));

    let totalPts = 0;
    strokes.forEach(s => { totalPts += s.waypoints.length; });

    this.state.skeletonStrokes = strokes;
    this.state.skeletonStrokeIdx = 0;
    this.state.skeletonPtIdx = 0;
    this.state.skeletonTotalPts = totalPts;
    this.state.skeletonDrawnPts = 0;

    // Create mask canvas for revealing offscreen content
    if (!this.state.skeletonMaskCanvas) {
      this.state.skeletonMaskCanvas = document.createElement('canvas');
    }
    this.state.skeletonMaskCanvas.width = this.state.canvasW;
    this.state.skeletonMaskCanvas.height = this.state.canvasH;
    const mctx = this.state.skeletonMaskCanvas.getContext('2d');
    mctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
  }

  tick(speed, deltaMs = 16.67) {
    const handSpeed = this.state.handSpeed || 5;

    this.withAnnotationAwareness(deltaMs, (annot, bounds, paceSpeed, legacy) => {
      if (this.state._annotationChanged) {
        this.setup();
      }

      const strokes = this.state.skeletonStrokes || [];
      if (!strokes.length || this.state.skeletonStrokeIdx >= strokes.length) {
        this.finishAnim();
        return;
      }

      const remainingPts = Math.max(1, this.state.skeletonTotalPts - this.state.skeletonDrawnPts);
      const step = Math.max(1, this.paceStep(remainingPts, Math.max(1, handSpeed), 2, 1));
      const mctx = this.state.skeletonMaskCanvas.getContext('2d');

      let lastX = 0, lastY = 0;
      let prevX = 0;

      mctx.save();
      mctx.lineCap = 'round';
      mctx.lineJoin = 'round';
      mctx.fillStyle = '#fff';
      mctx.strokeStyle = '#fff';

      for (let s = 0; s < step; s++) {
        if (this.state.skeletonStrokeIdx >= strokes.length) break;

        const currentStroke = strokes[this.state.skeletonStrokeIdx];
        const pts = currentStroke.waypoints;
        const pt = pts[this.state.skeletonPtIdx];

        if (this.state.skeletonPtIdx === 0) {
          // Stamp first point circle
          mctx.beginPath();
          mctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
          mctx.fill();
        } else {
          // Stamp continuous capsule line segment from previous point
          const prevPt = pts[this.state.skeletonPtIdx - 1];
          prevX = prevPt.x;
          mctx.lineWidth = pt.r * 2;
          mctx.beginPath();
          mctx.moveTo(prevPt.x, prevPt.y);
          mctx.lineTo(pt.x, pt.y);
          mctx.stroke();
        }

        lastX = pt.x;
        lastY = pt.y;
        this.state.skeletonPtIdx++;
        this.state.skeletonDrawnPts++;

        if (this.state.skeletonPtIdx >= pts.length) {
          this.state.skeletonStrokeIdx++;
          this.state.skeletonPtIdx = 0;
        }
      }
      mctx.restore();

      // Render revealed image to main canvas
      this.ctx.save();
      if (legacy) this.fillBg(this.ctx);

      // Mask offscreen drawing with skeletonMaskCanvas
      this.ensureRevealCanvas();
      const rc = this.state.revealCanvas;
      const rctx = rc.getContext('2d');
      rctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);

      // Draw original source, then mask with skeletonMaskCanvas
      rctx.drawImage(this.offscreen, 0, 0);
      rctx.globalCompositeOperation = 'destination-in';
      rctx.drawImage(this.state.skeletonMaskCanvas, 0, 0);
      rctx.globalCompositeOperation = 'source-over';

      this.ctx.drawImage(rc, 0, 0);
      this.ctx.restore();

      // Draw hand at active tip
      const dir = lastX >= prevX ? 1 : -1;
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this.drawHand(this.hctx, lastX, lastY, dir, this.state.hand);

      // Progress reporting
      const progress = this.state.skeletonTotalPts > 0
        ? Math.min(1.0, this.state.skeletonDrawnPts / this.state.skeletonTotalPts)
        : 1.0;
      this.setProgress(progress);

      if (this.state.skeletonStrokeIdx >= strokes.length) {
        this.finishAnim();
      }
    });
  }
}

module.exports = SkeletonTrace;
```

2. Register in `lib/whiteboard-animation/lib/styles/index.js`:
Add `const SkeletonTrace = require('./SkeletonTrace');` and export `SkeletonTrace`.

3. Register in `lib/whiteboard-animation/types.ts`:
Add `"skeletontrace"` to `AnimationStyle`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/lib/styles/SkeletonTrace.test.ts`
Expected: PASS (2 tests passed)

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/lib/styles/SkeletonTrace.js lib/whiteboard-animation/lib/styles/index.js lib/whiteboard-animation/types.ts lib/whiteboard-animation/lib/styles/SkeletonTrace.test.ts
git commit -m "feat(styles): integrate SkeletonTrace animation style with factory registration"
```

---

### Task 6: Full Integration Test Suite

**Files:**
- Create: `lib/whiteboard-animation/lib/styles/skeleton-integration.test.ts`

**Interfaces:**
- Validates the end-to-end flow of synthetic images through `SkeletonTrace`:
  1. Plus/Cross shape (+): verifies junction continuity and non-fragmentation.
  2. Thick vs thin lines: verifies distance-transform radius adaptation.
  3. Closed circle: verifies cycle pathing.
  4. Empty region: verifies immediate clean completion.

- [ ] **Step 1: Write integration tests**

Create `lib/whiteboard-animation/lib/styles/skeleton-integration.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
const SkeletonTrace = require('./SkeletonTrace');

function createMockContext(W: number, H: number) {
  const canvas = {
    width: W,
    height: H,
    getContext: () => ({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      globalCompositeOperation: 'source-over'
    })
  };
  return canvas;
}

describe('SkeletonTrace End-to-End Integration', () => {
  it('runs complete lifecycle on a synthetic cross image (+)', () => {
    const W = 40, H = 40;
    const offscreen = createMockContext(W, H);
    const ctx = createMockContext(W, H).getContext();
    const hctx = createMockContext(W, H).getContext();
    const finishAnim = vi.fn();
    const drawHand = vi.fn();

    const state: any = {
      canvasW: W,
      canvasH: H,
      contentBounds: { x: 0, y: 0, w: W, h: H },
      handSpeed: 10,
      hand: null
    };

    const anim = new SkeletonTrace({
      state,
      ctx,
      hctx,
      offscreen,
      callbacks: { finishAnim, drawHand }
    });

    // Mock presence map with a 3px thick cross (+)
    const presence = new Uint8Array(W * H);
    for (let y = 10; y <= 30; y++) {
      for (let x = 18; x <= 22; x++) presence[y * W + x] = 1; // vertical
    }
    for (let y = 18; y <= 22; y++) {
      for (let x = 10; x <= 30; x++) presence[y * W + x] = 1; // horizontal
    }
    anim.buildPresenceMap = () => presence;

    anim.setup();

    // Verification of R2: Must have resolved cross into continuous strokes
    expect(state.skeletonStrokes.length).toBe(2);
    expect(state.skeletonTotalPts).toBeGreaterThan(30);

    // Simulate animation loop until finish
    let ticks = 0;
    while (!finishAnim.mock.calls.length && ticks < 200) {
      anim.tick(10, 16.67);
      ticks++;
    }

    expect(finishAnim).toHaveBeenCalled();
    expect(drawHand).toHaveBeenCalled();
    expect(state.skeletonDrawnPts).toBe(state.skeletonTotalPts);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/lib/styles/skeleton-integration.test.ts`
Expected: PASS (1 test passed)

- [ ] **Step 3: Commit**

```bash
git add lib/whiteboard-animation/lib/styles/skeleton-integration.test.ts
git commit -m "test(skeleton): add end-to-end integration test for cross shape and animation lifecycle"
```
