/**
 * Optimizer service
 * - Greedy + genetic hybrid for single container
 * - Adds center of gravity, load balance, and step-by-step plan
 * - Lightweight multi-container selector
 */

// Helper to clone deep enough for small arrays
const clone = (obj) => JSON.parse(JSON.stringify(obj));

const defaultConstraints = {
  weights: { volume: 0.3, weight: 0.2, stability: 0.15, balance: 0.1, priority: 0.1, axle: 0.15 },
  grid: 5, // cm step
  maxGenerations: 120,
  populationSize: 80
};

function getRotations(item) {
  const base = [
    { w: item.width, h: item.height, d: item.depth },
    { w: item.width, h: item.depth, d: item.height },
    { w: item.height, h: item.width, d: item.depth },
    { w: item.height, h: item.depth, d: item.width },
    { w: item.depth, h: item.width, d: item.height },
    { w: item.depth, h: item.height, d: item.width }
  ];
  // If rotatable=false -> only keep original orientation
  if (item.rotatable === false) return [base[0]];
  // If tiltable=false -> keep orientations where height stays item.height
  if (item.tiltable === false) {
    return base.filter((r) => r.h === item.height);
  }
  return base;
}

function computeCOG(boxes = [], containerDims) {
  let totalWeight = 0;
  let cog = { x: 0, y: 0, z: 0 };
  boxes.forEach((b) => {
    const w = b.weight || 1;
    totalWeight += w;
    cog.x += (b.x + b.w / 2) * w;
    cog.y += (b.y + b.h / 2) * w;
    cog.z += (b.z + b.d / 2) * w;
  });
  if (totalWeight === 0) return { ...cog, totalWeight: 0 };
  cog.x /= totalWeight;
  cog.y /= totalWeight;
  cog.z /= totalWeight;

  // Balance ratios
  const ideal = { x: containerDims.width / 2, y: containerDims.height / 2, z: containerDims.depth / 2 };
  const maxDev = Math.sqrt(
    Math.pow(containerDims.width / 2, 2) +
      Math.pow(containerDims.height / 2, 2) +
      Math.pow(containerDims.depth / 2, 2)
  );
  const dev = Math.sqrt(
    Math.pow(cog.x - ideal.x, 2) + Math.pow(cog.y - ideal.y, 2) + Math.pow(cog.z - ideal.z, 2)
  );
  const balanceScore = 1 - dev / maxDev;
  return { ...cog, totalWeight, balanceScore };
}

function overlaps(b1, b2) {
  return !(
    b1.x + b1.w <= b2.x ||
    b1.x >= b2.x + b2.w ||
    b1.y + b1.h <= b2.y ||
    b1.y >= b2.y + b2.h ||
    b1.z + b1.d <= b2.z ||
    b1.z >= b2.z + b2.d
  );
}

function decodeIndividual(ind, items, container, constraints) {
  const placed = [];
  let usedVolume = 0;
  let usedWeight = 0;
  const stepPlan = [];

  ind.order.forEach((itemIdx, seq) => {
    const item = items[itemIdx];
    const rot = ind.rotations[itemIdx];
    const rots = getRotations(item);
    const dims = rots[rot % rots.length];

    const pos = findPosition(dims, placed, item, container, constraints.grid || 5, ind.placements[itemIdx]);
    if (!pos) return;

    const box = {
      ...dims,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      weight: item.weight,
      priority: item.priority,
      group: item.group || '',
      destination: item.destination || '',
      sku: item.sku || '',
      category: item.category || 'normal',
      stackable: item.stackable !== false
    };
    placed.push(box);
    usedVolume += dims.w * dims.h * dims.d;
    usedWeight += item.weight || 0;

    stepPlan.push({
      step: seq + 1,
      name: item.name || `Box ${seq + 1}`,
      position: pos,
      rotation: rot,
      weight: item.weight,
      destination: item.destination || '',
      group: item.group || '',
      sku: item.sku || '',
      priority: item.priority,
      width: dims.w,
      height: dims.h,
      depth: dims.d,
      category: item.category || 'normal'
    });
  });

  return { boxes: placed, usedVolume, usedWeight, stepPlan };
}

