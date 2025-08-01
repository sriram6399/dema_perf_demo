export function generateMockHierarchy() {
  const functions = [];
  const subfunctions = [];
  const activities = [];

  let activityId = 1;

  for (let f = 1; f <= 5; f++) {
    const funcId = `F${f}`;
    functions.push({
      id: funcId,
      name: `Function ${f}`
    });

    for (let s = 1; s <= 5; s++) {
      const subId = `${funcId}-S${s}`;
      subfunctions.push({
        id: subId,
        name: `Subfunction ${f}.${s}`,
        parent: funcId
      });

      for (let a = 1; a <= 10; a++) {
        activities.push({
          id: `${subId}-A${a}`,
          name: `Activity ${f}.${s}.${a}`,
          parent: subId
        });

        activityId++;
      }
    }
  }

  return {
    functions,
    subfunctions,
    activities
  };
}
