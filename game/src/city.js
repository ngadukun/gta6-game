// city.js — Sunhaven's ground truth.
//
// The road grid, the blocks and what stands on them, the beach, the
// waterline, and the named places the story keeps sending Leo back to.
// One seeded build is shared by physics, traffic, the renderer and the
// minimap, so no two parts of the game can disagree about where a wall is.
import { BLOCK, CITY_W, COLS, DISTRICT_NAMES, PITCH, ROAD_W, ROWS, WORLD_H, WORLD_W } from './config.js';

// Roof and wall paints, dealt by district: downtown pale and glassy, the
// suburbs cheerful, the beachfront bleached by salt air, the docks the
// colours of tar, rope and rust.
const ROOF_PAINTS = {
  downtown: ['#e8e3d8', '#d9dee2', '#e6d7c3', '#cfd8dc', '#efe6da'],
  suburb: ['#f2c14e', '#ef8354', '#f4f1de', '#e07a5f', '#81b29a', '#f2cc8f'],
  beach: ['#fdf0d5', '#f4e1c1', '#ffe8d6', '#faf3dd'],
  docks: ['#b08968', '#7f5539', '#9c6644', '#6c757d'],
};
const WALL_PAINTS = {
  downtown: ['#b8c4ce', '#a8b6c2', '#c9b8a3', '#9fb3c8'],
  suburb: ['#e9c46a', '#e76f51', '#f4f1de', '#2a9d8f', '#e9e5d6'],
  beach: ['#f7ede2', '#f5cac3', '#f6bd60', '#f7ede2'],
  docks: ['#6c5849', '#5e503f', '#746855'],
};

/** Which district owns a block. The south-east corner is the docks, the
 * easternmost column fronts the beach, the middle blocks are downtown,
 * and everything else is the suburbs. */
export function districtOf(col, row) {
  if (row === ROWS - 1 && col >= 6) return 'docks';
  if (col === COLS - 1) return 'beach';
  if (col >= 3 && col <= 5 && row >= 2 && row <= 4) return 'downtown';
  return 'suburb';
}

/** Centre lines: vertical road c runs at this x, horizontal road r at this y. */
export function roadCenterX(c) { return c * PITCH + ROAD_W / 2; }
export function roadCenterY(r) { return r * PITCH + ROAD_W / 2; }

/**
 * Build the whole city from the stream. The order of the draws below IS
 * the city: rearrange a single one and seed 7 grows a different town.
 */
