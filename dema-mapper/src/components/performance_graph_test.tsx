import React, { useState, useEffect, useCallback } from 'react';

type NodeType = {
  id: number;
  x: number;
  y: number;
  label: string;
  color: string;
};

type EdgeType = {
  id: number;
  source: number;
  target: number;
};

const PerformanceGraphTest = () => {
  const [nodes, setNodes] = useState<NodeType[]>([]);
  const [edges, setEdges] = useState<EdgeType[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const generateMockData = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const mockNodes: NodeType[] = [];
      const mockEdges: EdgeType[] = [];

      for (let i = 0; i < 100; i++) {
        mockNodes.push({
          id: i,
          x: Math.random() * 2000,
          y: Math.random() * 2000,
          label: `Node ${i}`,
          color: `hsl(${Math.random() * 360}, 50%, 50%)`
        });
      }

      for (let i = 0; i < 30; i++) {
        const source = Math.floor(Math.random() * 100);
        const target = Math.floor(Math.random() * 100);
        if (source !== target) {
          mockEdges.push({ id: i, source, target });
        }
      }

      setNodes(mockNodes);
      setEdges(mockEdges);
      setLoading(false);
    }, 100);
  }, []);

  useEffect(() => {
    generateMockData();
  }, [generateMockData]);

  const handleNodeClick = (node: NodeType) => {
    setSelectedNode(selectedNode?.id === node.id ? null : node);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#111827', color: 'white', overflow: 'scroll', position: 'relative' }}>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ fontSize: '1.5rem', color: 'white' }}>Loading...</div>
        </div>
      )}

      <div style={{ width: '2200px', height: '2200px', position: 'relative' }}>
        {edges.map(edge => {
          const source = nodes[edge.source];
          const target = nodes[edge.target];
          if (!source || !target) return null;

          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;

          return (
            <div
              key={edge.id}
              style={{
                position: 'absolute',
                backgroundColor: 'gray',
                opacity: 0.3,
                left: `${source.x}px`,
                top: `${source.y}px`,
                width: `${length}px`,
                height: '1px',
                transformOrigin: '0 0',
                transform: `rotate(${angle}deg)`,
                pointerEvents: 'none'
              }}
            />
          );
        })}

        {nodes.map(node => (
          <div
            key={node.id}
            title={node.label}
            style={{
              position: 'absolute',
              borderRadius: '50%',
              cursor: 'pointer',
              left: `${node.x - (selectedNode?.id === node.id ? 6 : 3)}px`,
              top: `${node.y - (selectedNode?.id === node.id ? 6 : 3)}px`,
              width: `${selectedNode?.id === node.id ? 12 : 6}px`,
              height: `${selectedNode?.id === node.id ? 12 : 6}px`,
              backgroundColor: selectedNode?.id === node.id ? '#fbbf24' : node.color,
              border: selectedNode?.id === node.id ? '2px solid #f59e0b' : 'none'
            }}
            onClick={() => handleNodeClick(node)}
          />
        ))}
      </div>

      {selectedNode && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.8)', padding: 16, borderRadius: 8 }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: 8 }}>Selected Node</h3>
          <div style={{ fontSize: '0.875rem' }}>
            <div>ID: {selectedNode.id}</div>
            <div>Label: {selectedNode.label}</div>
            <div>X: {selectedNode.x.toFixed(1)}</div>
            <div>Y: {selectedNode.y.toFixed(1)}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceGraphTest;