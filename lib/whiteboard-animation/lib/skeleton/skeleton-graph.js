/**
 * Skeleton graph extraction and node BFS clustering in pure JS.
 * Port of python whiteboard_animator/skeleton_paths.py
 * Uses Rutovitz crossing number for topological degree classification
 * (endpoints = 1, regular path = 2, junctions >= 3).
 */

/**
 * Computes the Rutovitz crossing number (topological degree) for a pixel.
 * Number of 0 -> 1 transitions in circular 8-neighborhood.
 */
function crossingNumber(skeleton, x, y, W, H) {
  const get = (nx, ny) => {
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) return 0;
    return skeleton[ny * W + nx] ? 1 : 0;
  };
  const p = [
    get(x, y - 1),
    get(x + 1, y - 1),
    get(x + 1, y),
    get(x + 1, y + 1),
    get(x, y + 1),
    get(x - 1, y + 1),
    get(x - 1, y),
    get(x - 1, y - 1),
  ];
  let trans = 0;
  for (let i = 0; i < 8; i++) {
    if (p[i] === 0 && p[(i + 1) % 8] === 1) trans++;
  }
  return trans;
}

/**
 * Computes topological degrees (Rutovitz crossing numbers) for all foreground pixels.
 * @param {Uint8Array} skeleton - Binary skeleton mask (0 = background, 1 = foreground)
 * @param {number} W - Width
 * @param {number} H - Height
 * @returns {Int16Array} Degree array
 */
function skeletonDegree(skeleton, W, H) {
  const degree = new Int16Array(W * H);
  for (let y = 0; y < H; y++) {
    const yw = y * W;
    for (let x = 0; x < W; x++) {
      const idx = yw + x;
      if (!skeleton[idx]) continue;
      degree[idx] = crossingNumber(skeleton, x, y, W, H);
    }
  }
  return degree;
}

/**
 * Extracts skeleton paths, classifying endpoints and junctions.
 * @param {Uint8Array} skeleton - Binary skeleton mask
 * @param {number} W - Width
 * @param {number} H - Height
 * @returns {Array<object>} Array of skeleton paths
 */
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

module.exports = { extractSkeletonPaths, skeletonDegree, crossingNumber };
