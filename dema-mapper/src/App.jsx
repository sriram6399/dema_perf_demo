import React, { useEffect, useMemo, useRef, useState } from "react";

/** ---------- Helpers ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const median = (a) => {
  if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y);
  const m = Math.floor(b.length / 2);
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};
const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

/** ---------- Activities ---------- */
const ACT = {
  IDLE: "IDLE",
  PANNING: "PANNING",
  ZOOMING: "ZOOMING",
  DRAGGING: "DRAGGING",
  SELECTING: "SELECTING",
};

/** ---------- Component ---------- */
const TopologicalGraphPerfHarness = () => {
  /** Config — keep spread large like earlier code */
  const TOTAL_NODES = 50000;    // change to 25000 / 50000 to stress more
  const TOTAL_EDGES = 2000;
  const SPREAD = 20000;         // ensures wide spread

  /** Graph state */
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [sortedNodes, setSortedNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  /** Camera (pan/zoom) */
  const [cam, setCam] = useState({ x: 0, y: 0, scale: 1 });
  const svgRef = useRef(null);
  const panRef = useRef({ active: false, lastX: 0, lastY: 0 });

  /** Interaction counters */
  const [panOps, setPanOps] = useState(0);
  const [zoomOps, setZoomOps] = useState(0);
  const [nodeClicks, setNodeClicks] = useState(0);
  const [nodeDragSessions, setNodeDragSessions] = useState(0);

  /** Session & report */
  const sessionStart = useRef(performance.now());
  const [sessionEnded, setSessionEnded] = useState(false);
  const [reportText, setReportText] = useState("");

  /** Activity buckets */
  const activityRef = useRef(ACT.IDLE);
  const perActivity = useRef({
    [ACT.IDLE]:     { fps: [], mem: [], render: [] },
    [ACT.PANNING]:  { fps: [], mem: [], render: [] },
    [ACT.ZOOMING]:  { fps: [], mem: [], render: [] },
    [ACT.DRAGGING]: { fps: [], mem: [], render: [] },
    [ACT.SELECTING]:{ fps: [], mem: [], render: [] },
  });

  /** Database-like timings (generation & transform) */
  const queryTimeRef = useRef(0);
  const transformTimeRef = useRef(0);
  const totalLoadTimeRef = useRef(0);

  /** Render performance (per state-driven paint) */
  const renderStatsRef = useRef({ count: 0, sum: 0, max: 0 });

  /** FPS & frame time sampling */
  const rafId = useRef(null);
  const lastFrameTs = useRef(performance.now());
  const lastBucketTs = useRef(performance.now());
  const framesInBucket = useRef(0);
  const fpsSamples = useRef([]);     // per-second FPS
  const frameTimes = useRef([]);     // per-frame ms

  /** Memory sampling */
  const memSamples = useRef([]);
  const memTimer = useRef(null);

  /** Efficient node lookup for edge rendering */
  const nodeMap = useMemo(() => {
    const m = new Map();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  /** Helper: record a render sample attributed to an activity */
  const sampleRender = (activity) => {
    const start = performance.now();
    requestAnimationFrame(() => {
      const dur = performance.now() - start;
      const s = renderStatsRef.current;
      s.count += 1;
      s.sum += dur;
      if (dur > s.max) s.max = dur;
      perActivity.current[activity].render.push(dur);
    });
  };

  /** ---------- Data generation & topo sort ---------- */
  useEffect(() => {
    const t0 = performance.now();

    // "Query": generate nodes
    const newNodes = Array.from({ length: TOTAL_NODES }, (_, i) => ({
      id: String(i + 1),
      x: Math.random() * SPREAD,
      y: Math.random() * SPREAD,
    }));
    const tQueryEnd = performance.now();
    queryTimeRef.current = tQueryEnd - t0;

    // "Transform": create edges
    const newEdges = [];
    for (let i = 0; i < TOTAL_EDGES; i++) {
      const s = Math.ceil(Math.random() * TOTAL_NODES);
      let t = Math.ceil(Math.random() * TOTAL_NODES);
      while (t === s) t = Math.ceil(Math.random() * TOTAL_NODES);
      newEdges.push({ source: String(s), target: String(t) });
    }
    const tTransformEnd = performance.now();
    transformTimeRef.current = tTransformEnd - tQueryEnd;
    totalLoadTimeRef.current = tTransformEnd - t0;

    setNodes(newNodes);
    setEdges(newEdges);
  }, []); // once

  useEffect(() => {
    if (!nodes.length || !edges.length) return;

    const t0 = performance.now();

    const graph = new Map();
    const inDeg = new Map();
    nodes.forEach((n) => {
      graph.set(n.id, []);
      inDeg.set(n.id, 0);
    });
    edges.forEach((e) => {
      graph.get(e.source)?.push(e.target);
      inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
    });

    const q = [];
    inDeg.forEach((deg, id) => { if (deg === 0) q.push(id); });

    const sorted = [];
    while (q.length) {
      const cur = q.shift();
      sorted.push(cur);
      for (const nxt of graph.get(cur)) {
        inDeg.set(nxt, inDeg.get(nxt) - 1);
        if (inDeg.get(nxt) === 0) q.push(nxt);
      }
    }

    const allSorted = [
      ...sorted,
      ...nodes.map((n) => n.id).filter((id) => !sorted.includes(id)),
    ];
    setSortedNodes(allSorted);

    // attribute this initial compute+render as IDLE render sample
    const t1 = performance.now();
    const dur = t1 - t0;
    const s = renderStatsRef.current;
    s.count += 1;
    s.sum += dur;
    if (dur > s.max) s.max = dur;
    perActivity.current[ACT.IDLE].render.push(dur);

    setLoading(false);
  }, [nodes, edges]);

  /** ---------- FPS + Memory sampling ---------- */
  useEffect(() => {
    function onRaf(now) {
      const dt = now - lastFrameTs.current;
      lastFrameTs.current = now;

      // ignore absurdly huge dt (tab inactive etc.)
      if (dt > 0 && dt < 1000) frameTimes.current.push(dt);

      // per-second FPS bucket
      framesInBucket.current += 1;
      const bucketDt = now - lastBucketTs.current;
      if (bucketDt >= 1000) {
        const fps = (framesInBucket.current * 1000) / bucketDt;
        fpsSamples.current.push(fps);

        // attribute FPS & memory to current activity
        perActivity.current[activityRef.current].fps.push(fps);
        if (performance.memory) {
          perActivity.current[activityRef.current].mem.push(
            performance.memory.usedJSHeapSize / 1024 / 1024
          );
        }

        framesInBucket.current = 0;
        lastBucketTs.current = now;
      }

      rafId.current = requestAnimationFrame(onRaf);
    }

    rafId.current = requestAnimationFrame(onRaf);

    if (performance.memory) {
      memTimer.current = setInterval(() => {
        memSamples.current.push(performance.memory.usedJSHeapSize / 1024 / 1024);
      }, 1000);
    }

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (memTimer.current) clearInterval(memTimer.current);
    };
  }, []);

  /** ---------- Interactions ---------- */
  // Background mousedown => begin panning
  const onBackgroundMouseDown = (e) => {
    if (e.target === svgRef.current) {
      activityRef.current = ACT.PANNING;
      setPanOps((n) => n + 1);
      panRef.current.active = true;
      panRef.current.lastX = e.clientX;
      panRef.current.lastY = e.clientY;

      window.addEventListener("mousemove", onPanMove);
      window.addEventListener("mouseup", onPanUp);
    }
  };

  const onPanMove = (e) => {
    if (!panRef.current.active) return;
    const dx = e.clientX - panRef.current.lastX;
    const dy = e.clientY - panRef.current.lastY;
    panRef.current.lastX = e.clientX;
    panRef.current.lastY = e.clientY;

    // camera pan
    setCam((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
    sampleRender(ACT.PANNING);
  };

  const onPanUp = () => {
    panRef.current.active = false;
    activityRef.current = ACT.IDLE;
    window.removeEventListener("mousemove", onPanMove);
    window.removeEventListener("mouseup", onPanUp);
  };

  const onWheel = (e) => {
    activityRef.current = ACT.ZOOMING;
    setZoomOps((n) => n + 1);

    const delta = -e.deltaY;
    const factor = Math.exp(delta * 0.001);
    setCam((c) => ({ ...c, scale: clamp(c.scale * factor, 0.05, 10) }));
    sampleRender(ACT.ZOOMING);

    // back to idle after short delay
    clearTimeout(onWheel._t);
    onWheel._t = setTimeout(() => (activityRef.current = ACT.IDLE), 300);
  };

  const onNodeMouseDown = (id) => (e) => {
    // Start a drag session (we’ll call it DRAGGING while moving; SELECTING if no move)
    let moved = false;
    activityRef.current = ACT.DRAGGING;
    setNodeDragSessions((n) => n + 1);

    const move = (ev) => {
      moved = true;
      // move node in graph-space (account for zoom)
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, x: n.x + ev.movementX / cam.scale, y: n.y + ev.movementY / cam.scale }
            : n
        )
      );
      sampleRender(ACT.DRAGGING);
    };

    const up = (ev) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);

      if (!moved) {
        activityRef.current = ACT.SELECTING;
        setNodeClicks((n) => n + 1);
        // brief render attribution
        sampleRender(ACT.SELECTING);
        setTimeout(() => (activityRef.current = ACT.IDLE), 150);
      } else {
        activityRef.current = ACT.IDLE;
      }
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const addNode = () => {
    const newId = String(nodes.length + 1);
    const target = sortedNodes[Math.floor(Math.random() * Math.max(sortedNodes.length, 1))] || "1";
    const newNode = { id: newId, x: Math.random() * SPREAD, y: Math.random() * SPREAD };

    setNodes((prev) => [...prev, newNode]);
    setEdges((prev) => [...prev, { source: newId, target }]);
    sampleRender(activityRef.current); // attribute to current context
  };

  /** ---------- Report ---------- */
  const buildReport = () => {
    const sessionMs = performance.now() - sessionStart.current;

    // FPS & frame times
    const fpsArr = fpsSamples.current;
    const avgFps = avg(fpsArr);
    const medFps = median(fpsArr);
    const minFps = fpsArr.length ? Math.min(...fpsArr) : 0;
    const maxFps = fpsArr.length ? Math.max(...fpsArr) : 0;
    const avgFrameTime = avg(frameTimes.current); // ms

    // Frame drops vs 60FPS
    const dropPercents = fpsArr.map((f) => Math.max(0, 1 - f / 60));
    const avgFrameDrops = avg(dropPercents) * 100;

    // Memory
    const mem = memSamples.current.length ? memSamples.current : [0];
    const memAvg = avg(mem);
    const memMin = Math.min(...mem);
    const memMax = Math.max(...mem);
    const memGrowth = memMax - memMin;

    // Interactions
    const totalInteractions = panOps + zoomOps + nodeClicks + nodeDragSessions;
    const interactionsPerMin = totalInteractions / (sessionMs / 60000);

    // Render performance accumulated
    const { count, sum, max } = renderStatsRef.current;
    const renderAvg = count ? sum / count : 0;

    // Helper for “Performance by Activity” lines
    const actLine = (label, bucket) => {
      const fps = bucket.fps;
      const fpsAvg = avg(fps);
      const fpsMin = fps.length ? Math.min(...fps) : 0;
      const fpsMax = fps.length ? Math.max(...fps) : 0;
      const memA = bucket.mem.length ? avg(bucket.mem) : memAvg;
      const rendA = bucket.render.length ? avg(bucket.render) : renderAvg;
      const samples = fps.length;
      const range = samples ? `(${fmt2(fpsMin)}-${fmt2(fpsMax)})` : "No data collected";
      return `  ${label.padEnd(8)}: ${samples ? fmt2(fpsAvg) + " FPS " + range : range} | ${samples || 0} samples | Avg Memory: ${fmt2(memA)}MB | Avg Render: ${fmt2(rendA)}ms`;
    };

    // Verdicts
    const verdicts = [];
    if (avgFps >= 50 && avgFrameDrops < 5) verdicts.push("EXCELLENT - Suitable for production use");
    else if (avgFps >= 30) verdicts.push("ACCEPTABLE - May need optimization for some users");
    else verdicts.push("POOR - Optimization required");

    if (memMax <= 80) verdicts.push("MEMORY EFFICIENT - Low memory footprint");
    if (avgFps < 40) verdicts.push("IDLE PERFORMANCE - Consider reducing background processing");
    if (perActivity.current[ACT.ZOOMING].fps.length && avg(perActivity.current[ACT.ZOOMING].fps) < 30)
      verdicts.push("ZOOM PERFORMANCE - Consider level-of-detail rendering");

    const report = [
      "============================================================",
      "PERFORMANCE REPORT",
      "============================================================",
      `Session Duration: ${fmt2(sessionMs / 1000)}s`,
      `Node Count: ${nodes.length.toLocaleString()}`,
      "",
      "DATABASE PERFORMANCE:",
      `  Query Time: ${fmt2(queryTimeRef.current)}ms`,
      `  Transform Time: ${fmt2(transformTimeRef.current)}ms`,
      `  Total Load Time: ${fmt2(totalLoadTimeRef.current)}ms`,
      "",
      "FRAME RATE ANALYSIS (Performance Observer):",
      `  Average FPS: ${fmt2(avgFps)}`,
      `  Median FPS: ${fmt2(medFps)}`,
      `  Min FPS: ${fmt2(minFps)}`,
      `  Max FPS: ${fmt2(maxFps)}`,
      `  Samples Collected: ${fpsArr.length}`,
      `  Average Frame Drops: ${fmt2(avgFrameDrops)}%`,
      `  Average Render Time: ${fmt2(avgFrameTime)}ms`,
      `  Excellent (≥60 FPS): ${fmt2((fpsArr.filter((f) => f >= 60).length / (fpsArr.length || 1)) * 100)}%`,
      `  Good (30-59 FPS): ${fmt2((fpsArr.filter((f) => f >= 30 && f < 60).length / (fpsArr.length || 1)) * 100)}%`,
      `  Poor (<30 FPS): ${fmt2((fpsArr.filter((f) => f < 30).length / (fpsArr.length || 1)) * 100)}%`,
      avgFrameDrops > 15
        ? "  HIGH FRAME DROPS - Severe performance issues detected"
        : avgFrameDrops > 7
        ? "  MODERATE FRAME DROPS - Noticeable performance impact"
        : "  LOW FRAME DROPS - Minor performance impact",
      "",
      "MEMORY USAGE ANALYSIS:",
      `  Average Memory: ${fmt2(memAvg)}MB`,
      `  Peak Memory: ${fmt2(memMax)}MB`,
      `  Min Memory: ${fmt2(memMin)}MB`,
      `  Memory Growth: ${fmt2(memGrowth)}MB`,
      "",
      "RENDER PERFORMANCE:",
      `  Average Render Time: ${fmt2(renderAvg)}ms`,
      `  Max Render Time: ${fmt2(max)}ms`,
      `  Render Samples: ${count}`,
      "",
      "USER INTERACTIONS:",
      `  Pan Operations: ${panOps}`,
      `  Zoom Operations: ${zoomOps}`,
      `  Node Clicks: ${nodeClicks}`,
      `  Node Drag Sessions: ${nodeDragSessions}`,
      `  Total Interactions: ${totalInteractions}`,
      `  Interactions/Minute: ${fmt2(interactionsPerMin)}`,
      "",
      "PERFORMANCE BY ACTIVITY:",
      actLine("IDLE",      perActivity.current[ACT.IDLE]),
      actLine("PANNING",   perActivity.current[ACT.PANNING]),
      actLine("ZOOMING",   perActivity.current[ACT.ZOOMING]),
      actLine("DRAGGING",  perActivity.current[ACT.DRAGGING]),
      actLine("SELECTING", perActivity.current[ACT.SELECTING]),
      "",
      "PERFORMANCE VERDICT:",
      ...verdicts.map((v) => `  ${v}`),
      "============================================================",
    ].join("\n");

    return report;
  };

  const endSession = () => {
    if (sessionEnded) return;
    setSessionEnded(true);

    if (rafId.current) cancelAnimationFrame(rafId.current);
    if (memTimer.current) clearInterval(memTimer.current);

    const text = buildReport();
    setReportText(text);
    // eslint-disable-next-line no-console
    console.log(text);
  };

  // Auto-report on unmount if not already ended
  useEffect(() => {
    return () => {
      if (!sessionEnded) {
        if (rafId.current) cancelAnimationFrame(rafId.current);
        if (memTimer.current) clearInterval(memTimer.current);
        const text = buildReport();
        // eslint-disable-next-line no-console
        console.log(text);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEnded]);

  /** ---------- Render ---------- */
  const viewTransform = `translate(${cam.x}, ${cam.y}) scale(${cam.scale})`;

  return (
    <div style={{ padding: "12px", color: "#eee", background: "#0b0b0b", minHeight: "100vh" }}>
      <h2 style={{ margin: 0 }}>React Graph Performance Harness (SVG)</h2>
      {loading && <p style={{ color: "orange" }}>Loading graph data…</p>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
        <button onClick={addNode}>Add Node</button>
        <button onClick={() => setCam({ x: 0, y: 0, scale: 1 })}>Reset View</button>
        <button onClick={endSession} style={{ background: "#222", color: "#0f0" }}>
          End Session & Print Report
        </button>
        <span style={{ opacity: 0.7 }}>
          (Pan: drag empty space · Zoom: mouse wheel · Drag nodes: grab a circle)
        </span>
      </div>

      {/* Big SVG space, like the earlier code. One unit ≈ one pixel. */}
      <svg
        ref={svgRef}
        width={SPREAD}
        height={SPREAD}
        style={{ background: "#111", border: "1px solid #333" }}
        onMouseDown={onBackgroundMouseDown}
        onWheel={onWheel}
      >
        <g transform={viewTransform}>
          {/* Edges */}
          {edges.map((e, i) => {
            const s = nodeMap.get(e.source);
            const t = nodeMap.get(e.target);
            if (!s || !t) return null;
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke="#888"
                strokeWidth="1"
              />
            );
          })}
          {/* Nodes */}
          {nodes.map((n) => (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}>
              <circle
                r={6}
                fill="#3b82f6"
                onMouseDown={onNodeMouseDown(n.id)}
                style={{ cursor: "pointer" }}
              />
              <text x={10} y={4} fontSize={10} fill="#fff">{n.id}</text>
            </g>
          ))}
        </g>
      </svg>

      {reportText && (
        <pre
          style={{
            marginTop: 16,
            background: "#0f0f0f",
            color: "#ddd",
            padding: 12,
            whiteSpace: "pre-wrap",
            border: "1px solid #222",
          }}
        >
{reportText}
        </pre>
      )}
    </div>
  );
};

export default TopologicalGraphPerfHarness;
