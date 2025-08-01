import React, { useState, useEffect, useRef } from 'react';

const TopologicalGraphUI = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [sortedNodes, setSortedNodes] = useState([]);
  const [readTime, setReadTime] = useState(0);
  const [renderTime, setRenderTime] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(null);
  const [dragTime, setDragTime] = useState(0);
  const [loading, setLoading] = useState(true);

  const startDragTime = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const totalNodes = 50000;
    const totalEdges = 10000;
    const spreadFactor = 20000;
    const newNodes = Array.from({ length: totalNodes }, (_, i) => ({
      id: (i + 1).toString(),
      x: Math.random() * spreadFactor,
      y: Math.random() * spreadFactor
    }));

    const newEdges = [];
    for (let i = 0; i < totalEdges; i++) {
      const source = Math.ceil(Math.random() * totalNodes);
      let target = Math.ceil(Math.random() * totalNodes);
      while (target === source) {
        target = Math.ceil(Math.random() * totalNodes);
      }
      newEdges.push({ source: source.toString(), target: target.toString() });
    }

    setNodes(newNodes);
    setEdges(newEdges);
    const end = performance.now();
    setReadTime(end - start);
  }, []);

  useEffect(() => {
    if (!nodes.length || !edges.length) return;
    const start = performance.now();

    const graph = new Map();
    const inDegree = new Map();

    nodes.forEach(n => {
      graph.set(n.id, []);
      inDegree.set(n.id, 0);
    });

    edges.forEach(e => {
      graph.get(e.source)?.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    });

    const queue = [];
    inDegree.forEach((deg, node) => {
      if (deg === 0) queue.push(node);
    });

    const sorted = [];
    while (queue.length) {
      const curr = queue.shift();
      sorted.push(curr);
      graph.get(curr).forEach(neigh => {
        inDegree.set(neigh, inDegree.get(neigh) - 1);
        if (inDegree.get(neigh) === 0) queue.push(neigh);
      });
    }

    const allSorted = [
      ...sorted,
      ...nodes.map(n => n.id).filter(id => !sorted.includes(id))
    ];

    setSortedNodes(allSorted);
    const end = performance.now();
    setRenderTime(end - start);
    setLoading(false);

    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize / 1024 / 1024;
      setMemoryUsage(used.toFixed(2));
    }
  }, [nodes, edges]);

  const addNode = () => {
    const newId = (nodes.length + 1).toString();
    const randomTarget = sortedNodes[Math.floor(Math.random() * sortedNodes.length)];
    const spreadFactor = 20000;
    const newNode = { id: newId, x: Math.random() * spreadFactor, y: Math.random() * spreadFactor };
    const newEdge = { source: newId, target: randomTarget };
    setNodes(prev => [...prev, newNode]);
    setEdges(prev => [...prev, newEdge]);
    setLoading(true);
  };

  const handleMouseDown = (e, id) => {
    startDragTime.current = performance.now();
    const onMouseMove = (moveEvent) => {
      const dx = moveEvent.movementX;
      const dy = moveEvent.movementY;
      setNodes(prevNodes =>
        prevNodes.map(node =>
          node.id === id ? { ...node, x: node.x + dx, y: node.y + dy } : node
        )
      );
    };

    const onMouseUp = () => {
      setDragTime(performance.now() - startDragTime.current);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Topological Sort UI</h1>
      {loading && <p style={{ color: 'orange' }}>Loading graph data...</p>}
      <p>Read Time: {readTime.toFixed(2)} ms</p>
      <p>Render Time: {renderTime.toFixed(2)} ms</p>
      {memoryUsage && <p>Memory Usage: {memoryUsage} MB</p>}
      <p>Last Drag Time: {dragTime.toFixed(2)} ms</p>
      <button onClick={addNode}>Add 50001 with random connection</button>

      <svg width="20000" height="20000" style={{ background: '#111', marginTop: '20px' }}>
        {edges.map((e, i) => {
          const source = nodes.find(n => n.id === e.source);
          const target = nodes.find(n => n.id === e.target);
          if (!source || !target) return null;
          return (
            <line
              key={i}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="#888"
              strokeWidth="1"
            />
          );
        })}
        {nodes.map(n => (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}>
            <circle
              r={6}
              fill="#3b82f6"
              onMouseDown={(e) => handleMouseDown(e, n.id)}
              style={{ cursor: 'move' }}
            />
            <text
              x={10}
              y={4}
              fontSize={10}
              fill="white"
            >
              {n.id}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default TopologicalGraphUI;
