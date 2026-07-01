/* Level progression — starts easy (tutorial) and ramps gradually via LEVEL_CONFIG. */

const SCREEN_WIDTH =
  typeof document !== 'undefined'
    ? document.getElementById('game-canvas')?.width || 800
    : 800;

const FLOOR_Y = 440;
const PLATFORM_H = 40;
const CRATER_W = 80;
const CRATER_H = 40;
const SPAWN_X = 50;
const MIN_PLATFORM_W = 120;
const MIN_CRATER_GAP = 280;

const ASTEROID_SPEED = { slow: 2.2, moderate: 3.2, fast: 4.6, faster: 5.8, fastest: 6.6 };
const ASTEROID_FREQUENCY = { low: 300, moderate: 210, high: 130, veryHigh: 85, hardest: 58 };

const LEVEL_CONFIG = [
  {
    level: 1,
    name: 'Dusty Plains',
    collectibles: { goodCells: 1, gems: 1, water: 1 },
    hazards: { craters: 1, aliens: 1, asteroidsEnabled: false },
    difficulty: {
      alienMoves: false,
      alienSpeed: 0,
      asteroidSpeed: 0,
      asteroidFrequency: 0,
      maxAsteroids: 0,
    },
  },
  {
    level: 2,
    name: 'First Contact',
    collectibles: { goodCells: 2, gems: 2, water: 1 },
    hazards: { craters: 1, aliens: 1, asteroidsEnabled: true },
    difficulty: {
      alienMoves: false,
      alienSpeed: 0,
      asteroidSpeed: 'slow',
      asteroidFrequency: 'low',
      maxAsteroids: 1,
    },
  },
  {
    level: 3,
    name: 'Ice Cap Search',
    collectibles: { goodCells: 3, gems: 3, water: 3 },
    hazards: { craters: 2, aliens: 1, asteroidsEnabled: true },
    difficulty: {
      alienMoves: true,
      alienSpeed: 0.7,
      asteroidSpeed: 'slow',
      asteroidFrequency: 'low',
      maxAsteroids: 1,
    },
  },
  {
    level: 4,
    name: 'Asteroid Drift',
    collectibles: { goodCells: 3, gems: 3, water: 2 },
    hazards: { craters: 2, aliens: 2, asteroidsEnabled: true },
    difficulty: {
      alienMoves: true,
      alienSpeed: 0.9,
      asteroidSpeed: 'moderate',
      asteroidFrequency: 'moderate',
      maxAsteroids: 1,
    },
  },
  {
    level: 5,
    name: 'Red Canyon',
    collectibles: { goodCells: 4, gems: 3, water: 2 },
    hazards: { craters: 3, aliens: 3, asteroidsEnabled: true },
    difficulty: {
      alienMoves: true,
      alienSpeed: 1.1,
      asteroidSpeed: 'moderate',
      asteroidFrequency: 'moderate',
      maxAsteroids: 1,
    },
  },
  {
    level: 6,
    name: 'Olympus Approach',
    collectibles: { goodCells: 4, gems: 4, water: 3 },
    hazards: { craters: 3, aliens: 3, asteroidsEnabled: true },
    difficulty: {
      alienMoves: true,
      alienSpeed: 1.4,
      asteroidSpeed: 'faster',
      asteroidFrequency: 'high',
      maxAsteroids: 2,
    },
  },
  {
    level: 7,
    name: 'Valles Marineris',
    collectibles: { goodCells: 5, gems: 4, water: 3 },
    hazards: { craters: 4, aliens: 4, asteroidsEnabled: true },
    difficulty: {
      alienMoves: true,
      alienSpeed: 1.7,
      asteroidSpeed: 'fast',
      asteroidFrequency: 'high',
      maxAsteroids: 2,
    },
  },
  {
    level: 8,
    name: 'Polar Depths',
    collectibles: { goodCells: 5, gems: 5, water: 4 },
    hazards: { craters: 4, aliens: 4, asteroidsEnabled: true },
    difficulty: {
      alienMoves: true,
      alienSpeed: 2.1,
      asteroidSpeed: 'fast',
      asteroidFrequency: 'high',
      maxAsteroids: 2,
    },
  },
  {
    level: 9,
    name: 'Storm Front',
    collectibles: { goodCells: 6, gems: 5, water: 4 },
    hazards: { craters: 5, aliens: 4, asteroidsEnabled: true },
    difficulty: {
      alienMoves: true,
      alienSpeed: 2.5,
      asteroidSpeed: 'fastest',
      asteroidFrequency: 'veryHigh',
      maxAsteroids: 3,
    },
  },
  {
    level: 10,
    name: 'Last Hope',
    collectibles: { goodCells: 6, gems: 6, water: 5 },
    hazards: { craters: 5, aliens: 5, asteroidsEnabled: true },
    difficulty: {
      alienMoves: true,
      alienSpeed: 3.2,
      asteroidSpeed: 'fastest',
      asteroidFrequency: 'hardest',
      maxAsteroids: 3,
    },
    floatingPlatforms: true,
    floatPickups: true,
  },
];

