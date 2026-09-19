/**
 * R2: Junction Resolution & Continuous Stroke Assembly in pure JS.
 * Pairs incident branches at junctions by cosine continuity of outward tangents.
 * Port of whiteboard_animator/skeleton_paths.py
 */

/**
 * Returns path core coordinates oriented according to traversal direction.
 * @param {object} path - SkeletonPath
 * @param {boolean} fromStart - Whether entering/leaving from start
 * @returns {Array<{x: number, y: number}>}
 */
function orientedCore(path, fromStart) {
  const coords = path.core && path.core.length ? path.core : path.coords;
  return fromStart ? coords.slice() : coords.slice().reverse();
}

/**
 * Computes unit outward tangent vector pointing away from a node into the branch.
 * @param {object} path - SkeletonPath
 * @param {boolean} fromStart - If true, vector points from path.start along path; if false, from path.end inwards
 * @returns {{x: number, y: number}}
 */
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

/**
 * Pairs incident branches at each junction node by cosine continuity (R2).
 * @param {Array<object>} paths - Array of SkeletonPath
 * @returns {{pairings: Map<string, object>, tokenKey: Function}}
 */
function pairJunctionBranches(paths) {
  // Map node -> list of tokens { pathIndex, fromStart }
  const incident = new Map();
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (p.startNode !== null && p.startNode !== undefined) {
      if (!incident.has(p.startNode)) incident.set(p.startNode, []);
      incident.get(p.startNode).push({ pathIndex: i, fromStart: true });
    }
    if (p.endNode !== null && p.endNode !== undefined) {
      if (!incident.has(p.endNode)) incident.set(p.endNode, []);
      incident.get(p.endNode).push({ pathIndex: i, fromStart: false });
    }
  }

  const tokenKey = (t) => `${t.pathIndex}:${t.fromStart}`;
  const pairings = new Map(); // tokenKey -> token

  for (const tokens of incident.values()) {
    const available = new Set(tokens.map(tokenKey));
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

/**
 * Builds continuous line art strokes by chaining paths through paired junctions.
 * @param {Array<object>} paths - Array of SkeletonPath
 * @param {Float32Array|null} distMap - Chamfer distance transform map
 * @param {number} W - Width of the image
 * @returns {Array<{waypoints: Array<{x: number, y: number, r: number}>, weight: number}>}
 */
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
        const radius = (distMap && W) ? (distMap[p.y * W + p.x] || 1.5) : 1.5;
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

  // Sort starts by: natural endpoint first, then y, then x
  startTokens.sort((a, b) => {
    const pA = validPaths[a.pathIndex];
    const pB = validPaths[b.pathIndex];
    const epA = a.fromStart ? pA.startIsEndpoint : pA.endIsEndpoint;
    const epB = b.fromStart ? pB.startIsEndpoint : pB.endIsEndpoint;
    if (epA !== epB) return epA ? -1 : 1;
    const ptA = a.fromStart ? pA.start : pA.end;
    const ptB = b.fromStart ? pB.start : pB.end;
    const ay = ptA ? ptA.y : 0;
    const by = ptB ? ptB.y : 0;
    const ax = ptA ? ptA.x : 0;
    const bx = ptB ? ptB.x : 0;
    return (ay - by) || (ax - bx);
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
