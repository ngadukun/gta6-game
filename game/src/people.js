// People. Leo, when his own two feet are what moves him, and the thirty-odd
// pedestrians who give the pavements their life: they stroll, they wait for
// traffic like sensible citizens, and they run from trouble like sensible
// citizens too.
import { BLOCK, PITCH, PLAYER_RADIUS, PLAYER_SPRINT, PLAYER_WALK, ROAD_W } from './config.js';
import { clampToWorld, collideCircle } from './city.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, vx: 0, vy: 0,
    health: 100, car: null, dead: false,
    walkCycle: 0, moving: false,
  };
}

/** Walk Leo where the keys point: screen-relative, Shift to sprint, and
 * buildings are solid — he slides along their walls rather than through. */
export function stepPlayerOnFoot(player, input, dt, city) {
  let mx = 0;
  let my = 0;
  if (input.held('KeyW', 'ArrowUp')) my -= 1;
  if (input.held('KeyS', 'ArrowDown')) my += 1;
  if (input.held('KeyA', 'ArrowLeft')) mx -= 1;
  if (input.held('KeyD', 'ArrowRight')) mx += 1;

  const len = Math.hypot(mx, my);
  player.moving = len > 0;
  if (len > 0) {
    const speed = input.held('ShiftLeft', 'ShiftRight') ? PLAYER_SPRINT : PLAYER_WALK;
    mx = (mx / len) * speed;
    my = (my / len) * speed;
    player.angle = Math.atan2(my, mx);
    player.walkCycle += dt * speed * 0.055;
  }
  player.x += mx * dt;
  player.y += my * dt;
  const out = collideCircle(city, player.x, player.y, PLAYER_RADIUS);
  const inside = clampToWorld(city, out.x, out.y, PLAYER_RADIUS);
  player.x = inside.x;
  player.y = inside.y;
}

const PED_SHIRTS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#c77dff', '#f4f1de', '#e07a5f'];
const PED_SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

/** A spot on the pavement ring around a random block — the natural habitat
 * of the Sunhaven pedestrian. */
function pavementPoint(rng) {
  const col = rng.int(0, 8);
  const row = rng.int(0, 6);
  const bx = col * PITCH + ROAD_W;
  const by = row * PITCH + ROAD_W;
  const side = rng.int(0, 3);
  const t = rng.range(0, BLOCK);
  const off = 8;
  switch (side) {
    case 0: return { x: bx + t, y: by - off };
    case 1: return { x: bx + t, y: by + BLOCK + off };
    case 2: return { x: bx - off, y: by + t };
    default: return { x: bx + BLOCK + off, y: by + t };
  }
}

export function spawnPeds(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const start = pavementPoint(rng);
    const angle = rng.angle();
    const speed = rng.range(52, 78);
    const shirt = rng.pick(PED_SHIRTS);
    const skin = rng.pick(PED_SKIN);
    const target = pavementPoint(rng);
    peds.push({
      x: start.x, y: start.y, angle, speed, shirt, skin, target,
      state: 'walk', stateT: 0, threat: null, walkCycle: rng.range(0, 6),
    });
  }
  return peds;
}

/**
 * Advance the pedestrians. `danger`, when given, is a point where something
 * violent just happened — a shot, a crash — and anyone close enough to have
 * seen it runs. Cars bearing down on a walker make the walker stop and let
 * them pass; the dead and the downed keep their own counsel.
 */
export function stepPeds(peds, dt, city, rng, danger, cars = []) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.stateT -= dt;
      if (ped.stateT <= 0) ped.state = 'walk';
      continue;
    }

    if (danger && ped.state !== 'flee') {
      const d = Math.hypot(ped.x - danger.x, ped.y - danger.y);
      if (d < 190) {
        ped.state = 'flee';
        ped.stateT = rng.range(1.6, 3);
        ped.threat = { x: danger.x, y: danger.y };
      }
    }

    let tx;
    let ty;
    let speed = ped.speed;
    if (ped.state === 'flee') {
      ped.stateT -= dt;
      if (ped.stateT <= 0) {
        ped.state = 'walk';
        ped.target = pavementPoint(rng);
      }
      tx = ped.x + (ped.x - ped.threat.x);
      ty = ped.y + (ped.y - ped.threat.y);
      speed = 175;
    } else {
      tx = ped.target.x;
      ty = ped.target.y;
      if (Math.hypot(tx - ped.x, ty - ped.y) < 12) ped.target = pavementPoint(rng);
      // Pavement sense: freeze for a fast car on a collision line. The
      // cheap squared-distance reject comes first — most cars in the city
      // are nowhere near this walker and never need the trigonometry.
      for (const car of cars) {
        if (Math.abs(car.speed) < 90) continue;
        const cdx = car.x - ped.x;
        const cdy = car.y - ped.y;
        if (cdx * cdx + cdy * cdy > 86 * 86) continue;
        const ax = car.x + Math.cos(car.angle) * 52 - ped.x;
        const ay = car.y + Math.sin(car.angle) * 52 - ped.y;
        if (ax * ax + ay * ay < 34 * 34) {
          speed = 0;
          break;
        }
      }
    }

    const want = Math.atan2(ty - ped.y, tx - ped.x);
    let diff = want - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    ped.walkCycle += dt * speed * 0.06;
    const out = collideCircle(city, ped.x, ped.y, 9);
    const inside = clampToWorld(city, out.x, out.y, 9);
    ped.x = inside.x;
    ped.y = inside.y;
  }
}

/** Put a pedestrian on the ground (a car usually did it). They lie there a
 * few seconds, then get up and pretend it never happened. */
export function knockDown(ped, rng) {
  ped.state = 'down';
  ped.stateT = rng.range(2.5, 4.5);
}