function resolveNumeric(value, map, fallback) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return map[value] ?? fallback;
  return fallback;
}

function resolveDifficulty(difficulty, asteroidsEnabled) {
  if (!asteroidsEnabled) {
    return { alienSpeed: difficulty.alienMoves ? difficulty.alienSpeed : 0, asteroidSpeed: 0, asteroidRate: 0, maxAsteroids: 0 };
  }
  return {
    alienSpeed: difficulty.alienMoves ? difficulty.alienSpeed : 0,
    asteroidSpeed: resolveNumeric(difficulty.asteroidSpeed, ASTEROID_SPEED, 3.2),
    asteroidRate: resolveNumeric(difficulty.asteroidFrequency, ASTEROID_FREQUENCY, 210),
    maxAsteroids: difficulty.maxAsteroids ?? 1,
  };
}

function totalCollectibleCount(collectibles) {
  return collectibles.goodCells + collectibles.gems + collectibles.water;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distributeCraters(count, levelWidth, screenWidth) {
  if (count === 0) return [];

  const startBuffer = Math.max(SPAWN_X + 100, screenWidth * 0.2);
  const endBuffer = screenWidth * 0.1;
  const usable = levelWidth - startBuffer - endBuffer - CRATER_W;
  const minGap = Math.max(MIN_CRATER_GAP, screenWidth * 0.28);

  const positions = [];
  for (let i = 0; i < count; i++) {
    const frac = (i + 1) / (count + 1);
    positions.push(Math.round(startBuffer + usable * frac));
  }

  positions.sort((a, b) => a - b);
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] - positions[i - 1] < minGap) {
      positions[i] = positions[i - 1] + minGap;
    }
  }

  const maxX = levelWidth - endBuffer - CRATER_W;
  if (positions[positions.length - 1] > maxX) {
    const overflow = positions[positions.length - 1] - maxX;
    for (let i = 0; i < positions.length; i++) {
      positions[i] = Math.max(startBuffer, positions[i] - overflow);
    }
  }

  return positions.map((x) => ({ x, y: FLOOR_Y, w: CRATER_W, h: CRATER_H }));
}

function getPlatformSpans(platforms) {
  return platforms
    .filter((p) => p.y >= 400)
    .map((p) => ({ min: p.x + 70, max: p.x + p.w - 70, platform: p }));
}