function findPosition(dims, placed, item, container, grid, target, options = {}) {
  const step = grid || 5;
  let best = null;
  let bestScore = -Infinity;
  const tx = target?.x ?? dims.w / 2;
  const ty = target?.y ?? dims.h / 2;
  const tz = target?.z ?? dims.d / 2;
  const segment = options.segment;

  const allowOverhang = container.allowOverhang || 0;
  const maxX = container.width + allowOverhang;
  const maxZ = container.depth + allowOverhang;
  const minZ = segment ? Math.max(segment.minZ, -allowOverhang) : -allowOverhang;
  const segmentMax = segment ? Math.min(segment.maxZ, maxZ) : maxZ;

  for (let x = -allowOverhang; x <= maxX - dims.w; x += step) {
    for (let y = 0; y <= container.height - dims.h; y += step) {
      for (let z = minZ; z <= segmentMax - dims.d; z += step) {
        const box = { ...dims, x, y, z };
        let collision = false;
        for (const p of placed) {
          if (overlaps(box, p)) {
            collision = true;
            break;
          }
          // Non-stackable footprint check: nếu đặt trên nó mà footprint giao và y>p.y
          if (p.stackable === false) {
            const overlapXZ =
              !(box.x + box.w <= p.x || box.x >= p.x + p.w || box.z + box.d <= p.z || box.z >= p.z + p.d);
            if (overlapXZ && box.y < p.y + p.h && box.y >= p.y) {
              collision = true;
              break;
            }
          }
          if (options.priority?.noGroupStacking && getPriorityValue(item) !== getPriorityValue(p)) {
            const overlapXZ =
              !(box.x + box.w <= p.x || box.x >= p.x + p.w || box.z + box.d <= p.z || box.z >= p.z + p.d);
            const isPlacedAbove = box.y >= p.y + p.h - step && box.y > 0;
            if (overlapXZ && isPlacedAbove) {
              collision = true;
              break;
            }
          }
        }
        if (collision) continue;
        const dist = Math.sqrt(Math.pow(x - tx, 2) + Math.pow(y - ty, 2) + Math.pow(z - tz, 2));
        const onFloor = y === 0 ? 1 : 0;
        const depthAffinity = options.preferFar ? Math.max(z, 0) / Math.max(container.depth, 1) : 1 / (1 + Math.max(z, 0));
        const score = 1000 / (1 + dist) + onFloor * 50 + depthAffinity * 20;
        if (score > bestScore) {
          bestScore = score;
          best = { x, y, z };
        }
      }
    }
  }
  return best;
}

function fitness(solution, container, constraints) {
  const volumeUtil = solution.usedVolume / (container.width * container.height * container.depth);
  const weightUtil = solution.usedWeight / (container.maxLoad || Number.MAX_SAFE_INTEGER);
  const cog = computeCOG(solution.boxes, container);
  const stability = cog.balanceScore || 0;
  const axle = computeAxleScore(solution.boxes, container);

  const weights = { ...defaultConstraints.weights, ...(constraints.weights || {}) };
  const overall =
    volumeUtil * weights.volume +
    weightUtil * weights.weight +
    stability * weights.stability +
    (solution.boxes.length ? 1 : 0) * weights.priority +
    cog.balanceScore * weights.balance +
    axle.score * weights.axle;

  return {
    volume: volumeUtil,
    weight: weightUtil,
    stability,
    balance: cog.balanceScore,
    axle: axle.score,
    axleData: axle,
    axleLoads: axle.loads,
    axleRatios: axle.ratios,
    overall,
    cog
  };
}

