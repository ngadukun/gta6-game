// Cars. Eight types a civilian can own (and Leo can borrow), one type only
// the SHD drives, and a single arcade physics step that all of them share —
// the player's car, the traffic and the Interceptors differ only in who or
// what is choosing the controls.
import { COLS, ROAD_W, ROWS } from './config.js';
import { collideCircle, roadCenterX, roadCenterY } from './city.js';

// w/h are the body's footprint in pixels; accel and top are px/s² and px/s;
// grip is how hard the tyres kill sideways slide; value is what Marisol's
// ledger says the car is worth.
export const CAR_TYPES = [
  { id: 'compact', name: 'Blista Compact', w: 36, h: 19, accel: 210, top: 265, grip: 9, value: 120 },
  { id: 'sedan', name: 'Primo Sedan', w: 42, h: 20, accel: 200, top: 300, grip: 9, value: 200 },
  { id: 'wagon', name: 'Regina Wagon', w: 44, h: 21, accel: 180, top: 280, grip: 8, value: 180 },
  { id: 'pickup', name: 'Sadler Pickup', w: 46, h: 22, accel: 190, top: 290, grip: 8, value: 240 },
  { id: 'sport', name: 'Futo GT', w: 42, h: 20, accel: 300, top: 395, grip: 10, value: 450 },
  { id: 'muscle', name: 'Dukes Muscle', w: 45, h: 21, accel: 270, top: 360, grip: 7, value: 400 },
  { id: 'van', name: 'Pony Van', w: 48, h: 23, accel: 160, top: 255, grip: 8, value: 220 },
  { id: 'taxi', name: 'Sun Cab', w: 42, h: 20, accel: 205, top: 300, grip: 9, value: 200 },
];
export const PAINTS = ['#d64541', '#3e7cb1', '#f2c14e', '#81b29a', '#e07a5f', '#eceff1', '#37474f', '#8e6cc8', '#4db6ac', '#f06292'];
export const POLICE_TYPE = { id: 'police', name: 'SHD Interceptor', w: 43, h: 20, accel: 265, top: 350, grip: 10, value: 0 };

let nextCarId = 1;

export function makeCar(type, x, y, angle, color) {
  return {
    id: nextCarId++, type, x, y, angle,
    vx: 0, vy: 0, speed: 0,
    color, health: 100, maxHealth: 100, driver: null, parked: false,
    brakeLight: false, dead: false,
  };
}

/**
 * Move one car one step under control {throttle -1..1, steer -1..1, brake,
 * handbrake}. The velocity is kept in forward/lateral parts: the engine
 * works on the forward part, the tyres bleed the lateral part away (slower
 * with the handbrake up — that is what a drift is), and steering only bites
 * once the car is actually rolling. Returns the impact speed when the car
 * hit a building this step, else 0.
 */
export function stepCarPhysics(car, control, dt, city) {
  const t = car.type;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let fwd = car.vx * fx + car.vy * fy;
  let lat = -car.vx * fy + car.vy * fx;

  const steerPower = Math.max(-1, Math.min(1, fwd / 120));
  car.angle += control.steer * 2.1 * steerPower * dt * (control.handbrake ? 1.5 : 1);

  if (control.brake && fwd > 10) {
    fwd -= 420 * dt;
  } else {
    fwd += control.throttle * t.accel * dt;
  }
  // Reverse is its own gear: weaker, and capped well below forward speed.
  if (control.throttle < 0 && fwd <= 10) {
    fwd = Math.max(fwd + control.throttle * t.accel * 0.6 * dt, -t.top * 0.35);
  }
  fwd -= fwd * 0.55 * dt;                        // drag
  if (!control.throttle) fwd -= fwd * 0.8 * dt;  // engine braking
  fwd = Math.max(-t.top * 0.35, Math.min(t.top, fwd));
  lat *= Math.exp(-(control.handbrake ? 2.2 : t.grip) * dt);

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * fwd - nfy * lat;
  car.vy = nfy * fwd + nfx * lat;
  car.speed = fwd;
  // Brake lights belong to the physics, not the driver: any car standing
  // on the pedal — Leo included — shows them. (Traffic and the police set
  // their own after this call, from the same control, so nothing changes
  // for them; Leo's simply start working.)
  car.brakeLight = !!(control.brake || control.handbrake);
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Buildings are tested at two probes, nose and tail, so a long car can
  // clip a corner with either end. A hard enough meeting costs health.
  let impact = 0;
  for (const s of [-0.32, 0.32]) {
    const px = car.x + nfx * t.w * s;
    const py = car.y + nfy * t.w * s;
    const fixed = collideCircle(city, px, py, t.h * 0.62);
    const dx = fixed.x - px;
    const dy = fixed.y - py;
    if (dx === 0 && dy === 0) continue;
    car.x += dx;
    car.y += dy;
    impact = Math.max(impact, Math.abs(fwd));
    fwd *= -0.22;
    car.vx = nfx * fwd - nfy * lat * 0.4;
    car.vy = nfy * fwd + nfx * lat * 0.4;
    car.speed = fwd;
  }
  // The world's edges are a wall of their own, water included.
  if (car.x < 20 || car.y < 20 || car.x > city.shoreX + 70 || car.y > city.height - 20) {
    car.x = Math.max(20, Math.min(city.shoreX + 70, car.x));
    car.y = Math.max(20, Math.min(city.height - 20, car.y));
    car.vx *= 0.4;
    car.vy *= 0.4;
  }
  if (impact > 60) car.health -= (impact - 60) * 0.06;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
  }
  return impact;
}

/** Settle every overlap between cars with an impulse along the contact
 * normal, split by mass. A fast car shoves a slow one aside instead of
 * stopping dead against it, and heavy metal — Interceptors, the armoured
 * Pony — barely notices being knocked. Hard meetings cost both cars. */
export function collideCars(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = (a.type.w + b.type.w) * 0.36;
      const d2 = dx * dx + dy * dy;
      if (d2 > min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const ma = a.mass ?? 1;
      const mb = b.mass ?? 1;
      const push = min - d;
      a.x -= nx * push * (mb / (ma + mb));
      a.y -= ny * push * (mb / (ma + mb));
      b.x += nx * push * (ma / (ma + mb));
      b.y += ny * push * (ma / (ma + mb));
      const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rvn < 0) {
        const impulse = (-1.25 * rvn) / (1 / ma + 1 / mb);
        a.vx -= (impulse / ma) * nx;
        a.vy -= (impulse / ma) * ny;
        b.vx += (impulse / mb) * nx;
        b.vy += (impulse / mb) * ny;
        if (rvn < -70) {
          a.health -= (-rvn - 70) * 0.03;
          b.health -= (-rvn - 70) * 0.03;
        }
        a.speed = a.vx * Math.cos(a.angle) + a.vy * Math.sin(a.angle);
        b.speed = b.vx * Math.cos(b.angle) + b.vy * Math.sin(b.angle);
      }
    }
  }
}

// Traffic. Every civilian car is driving to an intersection; when it gets
// there it picks the next one, mostly straight on, and drives to that.
// Right-hand traffic: the lane a car belongs in sits a quarter-road to the
// right of the centre line for its heading.
const LANE = ROAD_W / 4;

export class TrafficCar {
  constructor(car, ci, ri) {
    this.car = car;
    this.ci = ci;   // the intersection column it is heading for
    this.ri = ri;   // the intersection row
    this.dirX = 1;
    this.dirY = 0;
    this.cruise = car.type.top * 0.42;
  }
}

/** The point inside intersection (ci, ri) that a car with this heading
 * should aim at, given which side of the road it drives on. */
export function laneTarget(ci, ri, dirX, dirY) {
  const cx = roadCenterX(ci);
  const cy = roadCenterY(ri);
  if (dirX > 0) return { x: cx, y: cy + LANE };
  if (dirX < 0) return { x: cx, y: cy - LANE };
  if (dirY > 0) return { x: cx - LANE, y: cy };
  return { x: cx + LANE, y: cy };
}

