import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

export async function layoutActivitiesWithELK(activities, edges) {
  const graph = {
    id: "root",
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '40',
    },
    children: activities.map((a) => ({
      id: a.id,
      width: 100,
      height: 50,
      labels: [{ text: a.name }]
    })),
    edges: edges.map((e, i) => ({
      id: `e${i}`,
      sources: [e.source],
      targets: [e.target]
    }))
  };

  const result = await elk.layout(graph);
  return result;
}