function computeAxleScore(boxes = [], container) {
  const positions = container.axlePositions || [];
  const limits = container.axleLimits || [];
  if (!positions.length || !limits.length) return { loads: [], score: 1 };
  const loads = new Array(positions.length).fill(0);
  const depth = container.depth;
  boxes.forEach((b) => {
    const w = b.weight || 0;
    const z = b.z + b.d / 2; // từ cửa (0) tới trước
    let assigned = false;
    for (let i = 0; i < positions.length - 1; i++) {
      const p1 = positions[i];
      const p2 = positions[i + 1];
      if (z >= p1 && z <= p2) {
        const ratio = (z - p1) / (p2 - p1 || 1);
        loads[i] += w * (1 - ratio);
        loads[i + 1] += w * ratio;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      if (z < positions[0]) loads[0] += w;
      else loads[loads.length - 1] += w;
    }
  });
  const ratios = loads.map((l, i) => (limits[i] ? l / limits[i] : 0));
  // score 1 nếu tất cả <100%, giảm dần khi vượt
  const score = Math.max(0, 1 - Math.max(...ratios.map((r) => Math.max(0, r - 1))));
  return { loads, ratios, score };
}

function getPriorityValue(item) {
  return Number(item.priority) || 3;
}

function buildPrioritySegments(items = [], container, constraints = {}) {
  const splitByWall = constraints.priority?.splitByWall;
  if (!splitByWall) return new Map();

  const groups = [...new Set(items.map(getPriorityValue))].sort((a, b) => a - b);
  if (!groups.length) return new Map();

  const wallThickness = Math.max(constraints.grid || 5, 3);
  const usableDepth = Math.max(container.depth - wallThickness * (groups.length - 1), container.depth * 0.4);
  const segmentDepth = usableDepth / groups.length;
  const segments = new Map();
  let cursor = 0;

  [...groups].sort((a, b) => b - a).forEach((priority, idx, arr) => {
    const minZ = cursor;
    const maxZ = idx === arr.length - 1 ? container.depth : Math.min(container.depth, cursor + segmentDepth);
    segments.set(priority, { minZ, maxZ });
    cursor = maxZ + wallThickness;
  });

  return segments;
}

function buildPriorityTarget(item, container, items = [], constraints = {}, segments = new Map()) {
  const priorityValue = getPriorityValue(item);
  const sortedGroups = [...new Set(items.map(getPriorityValue))].sort((a, b) => a - b);
  const maxRank = Math.max(sortedGroups.length - 1, 1);
  const rank = Math.max(sortedGroups.indexOf(priorityValue), 0);
  const reverseRatio = 1 - rank / maxRank;
  const segment = segments.get(priorityValue);
  const targetZ = segment
    ? (segment.minZ + segment.maxZ) / 2
    : reverseRatio * container.depth;

  return {
    x: container.width / 2,
    y: 0,
    z: Math.max(0, Math.min(container.depth, targetZ)),
    segment,
    preferFar: priorityValue <= Math.ceil((sortedGroups[0] + sortedGroups[sortedGroups.length - 1]) / 2)
  };
}

function sortItemsForRules(items = [], constraints = {}) {
  if (constraints.priority?.ignoreSeparation) {
    return [...items].sort((a, b) => {
      const volA = (a.width || 0) * (a.height || 0) * (a.depth || 0);
      const volB = (b.width || 0) * (b.height || 0) * (b.depth || 0);
      return volB - volA || (b.weight || 0) - (a.weight || 0);
    });
  }

  return [...items].sort((a, b) => {
    const priorityDiff = getPriorityValue(a) - getPriorityValue(b);
    if (priorityDiff !== 0) return priorityDiff;
    const volA = (a.width || 0) * (a.height || 0) * (a.depth || 0);
    const volB = (b.width || 0) * (b.height || 0) * (b.depth || 0);
    return volB - volA || (b.weight || 0) - (a.weight || 0);
  });
}

function clampShift(boxes = [], axis, delta, containerLimit) {
  if (!boxes.length) return 0;
  const dim = axis === 'x' ? 'w' : 'd';
  const minStart = Math.min(...boxes.map((box) => box[axis]));
  const maxEnd = Math.max(...boxes.map((box) => box[axis] + box[dim]));
  let nextDelta = delta;
  if (minStart + nextDelta < 0) nextDelta = -minStart;
  if (maxEnd + nextDelta > containerLimit) nextDelta = containerLimit - maxEnd;
  return nextDelta;
}

function shiftBoxesToMassCenter(boxes = [], container) {
  if (!boxes.length) return boxes;
  const shifted = clone(boxes);
  const cog = computeCOG(shifted, container);
  let deltaX = container.width / 2 - cog.x;
  let deltaZ = container.depth / 2 - cog.z;

  deltaX = clampShift(shifted, 'x', deltaX, container.width);
  deltaZ = clampShift(shifted, 'z', deltaZ, container.depth);

  shifted.forEach((box) => {
    box.x += deltaX;
    box.z += deltaZ;
  });

  return shifted;
}

function buildConstraintAwarePlan(items = [], container, constraints = {}) {
  const sortedItems = sortItemsForRules(items, constraints);
  const placed = [];
  const stepPlan = [];
  let usedVolume = 0;
  let usedWeight = 0;
  const segments = buildPrioritySegments(sortedItems, container, constraints);
  const grid = constraints.grid || 5;

  sortedItems.forEach((item, seq) => {
    const rotations = getRotations(item);
    const baseTarget = buildPriorityTarget(item, container, sortedItems, constraints, segments);
    let bestCandidate = null;
    let bestScore = -Infinity;

    rotations.forEach((dims, rotIdx) => {
      const pos = findPosition(dims, placed, item, container, grid, baseTarget, {
        priority: constraints.priority || {},
        segment: baseTarget.segment,
        preferFar: !!baseTarget.preferFar
      });
      if (!pos) return;

      const candidate = {
        ...dims,
        x: pos.x,
        y: pos.y,
        z: pos.z,
        weight: item.weight || 0,
        priority: getPriorityValue(item),
        group: item.group || '',
        destination: item.destination || '',
        sku: item.sku || '',
        category: item.category || 'normal',
        stackable: item.stackable !== false
      };

      if (constraints.weight?.respectLimits) {
        if (usedWeight + (item.weight || 0) > (container.maxLoad || Number.MAX_SAFE_INTEGER)) return;
        const axleCheck = computeAxleScore([...placed, candidate], container);
        if ((axleCheck.ratios || []).some((ratio) => ratio > 1.001)) return;
      }

      const depthBias = constraints.priority?.ignoreSeparation ? 0 : (getPriorityValue(item) / 4) * (1 - pos.z / Math.max(container.depth, 1));
      const floorBias = pos.y === 0 ? 0.8 : 0;
      const compactness = 1 / (1 + Math.abs(pos.x + dims.w / 2 - container.width / 2));
      const score = floorBias + depthBias + compactness - pos.y / Math.max(container.height, 1) - rotIdx * 0.02;
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = { candidate, rotation: rotIdx };
      }
    });

    if (!bestCandidate) return;

    placed.push(bestCandidate.candidate);
    usedVolume += bestCandidate.candidate.w * bestCandidate.candidate.h * bestCandidate.candidate.d;
    usedWeight += item.weight || 0;
    stepPlan.push({
      step: seq + 1,
      name: item.name || `Box ${seq + 1}`,
      position: { x: bestCandidate.candidate.x, y: bestCandidate.candidate.y, z: bestCandidate.candidate.z },
      rotation: bestCandidate.rotation,
      weight: item.weight || 0,
      destination: item.destination || '',
      group: item.group || '',
      sku: item.sku || '',
      priority: getPriorityValue(item),
      width: bestCandidate.candidate.w,
      height: bestCandidate.candidate.h,
      depth: bestCandidate.candidate.d,
      category: item.category || 'normal'
    });
  });

  let finalBoxes = placed;
  if (constraints.weight?.shiftToMassCenter && placed.length) {
    finalBoxes = shiftBoxesToMassCenter(placed, container);
    finalBoxes.forEach((box, idx) => {
      if (stepPlan[idx]) {
        stepPlan[idx].position = { x: box.x, y: box.y, z: box.z };
      }
    });
  }

  return { boxes: finalBoxes, usedVolume, usedWeight, stepPlan };
}

