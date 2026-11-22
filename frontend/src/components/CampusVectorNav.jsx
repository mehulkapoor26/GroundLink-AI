import React, { useMemo, useRef, useState } from "react";
import {
  CHITKARA_SAMPLE_GRAPH,
  SCALE_CONFIG,
  advancePositionByMeters,
  cnnPatchWalkabilityScore,
  findShortestPath,
  mapCmToPixels,
  metersToMapCm,
  mlpRefineStepMeters,
  snapToNearestNode,
} from "../utils/navVectorGraph";

export default function CampusVectorNav() {
  const mapBoxRef = useRef(null);

  const [mapSrc, setMapSrc] = useState(SCALE_CONFIG.mapImageSrc);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [pixelsPerCm, setPixelsPerCm] = useState(SCALE_CONFIG.pixelsPerMapCm);

  const [graph, setGraph] = useState(CHITKARA_SAMPLE_GRAPH);
  const [startId, setStartId] = useState("gate_main");
  const [endId, setEndId] = useState("food_court");

  // Current position in map pixels (starts at startId node)
  const initialStart = CHITKARA_SAMPLE_GRAPH.nodes.gate_main || { x: 120, y: 620 };
  const [posPx, setPosPx] = useState({ x: initialStart.x, y: initialStart.y });
  const [trailPx, setTrailPx] = useState([{ x: initialStart.x, y: initialStart.y }]);

  // Vector movement controls (in real meters)
  const [dxMeters, setDxMeters] = useState(2);
  const [dyMeters, setDyMeters] = useState(0);
  const [headingDeg, setHeadingDeg] = useState(0);
  const [rawStepMeters, setRawStepMeters] = useState(1.5);
  const [useNnRefinement, setUseNnRefinement] = useState(true);

  // Add node mode
  const [addNodeMode, setAddNodeMode] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [connectFromId, setConnectFromId] = useState("carnegie_hall");

  const activeScaleConfig = useMemo(
    () => ({ ...SCALE_CONFIG, pixelsPerMapCm: Number(pixelsPerCm) || 37.795 }),
    [pixelsPerCm]
  );

  const routeInfo = useMemo(() => {
    const adj = {};
    Object.keys(graph.nodes).forEach((id) => (adj[id] = []));
    graph.edges.forEach(({ from, to }) => {
      const a = graph.nodes[from];
      const b = graph.nodes[to];
      if (!a || !b) return;
      const w = Math.hypot(b.x - a.x, b.y - a.y);
      adj[from].push({ to, weight: w });
      adj[to].push({ to: from, weight: w });
    });

    const dist = {};
    const prev = {};
    const q = new Set(Object.keys(graph.nodes));
    Object.keys(graph.nodes).forEach((id) => {
      dist[id] = Infinity;
      prev[id] = null;
    });
    if (!q.has(startId) || !q.has(endId)) {
      return { path: [], totalMeters: 0, totalMapCm: 0 };
    }
    dist[startId] = 0;

    while (q.size > 0) {
      let u = null;
      for (const id of q) {
        if (u === null || dist[id] < dist[u]) u = id;
      }
      if (u === null || dist[u] === Infinity || u === endId) break;
      q.delete(u);

      for (const edge of adj[u] || []) {
        if (!q.has(edge.to)) continue;
        const alt = dist[u] + edge.weight;
        if (alt < dist[edge.to]) {
          dist[edge.to] = alt;
          prev[edge.to] = u;
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
    const totalMapCm = totalPx / (Number(pixelsPerCm) || 37.795);
    const totalMeters = totalMapCm / SCALE_CONFIG.realMetersPerMapCm;
    return { path, totalMeters, totalMapCm };
  }, [graph, startId, endId, pixelsPerCm]);

  const nearestNode = useMemo(() => snapToNearestNode(graph, posPx), [graph, posPx]);

  const nnPreview = useMemo(() => {
    const cnnScore = cnnPatchWalkabilityScore([
      [0.85, 0.75, 0.8],
      [0.7, 0.9, 0.75],
    ]);
    return mlpRefineStepMeters(Number(rawStepMeters) || 0, Number(headingDeg) || 0, cnnScore);
  }, [rawStepMeters, headingDeg]);

  function applyVectorStep(stepDx, stepDy, stepLen = 0, deg = 0) {
    const pxFactor = Number(pixelsPerCm) || 37.795;
    let realDx = Number(stepDx) || 0;
    let realDy = Number(stepDy) || 0;

    if (stepLen !== 0) {
      const rad = ((Number(deg) || 0) * Math.PI) / 180;
      realDx += Number(stepLen) * Math.cos(rad);
      realDy += Number(stepLen) * Math.sin(rad);
    }

    const deltaCmX = metersToMapCm(realDx);
    const deltaCmY = metersToMapCm(realDy);
    const next = {
      x: Math.max(0, posPx.x + deltaCmX * pxFactor),
      y: Math.max(0, posPx.y + deltaCmY * pxFactor),
    };

    setPosPx(next);
    setTrailPx((prev) => [...prev, next]);
  }

  function handleApplyDxDy() {
    applyVectorStep(dxMeters, dyMeters, 0, headingDeg);
  }

  function handleApplyNnStep() {
    const effectiveMeters = useNnRefinement ? nnPreview.refinedMeters : Number(rawStepMeters) || 0;
    applyVectorStep(0, 0, effectiveMeters, headingDeg);
  }

  function handleMapClick(e) {
    if (!addNodeMode || !mapBoxRef.current) return;
    const rect = mapBoxRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const id = `node_${Date.now().toString().slice(-4)}`;
    const label = (newNodeLabel || id).trim();

    setGraph((prev) => {
      const nextNodes = {
        ...prev.nodes,
        [id]: { id, label, x, y },
      };
      const nextEdges = [...prev.edges];
      if (connectFromId && prev.nodes[connectFromId]) {
        nextEdges.push({ from: connectFromId, to: id });
      }
      return { nodes: nextNodes, edges: nextEdges };
    });

    setNewNodeLabel("");
    setAddNodeMode(false);
  }

  function resetToStart() {
    const startNode = graph.nodes[startId];
    if (!startNode) return;
    const p = { x: startNode.x, y: startNode.y };
    setPosPx(p);
    setTrailPx([p]);
  }

  const nodeList = Object.values(graph.nodes);

  return (
    <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12, marginTop: 16 }}>
      <h3>Offline Campus Navigation (1m = 1cm Scale + Graph + CNN/NN)</h3>
      <p style={{ fontSize: 13, opacity: 0.85 }}>
        Scale: <strong>1m real life = 1cm on map</strong> ({metersToMapCm(1)} cm ={" "}
        {Math.round(mapCmToPixels(1))} px/cm). Existing attendance, chat & voice notes untouched.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <label>
          Map Image Path:{" "}
          <input
            value={mapSrc}
            onChange={(e) => {
              setMapLoaded(false);
              setMapSrc(e.target.value);
            }}
            style={{ width: 240 }}
          />
        </label>

        <label>
          Pixels per 1cm:{" "}
          <input
            type="number"
            step="0.1"
            value={pixelsPerCm}
            onChange={(e) => setPixelsPerCm(e.target.value)}
            style={{ width: 90 }}
          />
        </label>

        <label>
          Start Node:{" "}
          <select value={startId} onChange={(e) => setStartId(e.target.value)}>
            {nodeList.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          End Node:{" "}
          <select value={endId} onChange={(e) => setEndId(e.target.value)}>
            {nodeList.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </label>

        <button onClick={resetToStart}>Reset Pos to Start</button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <label>
          ΔX (meters):{" "}
          <input
            type="number"
            step="0.5"
            value={dxMeters}
            onChange={(e) => setDxMeters(e.target.value)}
            style={{ width: 75 }}
          />
        </label>
        <label>
          ΔY (meters):{" "}
          <input
            type="number"
            step="0.5"
            value={dyMeters}
            onChange={(e) => setDyMeters(e.target.value)}
            style={{ width: 75 }}
          />
        </label>
        <button onClick={handleApplyDxDy}>Move Vector (ΔX, ΔY)</button>

        <label>
          Heading (deg):{" "}
          <input
            type="number"
            step="5"
            value={headingDeg}
            onChange={(e) => setHeadingDeg(e.target.value)}
            style={{ width: 75 }}
          />
        </label>
        <label>
          Raw Step (m):{" "}
          <input
            type="number"
            step="0.1"
            value={rawStepMeters}
            onChange={(e) => setRawStepMeters(e.target.value)}
            style={{ width: 75 }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={useNnRefinement}
            onChange={(e) => setUseNnRefinement(e.target.checked)}
          />{" "}
          Use CNN + NN Step ({nnPreview.refinedMeters.toFixed(2)}m)
        </label>
        <button onClick={handleApplyNnStep}>Apply Step + Heading</button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <input
          placeholder="New node name (e.g. Gate 2)"
          value={newNodeLabel}
          onChange={(e) => setNewNodeLabel(e.target.value)}
        />
        <select value={connectFromId} onChange={(e) => setConnectFromId(e.target.value)}>
          <option value="">No auto-edge</option>
          {nodeList.map((n) => (
            <option key={n.id} value={n.id}>
              Connect from: {n.label}
            </option>
          ))}
        </select>
        <button onClick={() => setAddNodeMode((v) => !v)}>
          {addNodeMode ? "Click Map Now..." : "+ Add Graph Node on Map"}
        </button>
      </div>

      <div style={{ fontSize: 13, marginBottom: 12 }}>
        <strong>Shortest Path:</strong>{" "}
        {routeInfo.path.map((id) => graph.nodes[id]?.label || id).join(" → ") || "No path"} |{" "}
        <strong>Distance:</strong> {routeInfo.totalMeters.toFixed(2)} m ({routeInfo.totalMapCm.toFixed(2)} cm on map) |{" "}
        <strong>Nearest Node:</strong> {nearestNode.node?.label || "-"} ({nearestNode.distanceMeters.toFixed(2)} m) |{" "}
        <strong>CNN Walkability Score:</strong> {nnPreview.cnnScore.toFixed(3)}
      </div>

      <div
        ref={mapBoxRef}
        onClick={handleMapClick}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 860,
          height: 520,
          overflow: "auto",
          border: "1px dashed #64748b",
          borderRadius: 10,
          backgroundColor: "#0f172a",
          cursor: addNodeMode ? "crosshair" : "default",
        }}
      >
        <img
          src={mapSrc}
          alt="Campus Map"
          onLoad={() => setMapLoaded(true)}
          onError={() => setMapLoaded(false)}
          style={{
            display: mapLoaded ? "block" : "none",
            maxWidth: "none",
          }}
        />
        {!mapLoaded && (
          <div style={{ padding: 20, color: "#94a3b8", fontSize: 13 }}>
            Map image not loaded yet at <code>{mapSrc}</code>. Place your Chitkara map image in{" "}
            <code>frontend/public/maps/chitkara-campus-map.png</code> (or update path above). Graph &
            vector markers are still active below.
          </div>
        )}

        <svg
          width="860"
          height="520"
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        >
          {graph.edges.map((e, idx) => {
            const a = graph.nodes[e.from];
            const b = graph.nodes[e.to];
            if (!a || !b) return null;
            const onRoute =
              routeInfo.path.includes(e.from) &&
              routeInfo.path.includes(e.to) &&
              Math.abs(routeInfo.path.indexOf(e.from) - routeInfo.path.indexOf(e.to)) === 1;
            return (
              <line
                key={`${e.from}-${e.to}-${idx}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={onRoute ? "#22c55e" : "#475569"}
                strokeWidth={onRoute ? 4 : 2}
              />
            );
          })}

          {trailPx.length > 1 && (
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeDasharray="4 3"
              points={trailPx.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          )}

          {nodeList.map((n) => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={6} fill="#f59e0b" />
              <text x={n.x + 9} y={n.y + 4} fill="#f8fafc" fontSize="12">
                {n.label}
              </text>
            </g>
          ))}

          <circle cx={posPx.x} cy={posPx.y} r={8} fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