export function stepTraffic(driver, dt, city, cars, rng) {
  const car = driver.car;

  const goal = laneTarget(driver.ci, driver.ri, driver.dirX, driver.dirY);
  if (Math.hypot(goal.x - car.x, goal.y - car.y) < 42) {
    // Arrived: choose the next intersection. Mostly straight on, never a
    // U-turn while a turn exists, and the choice comes off the game stream
    // so a replayed world makes the same turns.
    const options = [];
    if (driver.ci < COLS) options.push([1, 0]);
    if (driver.ci > 0) options.push([-1, 0]);
    if (driver.ri < ROWS) options.push([0, 1]);
    if (driver.ri > 0) options.push([0, -1]);
    const straight = options.filter(([ox, oy]) => ox === driver.dirX && oy === driver.dirY);
    const turns = options.filter(([ox, oy]) => !(ox === -driver.dirX && oy === -driver.dirY) && !(ox === driver.dirX && oy === driver.dirY));
    let next;
    if (straight.length && rng.chance(0.62)) next = straight[0];
    else if (turns.length) next = rng.pick(turns);
    else if (straight.length) next = straight[0];
    else next = options[0];
    driver.dirX = next[0];
    driver.dirY = next[1];
    driver.ci += next[0];
    driver.ri += next[1];
  }

  // Steer at a look-ahead point: aiming at where the nose will be, not at
  // where the car is, is what keeps the lane-keeping calm.
  const look = laneTarget(driver.ci, driver.ri, driver.dirX, driver.dirY);
  const aheadX = car.x + Math.cos(car.angle) * 30;
  const aheadY = car.y + Math.sin(car.angle) * 30;
  const want = Math.atan2(look.y - aheadY, look.x - aheadX);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));

  // Whoever is ahead sets the pace: slow for them, stop close behind them.
  let throttle = car.speed < driver.cruise ? 0.75 : 0;
  let brake = false;
  let blocked = false;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of cars) {
    if (other === car) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const forward = ox * fx + oy * fy;
    const side = Math.abs(-ox * fy + oy * fx);
    if (forward > 0 && forward < 58 && side < 16) {
      throttle = 0;
      brake = forward < 40;
      blocked = true;
      break;
    }
  }
  // Stuck behind someone long enough, a Sunhaven driver leans on the horn.
  // The flag is raised here; main plays it when the player is near enough
  // to hear, and clears it either way.
  if (blocked) {
    driver.blockedT = (driver.blockedT ?? 0) + dt;
    if (driver.blockedT > 1.4) car.honk = true;
  } else {
    driver.blockedT = 0;
  }
  car.brakeLight = brake;
  return stepCarPhysics(car, { throttle, steer, brake }, dt, city);
}

/** Deal parked cars onto the city's parking spots, a little untidily. */
export function spawnParkedCars(city, rng, count) {
  const cars = [];
  const spots = [...city.parkingSpots];
  for (let i = 0; i < count && spots.length; i += 1) {
    const spot = spots.splice(rng.int(0, spots.length - 1), 1)[0];
    const type = rng.pick(CAR_TYPES);
    const car = makeCar(
      type,
      spot.x + rng.range(-4, 4),
      spot.y + rng.range(-4, 4),
      spot.angle + rng.range(-0.05, 0.05),
      rng.pick(PAINTS),
    );
    car.parked = true;
    cars.push(car);
  }
  return cars;
}

/** Put the traffic on the roads: each car starts in its lane at one
 * intersection, aimed at the next one along its heading. */
export function spawnTraffic(city, rng, count) {
  const drivers = [];
  for (let i = 0; i < count; i += 1) {
    const ci = rng.int(0, COLS);
    const ri = rng.int(0, ROWS);
    const horizontal = rng.chance(0.5);
    const dirX = horizontal ? (rng.chance(0.5) ? 1 : -1) : 0;
    const dirY = horizontal ? 0 : (rng.chance(0.5) ? 1 : -1);
    const start = laneTarget(ci, ri, dirX, dirY);
    const type = rng.pick(CAR_TYPES);
    const car = makeCar(type, start.x, start.y, Math.atan2(dirY, dirX), rng.pick(PAINTS));
    const driver = new TrafficCar(car, ci + dirX, ri + dirY);
    driver.dirX = dirX;
    driver.dirY = dirY;
    driver.ci = Math.max(0, Math.min(COLS, driver.ci));
    driver.ri = Math.max(0, Math.min(ROWS, driver.ri));
    drivers.push(driver);
  }
  return drivers;
}
