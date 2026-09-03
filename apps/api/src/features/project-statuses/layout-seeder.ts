export function computeLayoutSeed(statuses: any[]): Record<string, { col: number; row: number }> {
  if (!statuses || statuses.length === 0) return {};

  const ids = statuses.map((s) => s.id);
  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));

  // -- Build adjacency list
  const adj: Record<string, string[]> = {};
  ids.forEach((id) => (adj[id] = []));
  statuses.forEach((s) =>
    (s.transitions ?? []).forEach((t: any) => {
      if (adj[s.id] && ids.includes(t.toStatusId) && t.toStatusId !== s.id)
        adj[s.id].push(t.toStatusId);
    })
  );

  // -- Layer Assignment: Shortest-Path BFS
  const inDeg: Record<string, number> = {};
  ids.forEach((id) => (inDeg[id] = 0));
  ids.forEach((id) => adj[id].forEach((tid) => (inDeg[tid] = (inDeg[tid] ?? 0) + 1)));

  const starts: string[] = statuses.filter((s) => s.isInitial).map((s) => s.id);
  if (starts.length === 0) ids.filter((id) => inDeg[id] === 0).forEach((id) => starts.push(id));
  if (starts.length === 0) starts.push(ids[0]);

  const layer: Record<string, number> = {};
  starts.forEach((id) => (layer[id] = 0));
  const bfsQ: string[] = [...starts];
  const bfsV = new Set<string>();
  let bfsH = 0;
  while (bfsH < bfsQ.length) {
    const cur = bfsQ[bfsH++];
    if (bfsV.has(cur)) continue;
    bfsV.add(cur);
    (adj[cur] ?? []).forEach((nxt) => {
      if (layer[nxt] === undefined) {
        layer[nxt] = (layer[cur] ?? 0) + 1;
        bfsQ.push(nxt);
      }
    });
  }
  let nextFree = Math.max(0, ...Object.values(layer)) + 1;
  ids.forEach((id) => { if (layer[id] === undefined) layer[id] = nextFree++; });

  // -- Forward edges
  const fwdAdj: Record<string, string[]> = {};
  ids.forEach((id) => {
    fwdAdj[id] = (adj[id] ?? []).filter((nxt) => layer[nxt] > layer[id]);
    fwdAdj[id].sort((a, b) =>
      new Date(statusMap[a].createdAt || 0).getTime() -
      new Date(statusMap[b].createdAt || 0).getTime()
    );
  });

  // -- Primary Spanning Tree
  const treeAdj: Record<string, string[]> = {};
  ids.forEach((id) => (treeAdj[id] = []));
  const treeVisited = new Set<string>();
  starts.forEach((id) => treeVisited.add(id));
  const treeQueue = [...starts];
  let treeHead = 0;
  while(treeHead < treeQueue.length) {
    const cur = treeQueue[treeHead++];
    const sortedFwd = [...(fwdAdj[cur] ?? [])].sort((a, b) =>
      new Date(statusMap[a].createdAt || 0).getTime() -
      new Date(statusMap[b].createdAt || 0).getTime()
    );
    sortedFwd.forEach((nxt) => {
      if (!treeVisited.has(nxt)) {
        treeVisited.add(nxt);
        treeQueue.push(nxt);
        treeAdj[cur].push(nxt);
      }
    });
  }

  // -- Pass 1: Bottom-Up footprint
  const footprint: Record<string, { min: number; max: number }> = {};
  const revOrder = [...treeQueue].reverse();
  ids.filter(id => !revOrder.includes(id)).forEach(id => revOrder.push(id));

  revOrder.forEach((id) => {
    const children = treeAdj[id] ?? [];
    if (children.length === 0) {
      footprint[id] = { min: 0, max: 0 };
      return;
    }

    let minF = 0, maxF = 0;
    let maxPositive = -1;
    let minNegative = 1;

    children.forEach((childId, i) => {
      const cf = footprint[childId] ?? { min: 0, max: 0 };
      let desiredOffset: number;
      if (i === 0) {
        desiredOffset = 0;
      } else {
        const rank = Math.ceil(i / 2);
        desiredOffset = i % 2 !== 0 ? rank : -rank;
      }

      let offset = desiredOffset;
      if (desiredOffset >= 0) {
        const needed = maxPositive - cf.min + 1;
        offset = Math.max(desiredOffset, needed);
        maxPositive = offset + cf.max;
        minNegative = Math.min(minNegative, offset + cf.min);
      } else {
        const needed = minNegative - cf.max - 1;
        offset = Math.min(desiredOffset, needed);
        minNegative = offset + cf.min;
        maxPositive = Math.max(maxPositive, offset + cf.max);
      }

      minF = Math.min(minF, offset + cf.min);
      maxF = Math.max(maxF, offset + cf.max);
    });

    footprint[id] = { min: minF, max: maxF };
  });

  // -- Pass 2: Top-Down assignments
  const trackMap: Record<string, number> = {};
  let rootMaxPositive = 0;
  let rootMinNegative = 0;

  starts
    .sort((a, b) =>
      new Date(statusMap[a].createdAt || 0).getTime() -
      new Date(statusMap[b].createdAt || 0).getTime()
    )
    .forEach((id, i) => {
      if (i === 0) {
        trackMap[id] = 0;
        const f = footprint[id] ?? { min: 0, max: 0 };
        rootMaxPositive = f.max;
        rootMinNegative = f.min;
      } else {
        const rank = Math.ceil(i / 2);
        const f = footprint[id] ?? { min: 0, max: 0 };
        if (i % 2 !== 0) {
          const needed = rootMaxPositive - f.min + 1;
          trackMap[id] = Math.max(rank, needed);
          rootMaxPositive = trackMap[id] + f.max;
        } else {
          const needed = rootMinNegative - f.max - 1;
          trackMap[id] = Math.min(-rank, needed);
          rootMinNegative = trackMap[id] + f.min;
        }
      }
    });

  const visitedTD = new Set<string>();
  const tdQueue = [...starts.filter((id) => trackMap[id] !== undefined)];
  let tdHead = 0;
  while (tdHead < tdQueue.length) {
    const id = tdQueue[tdHead++];
    if (visitedTD.has(id)) continue;
    visitedTD.add(id);

    const parentTrack = trackMap[id] ?? 0;
    const children = treeAdj[id] ?? [];

    let maxPositive = parentTrack - 1;
    let minNegative = parentTrack + 1;

    children.forEach((childId, i) => {
      if (trackMap[childId] !== undefined) {
        tdQueue.push(childId);
        return;
      }
      const cf = footprint[childId] ?? { min: 0, max: 0 };
      let desiredOffset: number;
      if (i === 0) {
        desiredOffset = 0;
      } else {
        const rank = Math.ceil(i / 2);
        desiredOffset = i % 2 !== 0 ? rank : -rank;
      }

      let offset = desiredOffset;
      if (i === 0) {
        offset = 0;
        maxPositive = parentTrack + offset + cf.max;
        minNegative = parentTrack + offset + cf.min;
      } else if (desiredOffset >= 0) {
        const needed = (maxPositive - parentTrack) - cf.min + 1;
        offset = Math.max(desiredOffset, needed);
        maxPositive = parentTrack + offset + cf.max;
        minNegative = Math.min(minNegative, parentTrack + offset + cf.min);
      } else {
        const needed = (minNegative - parentTrack) - cf.max - 1;
        offset = Math.min(desiredOffset, needed);
        minNegative = parentTrack + offset + cf.min;
        maxPositive = Math.max(maxPositive, parentTrack + offset + cf.max);
      }

      trackMap[childId] = parentTrack + offset;
      tdQueue.push(childId);
    });
  }

  let fallback = (Math.max(0, ...Object.values(trackMap)) + 1);
  ids.forEach((id) => {
    if (trackMap[id] === undefined) {
      trackMap[id] = fallback++;
    }
  });

  const result: Record<string, { col: number; row: number }> = {};
  statuses.forEach((s) => {
    result[s.id] = {
      col: layer[s.id] ?? 0,
      row: trackMap[s.id] ?? 0,
    };
  });
  return result;
}
