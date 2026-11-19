// combat.js — Leo's pistol, its bullets, and everything a bullet can
// meet: walls, people, other people's cars. The SHD never fires back. In
// Sunhaven the danger to a man on foot is not a round but a badge at his
// elbow — or two tons of traffic arriving at the wrong moment.
import { PLAYER_RADIUS } from './config.js';

const MAG_SIZE = 12;        // rounds in the pistol
const BULLET_SPEED = 980;   // px per second
const BULLET_LIFE = 0.55;   // seconds before a round is spent either way

export class Combat {
  constructor() {
    this.bullets = [];
    this.mag = MAG_SIZE;
    this.reserve = 60;
    this.reloadT = 0;    // seconds left on the current reload, 0 when idle
    this.cooldown = 0;   // seconds until the pistol can fire again
    this.hurtT = 0;      // grace period after Leo is knocked down
    this.shake = 0;      // camera shake in pixels, decaying — the renderer reads it
  }

  /** One trigger pull from (x, y) along angle. spreadScale widens the
   * cone: a shot from a moving car's window is never a marksman's shot. */
  tryShoot(game, x, y, angle, spreadScale = 1) {
    if (this.cooldown > 0 || this.reloadT > 0) return false;
    if (this.mag <= 0) {
      this.startReload(game);
      return false;
    }
    this.mag -= 1;
    this.cooldown = 0.16;
    if (game.stats) game.stats.shots = (game.stats.shots ?? 0) + 1;   // the tally the story-complete screen reads
    const spread = game.rng.range(-0.035, 0.035) * spreadScale;
    const dir = angle + spread;
    this.bullets.push({
      x: x + Math.cos(angle) * 16, y: y + Math.sin(angle) * 16,
      vx: Math.cos(dir) * BULLET_SPEED,
      vy: Math.sin(dir) * BULLET_SPEED,
      life: BULLET_LIFE,
    });
    // Muzzle sparks — and a brass casing kicked out sideways, to ping
    // once on the pavement and be forgotten.
    game.effects.burst(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, 3, '#ffd166', 90, 0.09);
    game.effects.burst(x - Math.sin(angle) * 7, y + Math.cos(angle) * 7, 1, '#e8c15a', 42, 0.3);
    game.audio.shot();
    game.onCrime(30, x, y);   // a gunshot carries for blocks, and so does the news
    if (this.mag === 0) this.startReload(game);
    return true;
  }

  startReload(game) {
    if (this.reloadT > 0 || this.reserve <= 0 || this.mag === MAG_SIZE) return;
    this.reloadT = 1.05;
    game.audio.reload();
  }

  finishReload() {
    const take = Math.min(MAG_SIZE - this.mag, this.reserve);
    this.mag += take;
    this.reserve -= take;
    this.reloadT = 0;
  }

  addAmmo(amount) {
    this.reserve += amount;
  }

  update(dt, game) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.shake = Math.max(0, this.shake - dt * 26);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }

    const { buildings } = game.city;
    const cars = game.allCars();
    for (const bullet of this.bullets) {
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;

      // A building eats the round, with a little puff of plaster.
      let stopped = false;
      for (const b of buildings) {
        if (bullet.x > b.x && bullet.x < b.x + b.w && bullet.y > b.y && bullet.y < b.y + b.h) {
          bullet.life = 0;
          game.effects.burst(bullet.x, bullet.y, 3, '#e8e3d8', 70, 0.12);
          stopped = true;
          break;
        }
      }
      if (stopped || bullet.life <= 0) continue;

      // A pedestrian in the line of fire goes down, and Sunhaven notices.
      for (const ped of game.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 10) {
          bullet.life = 0;
          game.knockPed(ped, true);
          game.onCrime(55, bullet.x, bullet.y);
          break;
        }
      }
      if (bullet.life <= 0) continue;

      // A car takes the hit as damage. A police car takes it as an insult
      // the whole department hears about. And a car that dies of it goes
      // out properly: a flash of orange and the first smoke of the wreck.
      for (const car of cars) {
        if (car === game.player.car) continue;
        if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < car.type.w * 0.44) {
          bullet.life = 0;
          const wasDead = car.dead;
          car.health -= 9;
          if (car.health <= 0) car.dead = true;
          game.effects.burst(bullet.x, bullet.y, 5, '#ffb703', 120, 0.16);
          if (car.dead && !wasDead) {
            game.effects.burst(car.x, car.y, 10, '#ff8500', 150, 0.35);
            game.effects.smoke(car.x, car.y, true);
          }
          game.audio.hit();
          if (car.isPolice) game.onCrime(30, bullet.x, bullet.y);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);

    this.hurtFromCars(game, dt);
  }

  /** Traffic is the real weapon in Sunhaven: a car moving fast enough
   * that reaches Leo on foot puts him on the ground and takes its price. */
  hurtFromCars(game, dt) {
    const { player } = game;
    if (player.car || this.hurtT > 0 || player.dead) return;
    for (const car of game.allCars()) {
      if (Math.abs(car.speed) < 110) continue;
      if (Math.hypot(car.x - player.x, car.y - player.y) >= car.type.w * 0.42 + PLAYER_RADIUS) continue;
      const damage = (Math.abs(car.speed) - 100) * 0.11;
      player.health -= damage;
      this.hurtT = 1.1;
      this.shake = 7;
      // Thrown clear of the car that hit him — it is why he survives it.
      const away = Math.atan2(player.y - car.y, player.x - car.x);
      player.x += Math.cos(away) * 26;
      player.y += Math.sin(away) * 26;
      game.audio.thud();
      if (player.health <= 0) {
        player.health = 0;
        player.dead = true;
        game.onWasted();
      }
      break;
    }
  }
}
