// Offline Vector Maths + Graph Pathfinding + Lightweight Neural/CNN Hook
// Scale rule: 1 meter real-world distance = 1 cm on map.
// Pixel conversion defaults to 37.795 px/cm (96 DPI standard) and can be calibrated.

export const SCALE_CONFIG = {
  realMetersPerMapCm: 1, // 1m real life = 1cm on map
  pixelsPerMapCm: 37.79527559, // 1cm = ~37.8px at 96 DPI (adjust to your map image)
  mapImageSrc: "/maps/chitkara-campus-map.png", // Put Chitkara map image in frontend/public/maps/
};

export function metersToMapCm(meters) {
  return Number(meters) * SCALE_CONFIG.realMetersPerMapCm;
}

export function mapCmToPixels(cm) {
  return Number(cm) * SCALE_CONFIG.pixelsPerMapCm;
}

export function pixelsToMapCm(px) {
  return Number(px) / SCALE_CONFIG.pixelsPerMapCm;
}

export function mapCmToMeters(cm) {
  return Number(cm) / SCALE_CONFIG.realMetersPerMapCm;
}

// 2D Vector operations (in map pixels or real meters)
export function addVec(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subVec(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scaleVec(v, s) {
  return { x: v.x * s, y: v.y * s };
}

export function normVec(v) {
  return Math.hypot(v.x, v.y);
}

// Move a map position (in pixels) by real-world displacement (dxMeters, dyMeters, headingDeg)
export function advancePositionByMeters(
  currentPxPos,
  { dxMeters = 0, dyMeters = 0, headingDeg = 0, stepMeters = 0 } = {}
) {
  let realDx = dxMeters;
  let realDy = dyMeters;

  if (stepMeters !== 0) {
    const rad = (headingDeg * Math.PI) / 180;
    realDx += stepMeters * Math.cos(rad);
    realDy += stepMeters * Math.sin(rad);
  }

  const deltaMapCm = {
    x: metersToMapCm(realDx),
    y: metersToMapCm(realDy),
  };

  const deltaPx = {
    x: mapCmToPixels(deltaMapCm.x),
    y: mapCmToPixels(deltaMapCm.y),
  };

  return {
    nextPxPos: addVec(currentPxPos, deltaPx),
    deltaMapCm,
    deltaPx,
    realDisplacementMeters: Math.hypot(realDx, realDy),
    mapDisplacementCm: Math.hypot(deltaMapCm.x, deltaMapCm.y),
  };
}

// Sample Chitkara campus graph (x, y in map pixels; update coordinates to match your map image)
export const CHITKARA_SAMPLE_GRAPH = {
  nodes: {
    gate_main: { id: "gate_main", label: "Main Gate", x: 120, y: 620 },
    turing_block: { id: "turing_block", label: "Turing Block", x: 310, y: 470 },
    carnegie_hall: { id: "carnegie_hall", label: "Carnegie Hall", x: 520, y: 390 },
    library_hub: { id: "library_hub", label: "Central Library", x: 460, y: 230 },
    food_court: { id: "food_court", label: "Square One / Food Zone", x: 710, y: 280 },
  },
  edges: [
    { from: "gate_main", to: "turing_block" },
    { from: "turing_block", to: "carnegie_hall" },
    { from: "turing_block", to: "library_hub" },
    { from: "carnegie_hall", to: "library_hub" },
    { from: "carnegie_hall", to: "food_court" },
    { from: "library_hub", to: "food_court" },
  ],
};

function buildAdjacency(graph) {
  const adj = {};
  Object.keys(graph.nodes).forEach((id) => {
    adj[id] = [];
  });

  graph.edges.forEach(({ from, to, weight }) => {
    const a = graph.nodes[from];
    const b = graph.nodes[to];
    if (!a || !b) return;
    const distPx = Math.hypot(b.x - a.x, b.y - a.y);
    const edgeWeight = typeof weight === "number" ? weight : distPx;
    adj[from].push({ to, weight: edgeWeight, distPx });
    adj[to].push({ to: from, weight: edgeWeight, distPx });
  });

  return adj;
}

export function findShortestPath(graph, startId, endId) {
  const adj = buildAdjacency(graph);
  const dist = {};
  const prev = {};
  const unvisited = new Set(Object.keys(graph.nodes));

  Object.keys(graph.nodes).forEach((id) => {
    dist[id] = Infinity;
    prev[id] = null;
  });
  if (!unvisited.has(startId) || !unvisited.has(endId)) {
    return { path: [], totalMeters: 0, totalMapCm: 0 };
  }
  dist[startId] = 0;

  while (unvisited.size > 0) {
    let curr = null;
    for (const node of unvisited) {
      if (curr === null || dist[node] < dist[curr]) {
        curr = node;
      }
    }
    if (curr === null || dist[curr] === Infinity || curr === endId) break;
    unvisited.delete(curr);

    for (const neighbor of adj[curr] || []) {
      if (!unvisited.has(neighbor.to)) continue;
      const alt = dist[curr] + neighbor.weight;
      if (alt < dist[neighbor.to]) {
        dist[neighbor.to] = alt;
        prev[neighbor.to] = curr;
      }
    }
  }

  const path = [];
  let curr = endId;
  while (curr) {
    path.unshift(curr);
    curr = prev[curr];
  }

  let totalPx = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = graph.nodes[path[i]];
    const b = graph.nodes[path[i + 1]];
    totalPx += Math.hypot(b.x - a.x, b.y - a.y);
  }

  const totalMapCm = pixelsToMapCm(totalPx);
  const totalMeters = mapCmToMeters(totalMapCm);

  return { path, totalPx, totalMapCm, totalMeters };
}

export function snapToNearestNode(graph, pxPos) {
  let bestId = null;
  let bestDistPx = Infinity;

  Object.values(graph.nodes).forEach((node) => {
    const d = Math.hypot(node.x - pxPos.x, node.y - pxPos.y);
    if (d < bestDistPx) {
      bestDistPx = d;
      bestId = node.id;
    }
  });

  return {
    nodeId: bestId,
    node: bestId ? graph.nodes[bestId] : null,
    distancePx: bestDistPx,
    distanceMeters: mapCmToMeters(pixelsToMapCm(bestDistPx)),
  };
}

// Lightweight Neural Network (MLP) + CNN-style 2D patch pooling helper
// Works offline with zero external ML dependencies; ready to swap with trained weights.
export function cnnPatchWalkabilityScore(grayGrid2D) {
  if (!Array.isArray(grayGrid2D) || grayGrid2D.length === 0) return 0.5;
  let sum = 0;
  let count = 0;
  for (let r = 0; r < grayGrid2D.length; r++) {
    for (let c = 0; c < grayGrid2D[r].length; c++) {
      sum += Number(grayGrid2D[r][c]) || 0;
      count++;
    }
  }
  const meanIntensity = count > 0 ? sum / count : 0.5;
  // Sigmoid activation over normalized feature
  const z = (meanIntensity - 0.5) * 2.0;
  return 1 / (1 + Math.exp(-z));
}

export function mlpRefineStepMeters(rawStepMeters, headingDeg, cnnScore = 0.5) {
  const rad = (headingDeg * Math.PI) / 180;
  const h1 = Math.tanh(0.8 * rawStepMeters + 0.2 * cnnScore - 0.1);
  const h2 = Math.tanh(0.5 * Math.cos(rad) + 0.5 * Math.sin(rad));
  const refinementFactor = 1 + 0.08 * h1 + 0.02 * h2;
  const refinedMeters = Math.max(0, rawStepMeters * refinementFactor);

  return {
    refinedMeters,
    refinementFactor,
    cnnScore,
  };
}
