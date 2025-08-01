import React, { useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Group, Line } from "react-konva";

const BOX_WIDTH = 100;
const BOX_HEIGHT = 50;
const BOX_GAP_Y = 20;
const FUNCTION_GAP_X = 200;
const FUNCTION_GAP_Y = 200;
const PADDING = 50;

export default function HierarchyCanvas({ functions, activities, edges }) {
  const stageRef = useRef();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const oldScale = scale;
    const pointer = stageRef.current.getPointerPosition();
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setScale(newScale);
    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setPosition(newPos);
  };

  const activityMap = Object.fromEntries(activities.map((a) => [a.id, a]));
  const functionMap = Object.fromEntries(functions.map((f) => [f.id, f]));

  // Reverse dependency graph: function A depends on function B if any activity in A depends on any activity in B
  const reverseFunctionDeps = new Map();
  functions.forEach((fn) => reverseFunctionDeps.set(fn.id, new Set()));

  edges.forEach(({ source, target }) => {
    const srcFn = activityMap[source]?.functionId;
    const tgtFn = activityMap[target]?.functionId;
    if (srcFn && tgtFn && srcFn !== tgtFn) {
      reverseFunctionDeps.get(srcFn).add(tgtFn);
    }
  });

  // Compute X position recursively based on dependencies
  const functionX = {};
  const visited = new Set();

  const resolveX = (fnId) => {
    if (visited.has(fnId)) return functionX[fnId];
    visited.add(fnId);
    const deps = Array.from(reverseFunctionDeps.get(fnId));
    let maxDepX = 0;
    for (const depFn of deps) {
      const depX = resolveX(depFn);
      maxDepX = Math.max(maxDepX, depX + FUNCTION_GAP_X);
    }
    functionX[fnId] = maxDepX;
    return maxDepX;
  };

  functions.forEach((fn) => resolveX(fn.id));

  const functionPositions = {};
  const computedActivityPositions = {};

  functions.forEach((fn, idx) => {
    const fnX = PADDING + functionX[fn.id];
    const fnY = PADDING + idx * FUNCTION_GAP_Y;
    functionPositions[fn.id] = { x: fnX, y: fnY };
    const acts = activities.filter((a) => a.functionId === fn.id);
    acts.forEach((a, i) => {
      computedActivityPositions[a.id] = {
        x: fnX + 20,
        y: fnY + 20 + i * (BOX_HEIGHT + BOX_GAP_Y),
      };
    });
  });

  return (
    <Stage
      width={4000}
      height={4000}
      onWheel={handleWheel}
      draggable
      scaleX={scale}
      scaleY={scale}
      x={position.x}
      y={position.y}
      ref={stageRef}
      style={{ backgroundColor: "#111" }}
    >
      <Layer>
        {functions.map((fn) => {
          const acts = activities.filter((a) => a.functionId === fn.id);
          const pos = functionPositions[fn.id];
          return (
            <Group key={fn.id} x={pos.x} y={pos.y} draggable>
              <Rect
                width={BOX_WIDTH + 40}
                height={acts.length * (BOX_HEIGHT + BOX_GAP_Y) + 40}
                fill="#e3f2fd"
                stroke="#0000cc"
                strokeWidth={1}
              />
              <Text text={fn.name} y={-20} fill="#0000cc" fontStyle="bold" />
              {acts.map((a, i) => (
                <Group key={a.id} x={20} y={20 + i * (BOX_HEIGHT + BOX_GAP_Y)}>
                  <Rect
                    width={BOX_WIDTH}
                    height={BOX_HEIGHT}
                    fill="#d1c4e9"
                    stroke="black"
                    strokeWidth={1}
                    cornerRadius={5}
                  />
                  <Text
                    text={a.name}
                    fontSize={10}
                    x={5}
                    y={15}
                    width={BOX_WIDTH - 10}
                  />
                </Group>
              ))}
            </Group>
          );
        })}

        {edges.map((e, i) => {
          const from = computedActivityPositions[e.source];
          const to = computedActivityPositions[e.target];
          if (!from || !to) return null;
          const startX = from.x + BOX_WIDTH;
          const startY = from.y + BOX_HEIGHT / 2;
          const endX = to.x;
          const endY = to.y + BOX_HEIGHT / 2;
          return (
            <Line
              key={i}
              points={[startX, startY, endX, endY]}
              stroke="#aaa"
              strokeWidth={1.5}
              pointerLength={5}
              pointerWidth={5}
              tension={0.2}
              bezier
              lineCap="round"
              lineJoin="round"
              shadowBlur={1}
            />
          );
        })}
      </Layer>
    </Stage>
  );
}