function generateObstacles(levelConfig, levelWidth, screenWidth) {
  const resolved = resolveDifficulty(levelConfig.difficulty, levelConfig.hazards.asteroidsEnabled);
  const craters = distributeCraters(levelConfig.hazards.craters, levelWidth, screenWidth);
  const groundPlatforms = generatePlatforms(levelWidth, craters);
  const spans = getPlatformSpans(groundPlatforms);
  const alienCount = levelConfig.hazards.aliens;

  const eligibleSpans = spans.filter((s) => s.max - s.min > 160);
  const aliens = [];

  for (let i = 0; i < alienCount; i++) {
    const spanIdx =
      alienCount === 1
        ? Math.floor(eligibleSpans.length / 2)
        : Math.round(i * (eligibleSpans.length - 1) / Math.max(alienCount - 1, 1));
    const span = eligibleSpans[clamp(spanIdx, 0, eligibleSpans.length - 1)] ?? spans[0];
    if (!span) continue;

    const patrolW = Math.min(span.max - span.min - 40, screenWidth * 0.38);
    const center = span.min + (span.max - span.min) * (0.35 + (i % 3) * 0.15);
    const minX = Math.round(clamp(center - patrolW / 2, span.min, span.max - 28));
    const maxX = Math.round(clamp(center + patrolW / 2, minX + 60, span.max));

    const alien = {
      x: Math.round((minX + maxX) / 2),
      y: 408,
      minX,
      maxX,
      speed: 0,
    };

    if (levelConfig.difficulty.alienMoves && resolved.alienSpeed > 0) {
      alien.speed = resolved.alienSpeed + i * 0.12;
    } else {
      alien.minX = alien.x;
      alien.maxX = alien.x;
    }

    aliens.push(alien);
  }

  return { craters, aliens, groundPlatforms, resolved };
}

function generatePlatforms(levelWidth, craters) {
  const sorted = [...craters].sort((a, b) => a.x - b.x);
  const platforms = [];
  let cursor = 0;

  for (const crater of sorted) {
    const w = crater.x - cursor;
    if (w >= MIN_PLATFORM_W) {
      platforms.push({ x: cursor, y: FLOOR_Y, w, h: PLATFORM_H });
    } else if (w > 0 && platforms.length > 0) {
      platforms[platforms.length - 1].w += w;
    }
    cursor = crater.x + crater.w;
  }

  const tailW = levelWidth - cursor;
  if (tailW > 0) {
    platforms.push({ x: cursor, y: FLOOR_Y, w: tailW, h: PLATFORM_H });
  }

  if (platforms.length === 0) {
    platforms.push({ x: 0, y: FLOOR_Y, w: levelWidth, h: PLATFORM_H });
  }

  return platforms;
}

function obstacleBoundaries(craters, aliens) {
  const points = [];
  for (const c of craters) points.push({ x: c.x, kind: 'crater' });
  for (const a of aliens) points.push({ x: a.minX ?? a.x, kind: 'alien' });
  points.sort((a, b) => a.x - b.x);
  return points;
}

function firstCraterX(craters) {
  if (!craters.length) return levelWidthFallback();
  return Math.min(...craters.map((c) => c.x));
}

function levelWidthFallback() {
  return SCREEN_WIDTH * 10;
}

function isSafeCollectibleX(x, craters, aliens) {
  for (const c of craters) {
    if (x >= c.x - 24 && x <= c.x + c.w + 48) return false;
  }
  for (const a of aliens) {
    const min = a.minX ?? a.x;
    const max = a.maxX ?? a.x;
    if (x >= min - 100 && x <= max + 100) return false;
  }
  return true;
}

function candidateXsInRange(minX, maxX, craters, aliens, step) {
  const candidates = [];
  const lo = Math.ceil(minX);
  const hi = Math.floor(maxX);
  for (let x = lo; x <= hi; x += step) {
    if (isSafeCollectibleX(x, craters, aliens)) candidates.push(x);
  }
  return candidates;
}

function pickEvenlyFromPool(pool, count) {
  if (count === 0) return [];
  if (pool.length === 0) return [];
  if (count === 1) return [pool[Math.floor(pool.length / 2)]];

  const picked = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let idx = Math.round(i * (pool.length - 1) / (count - 1));
    while (used.has(idx) && idx < pool.length - 1) idx++;
    while (used.has(idx) && idx > 0) idx--;
    used.add(idx);
    picked.push(pool[idx]);
  }
  return picked;
}

