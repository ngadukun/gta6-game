// Combat: Leo's pistol, its bullets and what they hit, and the harm that can
// come back at Leo. The police answer crime with numbers and patience, not
// gunfire — the danger on foot is the bust, and the danger everywhere is a
// fast car in the wrong place.
import { PLAYER_RADIUS } from './config.js';

const MAG = 12;
const BULLET_SPEED = 980;

export class Combat {
  constructor() {
    this.bullets = [];
    this.mag = MAG;
    this.reserve = 60;
    this.reloadT = 0;
    this.cooldown = 0;
    this.hurtT = 0;      // brief grace after Leo is knocked down
    this.shake = 0;      // camera shake the renderer reads
  }

  /** Fire one round from (x, y) toward angle, if the pistol allows it. */
  tryShoot(game, x, y, angle, spreadScale = 1) {
    if (this.cooldown > 0 || this.reloadT > 0) return false;
    if (this.mag <= 0) {
      this.startReload(game);
      return false;
    }
    this.mag -= 1;
    this.cooldown = 0.16;
    const spread = game.rng.range(-0.035, 0.035) * spreadScale;
    this.bullets.push({
      x: x + Math.cos(angle) * 16, y: y + Math.sin(angle) * 16,
      vx: Math.cos(angle + spread) * BULLET_SPEED,
      vy: Math.sin(angle + spread) * BULLET_SPEED,
      life: 0.55,
    });
    game.effects.burst(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, 3, '#ffd166', 90, 0.09);
    // A brass casing pops sideways and pings off the pavement.
    game.effects.burst(x - Math.sin(angle) * 7, y + Math.cos(angle) * 7, 1, '#e8c15a', 42, 0.3);
    game.audio.shot();
    game.onCrime(30, x, y);       // a gunshot is heard for blocks
    if (this.mag === 0) this.startReload(game);
    return true;
  }

  startReload(game) {
    if (this.reloadT > 0 || this.reserve <= 0 || this.mag === MAG) return;
    this.reloadT = 1.05;
    game.audio.reload();
  }

  finishReload() {
    const take = Math.min(MAG - this.mag, this.reserve);
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

    const city = game.city;
    const peds = game.peds;
    const cars = game.allCars();
    for (const bullet of this.bullets) {
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      // Buildings stop bullets dead.
      for (const b of city.buildings) {
        if (bullet.x > b.x && bullet.x < b.x + b.w && bullet.y > b.y && bullet.y < b.y + b.h) {
          bullet.life = 0;
          game.effects.burst(bullet.x, bullet.y, 3, '#e8e3d8', 70, 0.12);
          break;
        }
      }
      if (bullet.life <= 0) continue;
      // Pedestrians.
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 10) {
          bullet.life = 0;
          game.knockPed(ped, true);
          game.onCrime(55, bullet.x, bullet.y);
          break;
        }
      }
      if (bullet.life <= 0) continue;
      // Cars: a hit damages the car; a police hit is a serious crime.
      for (const car of cars) {
        if (car === game.player.car) continue;
        if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < car.type.w * 0.44) {
          bullet.life = 0;
          car.health -= 9;
          if (car.health <= 0) car.dead = true;
          game.effects.burst(bullet.x, bullet.y, 5, '#ffb703', 120, 0.16);
          game.audio.hit();
          if (car.isPolice) game.onCrime(30, bullet.x, bullet.y);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);

    this.hurtFromCars(game, dt);
  }

  /** A moving car that reaches Leo on foot knocks him down and hurts him. */
  hurtFromCars(game, dt) {
    const { player } = game;
    if (player.car || this.hurtT > 0 || player.dead) return;
    for (const car of game.allCars()) {
      if (Math.abs(car.speed) < 110) continue;
      if (Math.hypot(car.x - player.x, car.y - player.y) < car.type.w * 0.42 + PLAYER_RADIUS) {
        const damage = (Math.abs(car.speed) - 100) * 0.11;
        player.health -= damage;
        this.hurtT = 1.1;
        this.shake = 7;
        // Thrown clear of the car.
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
}
