import React, { useState, useEffect } from 'react';

const TopologicalGraphUI = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [sortedNodes, setSortedNodes] = useState([]);
  const [renderTime, setRenderTime] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(null);
  const [readTime, setReadTime] = useState(0);

  // Generate nodes and edges in React
  useEffect(() => {
    const generateData = () => {
      const start = performance.now();
      const newNodes = [];
      const newEdges = [];
      const totalNodes = 50000;
      const totalEdges = 10000;

      for (let i = 1; i <= totalNodes; i++) {
        newNodes.push({ id: i.toString() });
      }

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
    };

    generateData();
  }, []);

  useEffect(() => {
    if (nodes.length === 0) return;

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

    // Include unconnected nodes
    const allSorted = [
      ...sorted,
      ...nodes.map(n => n.id).filter(id => !sorted.includes(id))
    ];

    setSortedNodes(allSorted);
    setRenderTime(performance.now() - start);

    if (performance && performance.memory) {
      const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
      setMemoryUsage({ usedJSHeapSize, totalJSHeapSize });
    }
  }, [nodes, edges]);

  const addNode = () => {
    const newId = "50001";
    const randomTarget = sortedNodes[Math.floor(Math.random() * sortedNodes.length)];
    setNodes(prev => [...prev, { id: newId }]);
    setEdges(prev => [...prev, { source: newId, target: randomTarget }]);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Topological Sort UI</h1>
      <p>Read Time (Data Generation): {readTime.toFixed(2)} ms</p>
      <p>Render Time (Topological Sort): {renderTime.toFixed(2)} ms</p>
      {memoryUsage && (
        <p>
          Memory Usage: {(memoryUsage.usedJSHeapSize / 1048576).toFixed(2)} MB / {(memoryUsage.totalJSHeapSize / 1048576).toFixed(2)} MB
        </p>
      )}
      <button onClick={addNode}>Add 50001 with random connection</button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
        {sortedNodes.map((id) => (
          <div key={id} style={{ padding: '4px 8px', background: '#3b82f6', color: 'white', borderRadius: '4px' }}>
            {id}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopologicalGraphUI;
