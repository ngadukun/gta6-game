// The Sunhaven Police Department: the wanted level that crimes feed, and the
// Interceptors that answer it. Heat rises with every witnessed crime, cools
// when no officer can see Leo, and the stars decide how many cars give chase.
import { COLS, HEAT_DECAY, HEAT_PER_STAR, MAX_STARS, PITCH, ROWS } from './config.js';
import { laneTarget, makeCar, POLICE_TYPE, stepCarPhysics } from './vehicles.js';
import { roadCenterX, roadCenterY } from './city.js';

export class WantedLevel {
  constructor() {
    this.heat = 0;
    this.seenT = 99;   // seconds since an officer last had eyes on Leo
    this.bustT = 0;    // how long the bust conditions have held
  }

  get stars() {
    return Math.min(MAX_STARS, Math.floor(this.heat / HEAT_PER_STAR));
  }

  /** A witnessed crime. Points: a star is 100. */
  addCrime(points) {
    this.heat = Math.min(MAX_STARS * HEAT_PER_STAR + 60, this.heat + points);
  }

  update(dt, seen) {
    if (seen) this.seenT = 0;
    else {
      this.seenT += dt;
      if (this.seenT > 6) this.heat = Math.max(0, this.heat - HEAT_DECAY * dt * (this.seenT > 14 ? 2.2 : 1));
    }
  }

  clear() {
    this.heat = 0;
    this.bustT = 0;
  }
}

const COPS_BY_STARS = [0, 1, 2, 3, 4, 6];

export class PoliceForce {
  constructor() {
    this.units = [];   // { car, stuck }
  }

  get cars() {
    return this.units.map((u) => u.car);
  }

  /** Keep the force sized to the wanted level; chase; test for a bust. */
  update(dt, game) {
    const { city, player, wanted, rng } = game;
    const target = player.car ?? player;
    const want = COPS_BY_STARS[wanted.stars];

    // Spawn reinforcements at intersections a few blocks away.
    if (this.units.length < want) {
      this.spawnNear(game);
    }
    // When the heat is gone, units far away give up and leave the world.
    if (want === 0) {
      this.units = this.units.filter((u) => Math.hypot(u.car.x - target.x, u.car.y - target.y) < 700);
      for (const u of this.units) u.car.brakeLight = false;
    }

    let seen = false;
    let bustDanger = false;
    for (const unit of this.units) {
      const car = unit.car;
      const dx = target.x - car.x;
      const dy = target.y - car.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 360) seen = true;

      if (want === 0) continue;
      // Stuck detection: a badge grinding a wall at walking pace is no use to
      // anyone. It backs out and makes for the nearest intersection instead.
      if (dist > 120 && Math.abs(car.speed) < 22) unit.stuckT = (unit.stuckT ?? 0) + dt;
      else unit.stuckT = 0;
      if ((unit.stuckT ?? 0) > 0.9 && !unit.recover) {
        const ci = Math.max(0, Math.min(COLS, Math.round(car.x / PITCH)));
        const ri = Math.max(0, Math.min(ROWS, Math.round(car.y / PITCH)));
        unit.recover = { x: roadCenterX(ci), y: roadCenterY(ri), t: 3, backT: 0.45 };
        unit.stuckT = 0;
      }

      // Far away, a badge takes the roads like everyone else: intersection to
      // intersection toward the suspect's block. Close up, it hunts directly.
      const pci = Math.max(0, Math.min(COLS, Math.round(target.x / PITCH)));
      const pri = Math.max(0, Math.min(ROWS, Math.round(target.y / PITCH)));
      const hereC = Math.max(0, Math.min(COLS, Math.round(car.x / PITCH)));
      const hereR = Math.max(0, Math.min(ROWS, Math.round(car.y / PITCH)));
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
          // At the intersection: step toward the suspect's, the longer leg first.
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
        // Pursuit: aim where the target will be, not where it is.
        const lead = Math.min(0.55, dist / 700);
        aimX = target.x + (target.vx ?? 0) * lead;
        aimY = target.y + (target.vy ?? 0) * lead;
      }
      const wantAngle = Math.atan2(aimY - car.y, aimX - car.x);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 3.1));
      // Far away, officers drive harder than the book allows (catch-up).
      const savedTop = car.type.top;
      if (dist > 620) car.type = { ...car.type, top: savedTop * 1.18 };
      // A badge does not floor it facing the wrong way: crawl and turn first.
      let throttle = Math.abs(diff) > 1.9 ? 0.22 : 1;
      let brake = false;
      if (recovering && unit.recover && unit.recover.backT > 0) {
        unit.recover.backT -= dt;
        throttle = -1;   // reverse out of the wedge first
      }
      // Close in, match the suspect's pace: a tail held at fifty paces is
      // what turns a chase into a bust.
      const targetSpeed = player.car ? Math.abs(player.car.speed) : 150;
      const desired = Math.min(car.type.top, targetSpeed + Math.max(0, Math.min(130, (dist - 55) * 1.5)));
      if (!recovering && !navving && car.speed > desired + 34) {
        throttle = 0;
        brake = true;
      } else if (!recovering && !navving && car.speed < desired - 12) {
        throttle = Math.max(throttle, 0.85);
      }
      if (dist < 55 && Math.abs(diff) < 0.4 && Math.abs(target.speed ?? 0) < 30) {
        throttle = 0;   // alongside a stopped suspect: hold position for the bust
        brake = true;
      }
      stepCarPhysics(car, { throttle, steer, brake }, dt, city);
      car.type = { ...car.type, top: savedTop };
      car.brakeLight = brake;

      // Bust conditions: Leo on foot and slow, or his car pinned, with a unit close.
      const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;
      if (!player.car && dist < 105) bustDanger = true;
      if (player.car && playerSpeed < 26 && dist < 88) bustDanger = true;
    }

    if (bustDanger && wanted.stars > 0) {
      wanted.bustT += dt;
      if (wanted.bustT > 2.4) game.onBusted();
    } else {
      wanted.bustT = Math.max(0, wanted.bustT - dt * 1.6);
    }
    return seen;
  }

  spawnNear(game) {
    const { city, player, rng } = game;
    const target = player.car ?? player;
    // Pick an intersection 2-4 blocks away, preferring one off-screen.
    for (let tries = 0; tries < 8; tries += 1) {
      const ci = Math.max(0, Math.min(COLS, Math.round(target.x / PITCH) + rng.int(-3, 3)));
      const ri = Math.max(0, Math.min(ROWS, Math.round(target.y / PITCH) + rng.int(-3, 3)));
      const x = roadCenterX(ci);
      const y = roadCenterY(ri);
      const dist = Math.hypot(x - target.x, y - target.y);
      if (dist < 380 || dist > 1150) continue;
      const dirX = x < target.x ? 1 : -1;
      const spot = laneTarget(ci, ri, dirX, 0);
      const car = makeCar({ ...POLICE_TYPE }, spot.x, spot.y, Math.atan2(target.y - spot.y, target.x - spot.x), '#f5f7fa');
      car.isPolice = true;
      car.mass = 1.6;
      this.units.push({ car });
      return;
    }
  }
}