function buildPlacementSegments(levelWidth, screenWidth, craters, aliens, platforms) {
  const spans = getPlatformSpans(platforms);
  const firstCrater = firstCraterX(craters);
  const obstacles = obstacleBoundaries(craters, aliens);
  const segments = [];

  const preCraterEnd = Math.min(firstCrater - 40, levelWidth);
  if (preCraterEnd > SPAWN_X + 60) {
    segments.push({
      id: 'pre-crater',
      min: SPAWN_X + 50,
      max: preCraterEnd - 30,
      maxItems: 1,
    });
  }

  for (let i = 0; i < obstacles.length - 1; i++) {
    const left = obstacles[i];
    const right = obstacles[i + 1];
    const leftEdge = left.kind === 'crater' ? left.x + CRATER_W + 50 : (aliens.find((a) => (a.minX ?? a.x) === left.x)?.maxX ?? left.x) + 70;
    const rightEdge = right.x - 50;
    if (rightEdge - leftEdge > 80) {
      segments.push({
        id: `gap-${i}`,
        min: leftEdge,
        max: rightEdge,
        maxItems: 2,
      });
    }
  }

  if (obstacles.length > 0) {
    const last = obstacles[obstacles.length - 1];
    const lastEnd =
      last.kind === 'crater'
        ? last.x + CRATER_W + 50
        : (aliens.find((a) => (a.minX ?? a.x) === last.x)?.maxX ?? last.x) + 70;
    segments.push({
      id: 'tail',
      min: lastEnd,
      max: levelWidth - screenWidth * 0.08,
      maxItems: 99,
    });
  } else {
    segments.push({
      id: 'open',
      min: SPAWN_X + 50,
      max: levelWidth - screenWidth * 0.08,
      maxItems: 99,
    });
  }

  for (const seg of segments) {
    seg.candidates = [];
    for (const span of spans) {
      const lo = Math.max(seg.min, span.min);
      const hi = Math.min(seg.max, span.max);
      if (lo < hi) {
        seg.candidates.push(...candidateXsInRange(lo, hi, craters, aliens, 64));
      }
    }
    seg.candidates = [...new Set(seg.candidates)].sort((a, b) => a - b);
  }

  return segments.filter((s) => s.candidates.length > 0 || s.id === 'tail');
}

function allocateItemsToSegments(segments, totalCount) {
  const allocation = segments.map(() => 0);
  let remaining = totalCount;

  const preIdx = segments.findIndex((s) => s.id === 'pre-crater');
  if (preIdx >= 0 && remaining > 0) {
    allocation[preIdx] = 1;
    remaining--;
  }

  const middleIndices = segments
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.id !== 'pre-crater' && s.id !== 'tail')
    .map(({ i }) => i);

  while (remaining > 0 && middleIndices.some((i) => allocation[i] < segments[i].maxItems)) {
    let placed = false;
    for (const i of middleIndices) {
      if (allocation[i] < segments[i].maxItems && remaining > 0) {
        allocation[i]++;
        remaining--;
        placed = true;
      }
    }
    if (!placed) break;
  }

  const tailIdx = segments.findIndex((s) => s.id === 'tail' || s.id === 'open');
  if (tailIdx >= 0) {
    allocation[tailIdx] += remaining;
  } else if (remaining > 0 && segments.length > 0) {
    allocation[segments.length - 1] += remaining;
  }

  return allocation;
}