function randomIndividual(items, container) {
  const order = [...Array(items.length).keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    order,
    rotations: items.map((it) => Math.floor(Math.random() * getRotations(it).length)),
    placements: items.map(() => ({
      x: Math.random() * container.width,
      y: Math.random() * container.height,
      z: Math.random() * container.depth
    }))
  };
}

function crossover(p1, p2, itemsLen) {
  const point = Math.floor(Math.random() * itemsLen);
  const child = {
    order: [...p1.order.slice(0, point), ...p2.order.slice(point)],
    rotations: [...p1.rotations.slice(0, point), ...p2.rotations.slice(point)],
    placements: [...p1.placements.slice(0, point), ...p2.placements.slice(point)]
  };
  // fix duplicates in order
  const seen = new Set();
  const fixed = [];
  child.order.forEach((idx) => {
    if (!seen.has(idx)) {
      seen.add(idx);
      fixed.push(idx);
    }
  });
  for (let i = 0; i < itemsLen; i++) if (!seen.has(i)) fixed.push(i);
  child.order = fixed;
  return child;
}

function mutate(ind, rate, container, items) {
  if (Math.random() < rate) {
    const i = Math.floor(Math.random() * ind.order.length);
    const j = Math.floor(Math.random() * ind.order.length);
    [ind.order[i], ind.order[j]] = [ind.order[j], ind.order[i]];
  }
  if (Math.random() < rate) {
    const i = Math.floor(Math.random() * ind.rotations.length);
    const maxR = getRotations(items[i]).length || 1;
    ind.rotations[i] = Math.floor(Math.random() * maxR);
  }
  if (Math.random() < rate) {
    const i = Math.floor(Math.random() * ind.placements.length);
    ind.placements[i] = {
      x: Math.random() * container.width,
      y: Math.random() * container.height,
      z: Math.random() * container.depth
    };
  }
}

