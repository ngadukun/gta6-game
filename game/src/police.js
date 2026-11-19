// police.js — the Sunhaven Police Department.
//
// Two halves. The wanted level: a pot of heat that witnessed crime fills
// and obscurity slowly drains. And the force itself: Interceptors that
// answer the stars, navigate the road grid while the chase is far away,
// hunt in the open when it is close, and win the day not with gunfire —
// the SHD does not shoot — but by holding Leo still long enough.
import { BUST_TIME, COLS, COP_SIGHT_RANGE, HEAT_DECAY, HEAT_PER_STAR, MAX_STARS, ROWS, wrapAngle } from './config.js';
import { laneTarget, makeCar, POLICE_TYPE, stepCarPhysics } from './vehicles.js';
import { nearestIntersection, roadCenterX, roadCenterY } from './city.js';

export class WantedLevel {
  constructor() {
    this.heat = 0;
    this.seenT = 99;   // seconds since an officer last laid eyes on Leo
    this.bustT = 0;    // seconds the bust conditions have held, unbroken
  }

  get stars() {
    return Math.min(MAX_STARS, Math.floor(this.heat / HEAT_PER_STAR));
  }

  /** File a witnessed crime. A star is a hundred points; the pot has a lid. */
  addCrime(points) {
    this.heat = Math.min(MAX_STARS * HEAT_PER_STAR + 60, this.heat + points);
  }

  /** One step of memory: seen, the clock resets; unseen long enough, the
   * heat bleeds — slowly at first, faster once the trail is truly cold. */
  update(dt, seen) {
    if (seen) {
      this.seenT = 0;
      return;
    }
    this.seenT += dt;
    if (this.seenT > 6) {
      const rate = this.seenT > 14 ? HEAT_DECAY * 2.2 : HEAT_DECAY;
      this.heat = Math.max(0, this.heat - rate * dt);
    }
  }

  clear() {
    this.heat = 0;
    this.bustT = 0;
  }
}

// How many Interceptors each star level sends out of the station.
const COPS_BY_STARS = [0, 1, 2, 3, 4, 6];

export class PoliceForce {
  constructor() {
    this.units = [];   // { car, stuckT, recover, nav }
  }

  get cars() {
    return this.units.map((u) => u.car);
  }

  /** True when any unit is within r of a point (main asks this about the
   * siren: the SHD only sounds close when it is close). */
  anyWithin(x, y, r) {
    return this.units.some((u) => Math.hypot(u.car.x - x, u.car.y - y) < r);
  }