function generateCollectibles(levelConfig, levelWidth, screenWidth, craters, aliens, platforms, floatPickups) {
  floatPickups = floatPickups ?? [];
  const floatCounts = {
    microbe: floatPickups.filter((p) => p.type === 'microbe').length,
    mineral: floatPickups.filter((p) => p.type === 'mineral').length,
    water: floatPickups.filter((p) => p.type === 'water').length,
  };

  const adjusted = {
    goodCells: levelConfig.collectibles.goodCells - floatCounts.microbe,
    gems: levelConfig.collectibles.gems - floatCounts.mineral,
    water: levelConfig.collectibles.water - floatCounts.water,
  };

  const totalGround = totalCollectibleCount(adjusted);
  const types = interleaveCollectibleTypes(adjusted);
  const segments = buildPlacementSegments(levelWidth, screenWidth, craters, aliens, platforms);
  const allocation = allocateItemsToSegments(segments, totalGround);

  let placedPositions = [];
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    const count = allocation[si];
    if (count === 0) continue;

    let pool = seg.candidates;
    if (pool.length === 0) {
      pool = candidateXsInRange(seg.min, seg.max, craters, aliens, 48);
    }
    placedPositions.push(...pickEvenlyFromPool(pool, count));
  }

  while (placedPositions.length < totalGround) {
    const x = levelWidth - screenWidth * (0.12 + placedPositions.length * 0.04);
    if (isSafeCollectibleX(x, craters, aliens)) placedPositions.push(Math.round(x));
    else break;
  }

  placedPositions.sort((a, b) => a - b);
  placedPositions = placedPositions.slice(0, totalGround);

  if (placedPositions.length > 0 && totalGround > 0) {
    const finalX = clamp(
      levelWidth - screenWidth * 0.12,
      segments[segments.length - 1]?.min ?? SPAWN_X + 80,
      levelWidth - 80
    );
    let best = placedPositions[placedPositions.length - 1];
    let bestDist = Math.abs(best - finalX);
    for (const seg of segments) {
      for (const c of seg.candidates) {
        const d = Math.abs(c - finalX);
        if (d < bestDist && isSafeCollectibleX(c, craters, aliens)) {
          best = c;
          bestDist = d;
        }
      }
    }
    placedPositions[placedPositions.length - 1] = best;
  }

  let gemIndex = 0;
  const items = types.map((type, i) => {
    const entry = { type, x: placedPositions[i] ?? SPAWN_X + 80 + i * 120 };
    if (type === 'mineral') {
      entry.inRock = shouldGemBeInRock(gemIndex, adjusted.gems, levelConfig.level);
      gemIndex++;
    }
    return entry;
  });

  for (const p of floatPickups) {
    items.push({
      type: p.type,
      x: p.x,
      y: p.y,
      rockY: p.rockY,
      inRock: !!p.inRock,
    });
  }

  return items;
}

function buildAerialContent(levelConfig, levelWidth, screenWidth) {
  if (!levelConfig.floatingPlatforms) {
    return { floatingPlatforms: [], floatPickups: [] };
  }

  const screens = levelWidth / screenWidth;
  const slots = [
    {
      screenFrac: 0.32,
      platform: { y: 368, w: 120, h: 36 },
      pickup: { type: 'mineral', y: 350, rockY: 368, inRock: true },
    },
    {
      screenFrac: 0.52,
      platform: { y: 338, w: 105, h: 36 },
      pickup: { type: 'water', y: 320 },
    },
    {
      screenFrac: 0.72,
      platform: { y: 358, w: 115, h: 36 },
      pickup: { type: 'microbe', y: 340 },
    },
  ];

  const floatingPlatforms = [];
  const floatPickups = [];

  for (const slot of slots) {
    const centerX = Math.round(screens * slot.screenFrac * screenWidth);
    const platX = centerX - Math.round(slot.platform.w / 2);
    floatingPlatforms.push({ x: platX, y: slot.platform.y, w: slot.platform.w, h: slot.platform.h });
    floatPickups.push({
      ...slot.pickup,
      x: centerX,
    });
  }

  return { floatingPlatforms, floatPickups };
}

function interleaveCollectibleTypes(collectibles) {
  const buckets = {
    microbe: Array(collectibles.goodCells).fill('microbe'),
    mineral: Array(collectibles.gems).fill('mineral'),
    water: Array(collectibles.water).fill('water'),
  };
  const order = [];
  const max = Math.max(buckets.microbe.length, buckets.mineral.length, buckets.water.length);
  for (let i = 0; i < max; i++) {
    for (const type of ['microbe', 'mineral', 'water']) {
      if (buckets[type].length > 0) order.push(buckets[type].shift());
    }
  }
  return order;
}