export function buildCity(rng) {
  const buildings = [];
  const palms = [];
  const parkingSpots = [];
  const crates = [];
  const lamps = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const district = districtOf(col, row);
      const bx = col * PITCH + ROAD_W;
      const by = row * PITCH + ROAD_W;
      const roll = rng.next();

      // One block in twelve is left a park: grass, palms, nothing to hit.
      if (roll < 0.08) {
        for (let i = 0; i < 7; i += 1) {
          palms.push({ x: bx + rng.range(24, BLOCK - 24), y: by + rng.range(24, BLOCK - 24), park: true });
        }
        continue;
      }
      // A few more are parking lots — home of the borrowable cars.
      if (roll < 0.2) {
        for (let sx = 0; sx < 3; sx += 1) {
          for (let sy = 0; sy < 2; sy += 1) {
            parkingSpots.push({ x: bx + 52 + sx * 92, y: by + 70 + sy * 130, angle: Math.PI / 2 });
          }
        }
        continue;
      }

      const inset = 16;
      const inner = BLOCK - inset * 2;
      if (district === 'downtown') {
        // Four towers to a block, tall enough to throw the long shadows.
        for (let sx = 0; sx < 2; sx += 1) {
          for (let sy = 0; sy < 2; sy += 1) {
            const w = inner / 2 - 10;
            const height = rng.range(46, 92);
            const wall = rng.pick(WALL_PAINTS.downtown);
            const roof = rng.pick(ROOF_PAINTS.downtown);
            buildings.push({
              x: bx + inset + sx * (inner / 2 + 4), y: by + inset + sy * (inner / 2 + 4),
              w, h: w, height, wall, roof, district,
            });
          }
        }
      } else if (district === 'docks') {
        // One long warehouse per block, and crates stacked in its yard.
        const height = rng.range(20, 30);
        const wall = rng.pick(WALL_PAINTS.docks);
        const roof = rng.pick(ROOF_PAINTS.docks);
        buildings.push({ x: bx + inset, y: by + inset + 30, w: inner, h: 120, height, wall, roof, district });
        for (let i = 0; i < 6; i += 1) {
          crates.push({ x: bx + rng.range(20, BLOCK - 44), y: by + rng.range(190, BLOCK - 44), s: rng.range(22, 34) });
        }
      } else {
        // Houses and small shops: four to a block, gardens between.
        for (let sx = 0; sx < 2; sx += 1) {
          for (let sy = 0; sy < 2; sy += 1) {
            const w = inner / 2 - 16;
            const h = w * rng.range(0.75, 1);
            const height = rng.range(10, 22);
            const wall = rng.pick(WALL_PAINTS[district]);
            const roof = rng.pick(ROOF_PAINTS[district]);
            buildings.push({
              x: bx + inset + 8 + sx * (inner / 2 + 8), y: by + inset + 8 + sy * (inner / 2 + 8),
              w, h, height, wall, roof, district,
            });
          }
        }
        if (rng.chance(0.6)) {
          palms.push({ x: bx + rng.range(16, BLOCK - 16), y: by + rng.range(16, BLOCK - 16) });
        }
      }
    }
  }

  // A line of palms along the promenade, where pavement meets sand.
  for (let y = 60; y < WORLD_H - 40; y += 92) {
    palms.push({ x: CITY_W + 26, y: y + rng.range(-8, 8) });
  }

  // Street lamps down every avenue, alternating sides the way a council
  // with a spreadsheet would place them.
  for (let c = 0; c <= COLS; c += 1) {
    for (let y = 120; y < WORLD_H - 60; y += 230) {
      const side = Math.floor(y / 230) % 2 === 0 ? -ROAD_W / 2 + 7 : ROAD_W / 2 - 7;
      lamps.push({ x: roadCenterX(c) + side, y });
    }
  }

  // The named places. Each is a point on open ground beside its building,
  // addressed the way the story addresses it: from the road to its south.
  const southRoadOf = (col, row) => ({ x: col * PITCH + ROAD_W + BLOCK / 2, y: row * PITCH + ROAD_W + BLOCK + ROAD_W / 2 });
  const places = {
    chopShop: { x: roadCenterX(1), y: southRoadOf(1, 5).y, name: 'Vega Auto Works' },
    docks: { x: roadCenterX(7), y: southRoadOf(7, 6).y, name: 'Sunhaven Docks' },
    hotel: { x: CITY_W - 40, y: southRoadOf(8, 1).y, name: 'Coral Court Hotel' },
    bank: { x: roadCenterX(4), y: southRoadOf(4, 3).y, name: 'Sunhaven Trust Bank' },
    policeStation: { x: roadCenterX(2), y: southRoadOf(2, 2).y, name: 'SHD Station' },
    hospital: { x: roadCenterX(6), y: southRoadOf(6, 2).y, name: 'St. Palma Hospital' },
    hideout: { x: roadCenterX(0) + 30, y: southRoadOf(0, 0).y, name: 'Leo’s Hideout' },
    marina: { x: CITY_W - 30, y: southRoadOf(8, 5).y, name: 'Palma Marina' },
  };

  return {
    buildings, palms, parkingSpots, crates, places, lamps,
    shoreX: CITY_W + 250,
    width: WORLD_W,
    height: WORLD_H,
  };
}

/** The index of the intersection nearest to a world coordinate along
 * one axis, clamped to the grid: 0..max. The police navigate by it. */
export function nearestIntersection(value, max) {
  return Math.max(0, Math.min(max, Math.round(value / PITCH)));
}

/** The block a world point falls in, clamped to the grid: {col, row}. */
export function blockAt(x, y) {
  return {
    col: Math.max(0, Math.min(COLS - 1, Math.floor((x - ROAD_W) / PITCH))),
    row: Math.max(0, Math.min(ROWS - 1, Math.floor((y - ROAD_W) / PITCH))),
  };
}

/** The district a world point stands in. Anything east of the last road —
 * sand, boardwalk, open water — is the beachfront's business. */
export function districtNameAt(city, x, y) {
  if (x >= CITY_W) return DISTRICT_NAMES.beach;
  const { col, row } = blockAt(x, y);
  return DISTRICT_NAMES[districtOf(col, row)];
}

/** Push a circle out of every building it overlaps and hand back where it
 * ended up. A centre already inside a building leaves by the nearest face;
 * any other overlap slides out along the line to the nearest point. */
export function collideCircle(city, x, y, r) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r;
      y = ny + (dy / d) * r;
    } else {
      const left = x - b.x;
      const right = b.x + b.w - x;
      const top = y - b.y;
      const bottom = b.y + b.h - y;
      const nearest = Math.min(left, right, top, bottom);
      if (nearest === left) x = b.x - r;
      else if (nearest === right) x = b.x + b.w + r;
      else if (nearest === top) y = b.y - r;
      else y = b.y + b.h + r;
    }
  }
  return { x, y };
}

/** Keep a point inside the world and out of the sea: the shore is as far
 * east as anything on legs or wheels is allowed to go. */
export function clampToWorld(city, x, y, r) {
  return {
    x: Math.max(r, Math.min(city.shoreX + 60, x)),
    y: Math.max(r, Math.min(city.height - r, y)),
  };
}