function optimizeSingle(items, containerInput, constraintsInput = {}) {
  const constraints = { ...defaultConstraints, ...constraintsInput };
  const container = {
    width: containerInput.width || containerInput.w || 235,
    height: containerInput.height || containerInput.h || 239,
    depth: containerInput.depth || containerInput.d || 590,
    maxLoad: containerInput.maxLoad || 28500,
    axlePositions: containerInput.axlePositions || [],
    axleLimits: containerInput.axleLimits || [],
    allowOverhang: ((containerInput.allowOverhangPercent || 0) / 100) * (containerInput.width || containerInput.w || 235)
  };
  const start = Date.now();

  const ruleDrivenPlan = buildConstraintAwarePlan(items, container, constraints);
  if (ruleDrivenPlan.boxes.length) {
    const bestFitness = fitness(ruleDrivenPlan, container, constraints);
    const cog = computeCOG(ruleDrivenPlan.boxes, container);
    return {
      bestSolution: {
        ...ruleDrivenPlan,
        stats: {
          executionTime: Date.now() - start,
          iterations: 1,
          populationSize: items.length,
          mode: 'rule-driven'
        },
        fitness: bestFitness,
        cog,
        axle: bestFitness.axleData
      },
      solutions: [
        {
          fitness: bestFitness,
          boxes: ruleDrivenPlan.boxes,
          stepPlan: ruleDrivenPlan.stepPlan,
          cog,
          axle: bestFitness.axleData
        }
      ]
    };
  }

  const populationSize = constraints.populationSize;
  const generations = constraints.maxGenerations;
  const mutationRate = 0.12;

  let population = Array.from({ length: populationSize }, () => randomIndividual(items, container));
  let best = null;

  for (let g = 0; g < generations; g++) {
    const scored = population.map((ind) => {
      const solution = decodeIndividual(ind, items, container, constraints);
      const fit = fitness(solution, container, constraints);
      return { ind, solution, fit };
    });

    scored.sort((a, b) => b.fit.overall - a.fit.overall);
    if (!best || scored[0].fit.overall > best.fit.overall) best = scored[0];

    // elitism + crossover + mutation
    const elites = scored.slice(0, 10).map((s) => s.ind);
    const nextPop = [...elites];
    while (nextPop.length < populationSize) {
      const p1 = elites[Math.floor(Math.random() * elites.length)];
      const p2 = scored[Math.floor(Math.random() * scored.length)].ind;
      const child = crossover(p1, p2, items.length);
      mutate(child, mutationRate, container, items);
      nextPop.push(child);
    }
    population = nextPop;
  }

  const decodedBest = decodeIndividual(best.ind, items, container, constraints);
  const bestFitness = fitness(decodedBest, container, constraints);
  const cog = computeCOG(decodedBest.boxes, container);

  return {
    bestSolution: {
      ...decodedBest,
      stats: {
        executionTime: Date.now() - start,
        iterations: generations,
        populationSize,
        mode: 'genetic'
      },
      fitness: bestFitness,
      cog,
      axle: bestFitness.axleData
    },
    solutions: [
      {
        fitness: bestFitness,
        boxes: decodedBest.boxes,
        stepPlan: decodedBest.stepPlan,
        cog,
        axle: bestFitness.axleData
      }
    ]
  };
}

function optimizeMulti(items = [], containers = [], constraints = {}) {
  if (!containers.length) return optimizeSingle(items, {}, constraints);
  const results = containers.map((ct) => {
    const run = optimizeSingle(items, ct, constraints);
    const containerVolume = (ct.width || ct.w) * (ct.height || ct.h) * (ct.depth || ct.d);
    const utilization = run.bestSolution.usedVolume / containerVolume;
    const neededContainers = Math.ceil(1 / Math.max(utilization, 0.0001));
    return {
      container: ct,
      utilization,
      neededContainers,
      score: utilization - 0.05 * (neededContainers - 1),
      ...run
    };
  });
  results.sort((a, b) => b.score - a.score);
  return { best: results[0], candidates: results };
}

module.exports = {
  optimizeSingle,
  optimizeMulti
};