function shouldGemBeInRock(gemIndex, totalGems, level) {
  if (level <= 2) return false;
  if (totalGems <= 1) return false;
  return gemIndex < totalGems - 1;
}

function countSpawnedByType(items) {
  const counts = { goodCells: 0, gems: 0, water: 0 };
  for (const item of items) {
    if (item.type === 'microbe') counts.goodCells++;
    else if (item.type === 'mineral') counts.gems++;
    else counts.water++;
  }
  return counts;
}

function assertSpawnMatchesRequired(cfg, collectibles) {
  const spawned = countSpawnedByType(collectibles);
  const req = cfg.collectibles;
  const ok =
    spawned.goodCells === req.goodCells &&
    spawned.gems === req.gems &&
    spawned.water === req.water;
  if (!ok) {
    console.error(`[Project Ark-3] Level ${cfg.level} collectible mismatch`, { required: req, spawned });
  }
  return ok;
}

function assertPlacementRules(cfg, levelWidth, screenWidth, craters, aliens, collectibles) {
  const ground = collectibles.filter((c) => !(c.y && c.y < 400));
  const firstCrater = firstCraterX(craters);
  const beforeFirst = ground.filter((c) => c.x < firstCrater - 20);
  if (beforeFirst.length > 1) {
    console.warn(
      `[Project Ark-3] Level ${cfg.level}: ${beforeFirst.length} pickups before first crater (expected ≤1)`
    );
  }

  const obstacles = obstacleBoundaries(craters, aliens);
  for (let i = 0; i < obstacles.length - 1; i++) {
    const leftX = obstacles[i].x;
    const rightX = obstacles[i + 1].x;
    const between = ground.filter((c) => c.x > leftX + 40 && c.x < rightX - 40);
    if (between.length > 2) {
      console.warn(
        `[Project Ark-3] Level ${cfg.level}: ${between.length} pickups between obstacles at ${leftX}-${rightX} (expected ≤2)`
      );
    }
  }

  if (ground.length > 0) {
    const last = ground.reduce((a, b) => (a.x > b.x ? a : b));
    const expectedMin = levelWidth - screenWidth * 0.25;
    if (last.x < expectedMin) {
      console.warn(
        `[Project Ark-3] Level ${cfg.level}: final pickup at ${last.x}, expected near ${levelWidth} (≥${expectedMin})`
      );
    }
  }
}

function generateLevel(levelConfig, screenWidth = SCREEN_WIDTH) {
  const levelNumber = levelConfig.level;
  const levelWidth = screenWidth * levelNumber;
  const { craters, aliens, groundPlatforms, resolved } = generateObstacles(
    levelConfig,
    levelWidth,
    screenWidth
  );
  const { floatingPlatforms, floatPickups } = buildAerialContent(levelConfig, levelWidth, screenWidth);
  const platforms = [...groundPlatforms, ...floatingPlatforms];
  const collectibles = generateCollectibles(
    levelConfig,
    levelWidth,
    screenWidth,
    craters,
    aliens,
    groundPlatforms,
    floatPickups
  );

  assertSpawnMatchesRequired(levelConfig, collectibles);
  assertPlacementRules(
    levelConfig,
    levelWidth,
    screenWidth,
    craters,
    aliens,
    collectibles
  );

  return {
    level: levelConfig.level,
    name: levelConfig.name,
    width: levelWidth,
    spawnX: SPAWN_X,
    required: {
      goodCells: levelConfig.collectibles.goodCells,
      gems: levelConfig.collectibles.gems,
      water: levelConfig.collectibles.water,
    },
    platforms,
    craters,
    aliens,
    asteroids: levelConfig.hazards.asteroidsEnabled,
    asteroidRate: resolved.asteroidRate,
    asteroidSpeed: resolved.asteroidSpeed,
    maxAsteroids: resolved.maxAsteroids,
    collectibles,
  };
}

const LEVELS = LEVEL_CONFIG.map((cfg) => generateLevel(cfg));