  /** Size the force to the stars, drive every unit, and judge the bust.
   * Returns true when any officer can currently see the suspect. */
  update(dt, game) {
    const { city, player, wanted } = game;
    const target = player.car ?? player;
    const want = COPS_BY_STARS[wanted.stars];

    // A wrecked Interceptor is out of the chase: it stays on the street
    // as a wreck, but it no longer drives, no longer counts as eyes on
    // Leo, and no longer blocks a live replacement from being sent.
    const live = this.units.reduce((n, u) => n + (u.car.dead ? 0 : 1), 0);
    if (live < want) this.spawnNear(game);

    // No stars, no chase: units too far away to matter give up and leave.
    if (want === 0) {
      this.units = this.units.filter((u) => Math.hypot(u.car.x - target.x, u.car.y - target.y) < 700);
      for (const u of this.units) u.car.brakeLight = false;
    }

    let seen = false;
    let bustDanger = false;
    for (const unit of this.units) {
      const car = unit.car;
      if (car.dead) continue;   // a wreck watches nothing and goes nowhere
      const dx = target.x - car.x;
      const dy = target.y - car.y;
      const dist = Math.hypot(dx, dy);
      if (dist < COP_SIGHT_RANGE) seen = true;
      if (want === 0) continue;

      // Wedged detection: full throttle at walking pace means a wall
      // won. The unit gives up on the spot, reverses out, and makes for
      // the nearest intersection to start again.
      if (dist > 120 && Math.abs(car.speed) < 22) unit.stuckT = (unit.stuckT ?? 0) + dt;
      else unit.stuckT = 0;
      if ((unit.stuckT ?? 0) > 0.9 && !unit.recover) {
        const ci = nearestIntersection(car.x, COLS);
        const ri = nearestIntersection(car.y, ROWS);
        unit.recover = { x: roadCenterX(ci), y: roadCenterY(ri), t: 3, backT: 0.45 };
        unit.stuckT = 0;
      }

      // Where to aim. Three regimes: recovering (to the intersection it
      // chose), navigating (road by road toward the suspect's block,
      // while the chase is still far away), and hunting (straight at
      // where the suspect is about to be).
      const pci = nearestIntersection(target.x, COLS);
      const pri = nearestIntersection(target.y, ROWS);
      const hereC = nearestIntersection(car.x, COLS);
      const hereR = nearestIntersection(car.y, ROWS);
      const onRoads = !unit.recover && dist > 300 && (pci !== hereC || pri !== hereR);

      let aimX;
      let aimY;
      let recovering = false;
      let navving = false;
      if (unit.recover) {
        unit.recover.t -= dt;
        aimX = unit.recover.x;
        aimY = unit.recover.y;
        recovering = true;
        if (Math.hypot(aimX - car.x, aimY - car.y) < 48 || unit.recover.t <= 0) unit.recover = null;
      } else if (onRoads) {
        navving = true;
        if (!unit.nav) unit.nav = { ci: hereC, ri: hereR, dirX: 1, dirY: 0 };
        const nav = unit.nav;
        let goal = laneTarget(nav.ci, nav.ri, nav.dirX, nav.dirY);
        if (Math.hypot(goal.x - car.x, goal.y - car.y) < 52) {
          // Intersection reached: step toward the suspect's block, taking
          // the longer leg of the journey first.
          let ndx = Math.sign(pci - nav.ci);
          let ndy = Math.sign(pri - nav.ri);
          if (ndx !== 0 && ndy !== 0) {
            if (Math.abs(pci - nav.ci) >= Math.abs(pri - nav.ri)) ndy = 0;
            else ndx = 0;
          }
          if (ndx === 0 && ndy === 0) { ndx = nav.dirX; ndy = nav.dirY; }
          nav.dirX = ndx;
          nav.dirY = ndy;
          nav.ci = Math.max(0, Math.min(COLS, nav.ci + ndx));
          nav.ri = Math.max(0, Math.min(ROWS, nav.ri + ndy));
          goal = laneTarget(nav.ci, nav.ri, nav.dirX, nav.dirY);
        }
        aimX = goal.x;
        aimY = goal.y;
      } else {
        const lead = Math.min(0.55, dist / 700);
        aimX = target.x + (target.vx ?? 0) * lead;
        aimY = target.y + (target.vy ?? 0) * lead;
      }

      const wantAngle = Math.atan2(aimY - car.y, aimX - car.x);
      const diff = wrapAngle(wantAngle - car.angle);
      const steer = Math.max(-1, Math.min(1, diff * 3.1));

      // A long way off, officers drive harder than the book allows. The
      // borrowed top speed is handed back before anything else sees it.
      const savedTop = car.type.top;
      if (dist > 620) car.type = { ...car.type, top: savedTop * 1.18 };

      // Facing the wrong way, a badge crawls and turns rather than
      // flooring it into the scenery.
      let throttle = Math.abs(diff) > 1.9 ? 0.22 : 1;
      let brake = false;
      if (recovering && unit.recover && unit.recover.backT > 0) {
        unit.recover.backT -= dt;
        throttle = -1;
      }
      // Close up, the craft is pace-matching: sit fifty paces off the
      // suspect's tail at his own speed, and a chase becomes an arrest.
      const targetSpeed = player.car ? Math.abs(player.car.speed) : 150;
      const desired = Math.min(car.type.top, targetSpeed + Math.max(0, Math.min(130, (dist - 55) * 1.5)));
      if (!recovering && !navving && car.speed > desired + 34) {
        throttle = 0;
        brake = true;
      } else if (!recovering && !navving && car.speed < desired - 12) {
        throttle = Math.max(throttle, 0.85);
      }
      // Alongside a stopped suspect, hold position and let the meter run.
      if (dist < 55 && Math.abs(diff) < 0.4 && Math.abs(target.speed ?? 0) < 30) {
        throttle = 0;
        brake = true;
      }
      stepCarPhysics(car, { throttle, steer, brake }, dt, city);
      car.type = { ...car.type, top: savedTop };
      car.brakeLight = brake;

      // The bust itself: Leo slow or still, an officer close, sustained.
      const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;
      if (!player.car && dist < 105) bustDanger = true;
      if (player.car && playerSpeed < 26 && dist < 88) bustDanger = true;
    }

    if (bustDanger && wanted.stars > 0) {
      wanted.bustT += dt;
      if (wanted.bustT > BUST_TIME) game.onBusted();
    } else {
      wanted.bustT = Math.max(0, wanted.bustT - dt * 1.6);
    }
    return seen;
  }

  /** Bring one more Interceptor into the world at an intersection a few
   * blocks from the suspect — close enough to matter, far enough to be a
   * surprise. If the whole neighbourhood refuses, the net widens; if it
   * still refuses, the unit simply rolls out of the station itself: a
   * star that asks for a car should always, eventually, get one. */
  spawnNear(game) {
    const { player, rng } = game;
    const target = player.car ?? player;
    const place = (ci, ri) => {
      const spot = laneTarget(ci, ri, roadCenterX(ci) < target.x ? 1 : -1, 0);
      const car = makeCar({ ...POLICE_TYPE }, spot.x, spot.y, Math.atan2(target.y - spot.y, target.x - spot.x), '#f5f7fa');
      car.isPolice = true;
      car.mass = 1.6;
      this.units.push({ car });
    };
    for (const [near, far] of [[380, 1150], [250, 1400]]) {
      for (let tries = 0; tries < 8; tries += 1) {
        const ci = Math.max(0, Math.min(COLS, nearestIntersection(target.x, COLS) + rng.int(-3, 3)));
        const ri = Math.max(0, Math.min(ROWS, nearestIntersection(target.y, ROWS) + rng.int(-3, 3)));
        const dist = Math.hypot(roadCenterX(ci) - target.x, roadCenterY(ri) - target.y);
        if (dist < near || dist > far) continue;
        place(ci, ri);
        return;
      }
    }
    const home = game.city.places.policeStation;
    place(nearestIntersection(home.x, COLS), nearestIntersection(home.y, ROWS));
  }
}
