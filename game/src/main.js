// main.js — Sunhaven's conductor.
//
// The Game object defined here is the one thing every module agrees to
// read: the city, the player, the law, the work. Around it sits the
// fixed-step simulation — the city breathes on every screen, title
// included — and, at the bottom, the boot code: a title screen for a
// player, or one staged frame for a screenshot when the address says
// ?shot=.
import { AMMO_PICKUP, CAMERA_LEAD, HORN_HEAR_RANGE, PARKED_COUNT, PED_COUNT, PICKUP_RESPAWN_T, SIREN_RANGE, STEP, TRAFFIC_COUNT } from './config.js';
import { Input } from './input.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { GameAudio } from './audio.js';
import { Effects } from './particles.js';
import { HUD } from './hud.js';
import { Renderer } from './render.js';
import { WantedLevel, PoliceForce } from './police.js';
import { Combat } from './combat.js';
import { MissionSystem, bindStoryPlaces } from './missions.js';
import { makePlayer, stepPlayerOnFoot, spawnPeds, stepPeds, knockDown } from './people.js';
import { CAR_TYPES, collideCars, makeCar, spawnParkedCars, spawnTraffic, stepCarPhysics, stepTraffic } from './vehicles.js';
import { loadSave, storeSave, clearSave, loadPrefs, storePrefs } from './save.js';
import { stageShot } from './shots.js';

export class Game {
  constructor(seed = 20261117) {
    this.rng = makeRng(seed);
    this.city = buildCity(this.rng);
    bindStoryPlaces(this.city);
    this.player = makePlayer(this.city.places.hideout.x, this.city.places.hideout.y + 60);
    this.trafficDrivers = spawnTraffic(this.city, this.rng, TRAFFIC_COUNT);
    this.parkedCars = spawnParkedCars(this.city, this.rng, PARKED_COUNT);
    this.extraCars = [];
    this.peds = spawnPeds(this.rng, PED_COUNT);
    this.wanted = new WantedLevel();
    this.police = new PoliceForce();
    this.combat = new Combat();
    this.effects = new Effects();
    this.audio = new GameAudio();
    this.missions = new MissionSystem();
    this.camera = { x: this.player.x, y: this.player.y };
    this.cash = 120;
    this.passenger = false;
    this.screen = 'title';
    this.dialogue = null;
    this.prompt = null;
    this.bannerState = null;
    this.danger = null;
    this.stats = { earned: 0, jobs: 0, stolen: 0, shots: 0 };
    this.saveT = 0;
    this.storyCompleteShown = false;
    // Ammo waits on three friendly porches: the shop, the marina, the hospital.
    this.pickups = [
      { x: this.city.places.chopShop.x + 52, y: this.city.places.chopShop.y - 30, active: true, t: 0 },
      { x: this.city.places.marina.x - 44, y: this.city.places.marina.y + 26, active: true, t: 0 },
      { x: this.city.places.hospital.x + 48, y: this.city.places.hospital.y - 24, active: true, t: 0 },
    ];
    const save = loadSave();
    this.titleItems = save ? ['New Game', 'Continue'] : ['New Game'];
    this.titleIndex = 0;
    this.savedGame = save;
  }

  /** Every car in the world, from whichever list currently owns it. */
  allCars() {
    return [...this.trafficDrivers.map((d) => d.car), ...this.parkedCars, ...this.extraCars, ...this.police.cars];
  }

  // --- Hooks the other modules call -----------------------------------------

  /** A crime happened at (x, y). It only becomes heat if somebody saw
   * it: an officer within earshot of the whole street, a pedestrian up
   * close, or a driver passing through it. Seen or not, the violence
   * itself sends the nearby crowd running. */
  onCrime(points, x, y) {
    const near = (o) => Math.hypot(o.x - x, o.y - y);
    const witnessed = this.police.cars.some((c) => near(c) < 420)
      || this.peds.some((p) => p.state !== 'down' && near(p) < 185)
      || this.trafficDrivers.some((d) => near(d.car) < 200);
    if (witnessed) this.wanted.addCrime(points);
    this.danger = { x, y, t: 2.2 };
  }

  knockPed(ped, shot) {
    knockDown(ped, this.rng);
    if (shot) ped.stateT = 6;   // a shooting victim stays down longer than a bumped one
  }

  startDialogue(lines, onDone) {
    this.dialogue = { lines, index: 0, onDone };
  }

  banner(title, sub, color) {
    this.bannerState = { title, sub, color, t: 0, total: 3.2 };
  }

  earnCash(amount, x, y) {
    this.cash += amount;
    this.stats.earned += amount;
    this.effects.text(x, y - 24, `+$${amount}`, '#06d6a0');
    this.audio.cash();
  }

  /** A car the story needs, parked at a place: red and ordinary, or grey
   * and armoured and very hard to kill when the job is the Score. */
  spawnMissionCar(typeId, place, opts = {}) {
    const type = CAR_TYPES.find((t) => t.id === typeId) ?? CAR_TYPES[1];
    const car = makeCar(type, place.x + 56, place.y + 10, 0, opts.armored ? '#7d8590' : '#d64541');
    if (opts.armored) {
      car.health = 320;
      car.maxHealth = 320;
      car.armored = true;
      car.mass = 2.2;
    }
    car.missionCar = true;
    this.extraCars.push(car);
    return car;
  }

  /** Put Leo straight into a fresh car of the given type (scenes use
   * this; players use doors). */
  givePlayerCar(typeId, x, y, angle) {
    const type = CAR_TYPES.find((t) => t.id === typeId) ?? CAR_TYPES[1];
    const car = makeCar(type, x, y, angle, '#3e7cb1');
    this.extraCars.push(car);
    this.player.car = car;
    return car;
  }

  /** Point the story at a chapter (the screenshot scenes enter mid-story). */
  startStoryAt(index) {
    this.missions.storyIndex = index;
  }

  /** The dock crates stand back up: a new Distraction is being staged. */
  resetCrates() {
    for (const crate of this.city.crates) crate.dead = false;
  }

  onBusted() {
    if (this.screen !== 'play') return;
    this.screen = 'busted';
    this.missions.active = null;
    this.passenger = false;
    this.audio.sting(false);
  }

  onWasted() {
    if (this.screen !== 'play') return;
    this.screen = 'wasted';
    this.missions.active = null;
    this.passenger = false;
    this.audio.sting(false);
  }

  onStoryComplete() {
    if (this.storyCompleteShown) return;
    this.storyCompleteShown = true;
    this.screen = 'complete';
    // The one celebration in the game: a burst of colour over Leo,
    // wherever the last job left him standing.
    const at = this.player.car ?? this.player;
    this.effects.celebrate(at.x, at.y);
  }

  saveGame() {
    if (this.screen !== 'play') return;
    storeSave({
      cash: this.cash,
      storyIndex: this.missions.storyIndex,
      completedStory: this.missions.completedStory,
      jobsDone: this.missions.jobsDone,
      stats: this.stats,
      px: this.player.x,
      py: this.player.y,
    });
  }

  // --- The simulation ---------------------------------------------------------

  step(dt, input) {
    this.input = input;
    // The city breathes on every screen: traffic rolls, people stroll,
    // smoke rises, banners fade — whether or not Leo is free to act.
    for (const driver of this.trafficDrivers) {
      if (driver.car.dead) stepCarPhysics(driver.car, { throttle: 0, steer: 0, brake: true }, dt, this.city);
      else stepTraffic(driver, dt, this.city, this.allCars(), this.rng);
    }
    if (this.danger) {
      this.danger.t -= dt;
      if (this.danger.t <= 0) this.danger = null;
    }
    stepPeds(this.peds, dt, this.city, this.rng, this.danger, this.allCars());
    this.effects.update(dt);
    if (this.bannerState) {
      this.bannerState.t += dt;
      if (this.bannerState.t >= this.bannerState.total) this.bannerState = null;
    }
    if (this.screen !== 'play') {
      this.updateCamera(dt, true);
      return;
    }

    // Leo acts, unless a conversation is holding him still.
    const player = this.player;
    const startedInCar = !!player.car;   // an F tap that exits a car must not re-enter it in the same step
    if (!this.dialogue) {
      if (player.car) {
        this.drivePlayerCar(dt, input);
        this.driveBy(input);
      } else {
        stepPlayerOnFoot(player, input, dt, this.city);
        this.aimAndShoot(input);
      }
      this.interact(input, startedInCar);
    }

    // Then the world answers: the law, the heat, the bullets, the work.
    const seen = this.police.update(dt, this);
    this.wanted.update(dt, seen);
    this.combat.update(dt, this);
    if (!this.dialogue) this.missions.update(dt, this);
    collideCars(this.allCars());
    this.carMeetsWorld(dt);
    this.stepPickups(dt);
    this.stepAmbience(dt);

    // A wreck burning around its driver is the end of the run.
    if (player.car && player.car.dead) {
      this.effects.burst(player.car.x, player.car.y, 26, '#ff8500', 190, 0.5);
      player.car = null;
      player.health = 0;
      this.onWasted();
    }
    // Given quiet, a man on foot gets his breath back.
    if (!player.car && player.health > 0 && player.health < 100 && this.combat.hurtT <= 0) {
      player.health = Math.min(100, player.health + dt * 2.2);
    }
    // Autosave on a slow drip, so a closed tab loses minutes, not the day.
    this.saveT += dt;
    if (this.saveT > 10) {
      this.saveT = 0;
      this.saveGame();
    }
    this.updateCamera(dt, false);
  }

  drivePlayerCar(dt, input) {
    const car = this.player.car;
    const control = {
      throttle: (input.held('KeyW', 'ArrowUp') ? 1 : 0) + (input.held('KeyS', 'ArrowDown') ? -1 : 0),
      steer: (input.held('KeyA', 'ArrowLeft') ? -1 : 0) + (input.held('KeyD', 'ArrowRight') ? 1 : 0),
      brake: input.held('KeyS', 'ArrowDown') && car.speed > 12,
      handbrake: input.held('Space'),
    };
    const impact = stepCarPhysics(car, control, dt, this.city);
    if (impact > 150) {
      this.audio.crash();
      this.combat.shake = Math.min(9, impact / 45);
      this.effects.burst(car.x, car.y, 8, '#e8e3d8', 120, 0.3);
      if (impact > 200) this.onCrime(18, car.x, car.y);   // a crash that loud is public
    }
    if (car.health < 45 && Math.random() < dt * 6) {
      this.effects.smoke(car.x, car.y, car.health < 22);
    }
    if (input.tapped('KeyF', 'KeyE')) this.exitCar();
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    // Out on the driver's side, close enough to get back in.
    const side = car.angle + Math.PI / 2;
    this.player.x = car.x + Math.cos(side) * (car.type.h / 2 + 16);
    this.player.y = car.y + Math.sin(side) * (car.type.h / 2 + 16);
    this.player.car = null;
    this.audio.door();
  }

  enterCar(car) {
    // The car changes lists: whatever lent it to the street — traffic, a
    // parking spot — gives it up, and it becomes Leo's problem.
    const ti = this.trafficDrivers.findIndex((d) => d.car === car);
    if (ti >= 0) this.trafficDrivers.splice(ti, 1);
    const pi = this.parkedCars.indexOf(car);
    if (pi >= 0) this.parkedCars.splice(pi, 1);
    if (!this.extraCars.includes(car)) this.extraCars.push(car);
    car.parked = false;
    this.player.car = car;
    this.stats.stolen += 1;
    this.audio.door();
    this.audio.pickup();
    this.onCrime(45, car.x, car.y);   // somebody usually sees a car being taken
  }

  aimAndShoot(input) {
    const player = this.player;
    const w = input.mouseWorld(this.camera, this.viewW, this.viewH);
    player.angle = Math.atan2(w.y - player.y, w.x - player.x);
    if (input.mouseDown) this.combat.tryShoot(this, player.x, player.y, player.angle);
    if (input.tapped('KeyR')) this.combat.startReload(this);
  }

  /** Drive-by: from the driver's seat Leo can still shoot — wider,
   * louder, and every bit as illegal as doing it standing up. */
  driveBy(input) {
    const car = this.player.car;
    if (!car) return;
    if (input.tapped('KeyR')) this.combat.startReload(this);
    if (!input.mouseDown) return;
    const w = input.mouseWorld(this.camera, this.viewW, this.viewH);
    const angle = Math.atan2(w.y - car.y, w.x - car.x);
    this.player.angle = angle;
    this.combat.tryShoot(this, car.x, car.y, angle, 2.6);
  }

  /** The soundscape and the small physical tells, once per step: engine
   * and siren loops pitched to the moment, a horn from traffic trapped
   * behind something, tyre smoke when the car slides harder than tyres
   * allow. */
  stepAmbience(dt) {
    const player = this.player;
    let engineRatio = null;
    if (player.car) engineRatio = Math.min(1, Math.abs(player.car.speed) / player.car.type.top);
    const sirenOn = this.wanted.stars > 0 && this.police.anyWithin(player.x, player.y, SIREN_RANGE);
    this.audio.updateLoops(engineRatio, sirenOn);
    for (const driver of this.trafficDrivers) {
      if (!driver.car.honk) continue;
      driver.car.honk = false;
      const d = Math.hypot(driver.car.x - this.camera.x, driver.car.y - this.camera.y);
      if (d < HORN_HEAR_RANGE) this.audio.horn();
    }
    const car = player.car;
    if (car && Math.abs(car.speed) > 60) {
      const lat = -Math.sin(car.angle) * car.vx + Math.cos(car.angle) * car.vy;
      if (Math.abs(lat) > 52) {
        const backX = car.x - Math.cos(car.angle) * car.type.w * 0.32;
        const backY = car.y - Math.sin(car.angle) * car.type.w * 0.32;
        this.effects.tireSmoke(backX, backY);
      }
    }
  }

  /** Doors and conversations. When the step began with Leo in a car, this
   * step's F tap was the one that let him out — it is spent, and neither
   * Marisol nor the car he just left may claim it. */
  interact(input, startedInCar = false) {
    const player = this.player;
    this.prompt = null;
    if (player.car) return;
    // Marisol first: her porch is where work comes from.
    const shop = this.city.places.chopShop;
    if (Math.hypot(player.x - shop.x, player.y - shop.y) < 78 && !this.missions.busy) {
      this.prompt = this.missions.completedStory
        ? 'F — Talk to Marisol (side work — she always has some)'
        : 'F — Talk to Marisol (a new job)';
      if (!startedInCar && input.tapped('KeyF', 'KeyE')) {
        this.missions.startNext(this);
        return;
      }
    }
    // Then the nearest car worth taking.
    let best = null;
    let bestD = 54;
    for (const car of this.allCars()) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best) {
      this.prompt = `F — Take the ${best.type.name}`;
      if (!startedInCar && input.tapped('KeyF', 'KeyE')) this.enterCar(best);
    }
  }

  /** Cars meeting the soft parts of the world: pedestrians, who go down,
   * and dock crates, which at speed come apart — and count, when a
   * certain job is running, as beautifully public noise. */
  carMeetsWorld(dt) {
    for (const car of this.allCars()) {
      if (Math.abs(car.speed) < 55) continue;
      for (const ped of this.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < car.type.w * 0.46) {
          this.knockPed(ped, false);
          this.audio.thud();
          if (car === this.player.car) this.onCrime(70, ped.x, ped.y);
        }
      }
      if (Math.abs(car.speed) > 130) {
        for (const crate of this.city.crates) {
          if (crate.dead) continue;
          const cx = crate.x + crate.s / 2;
          const cy = crate.y + crate.s / 2;
          if (Math.hypot(cx - car.x, cy - car.y) < crate.s / 2 + car.type.w * 0.36) {
            crate.dead = true;
            this.effects.burst(cx, cy, 12, '#9c6644', 150, 0.4);
            this.audio.crash();
            car.health -= 4;
            if (car === this.player.car && this.missions.active?.data) {
              this.missions.active.data.chaos = (this.missions.active.data.chaos ?? 0) + 1;
            }
          }
        }
      }
    }
  }

  stepPickups(dt) {
    for (const pickup of this.pickups) {
      if (!pickup.active) {
        pickup.t -= dt;
        if (pickup.t <= 0) pickup.active = true;
        continue;
      }
      // On foot only — a man in a car has no hands free for a porch box.
      if (!this.player.car && Math.hypot(this.player.x - pickup.x, this.player.y - pickup.y) < 26) {
        pickup.active = false;
        pickup.t = PICKUP_RESPAWN_T;
        this.combat.addAmmo(AMMO_PICKUP);
        this.effects.text(pickup.x, pickup.y - 18, `AMMO +${AMMO_PICKUP}`, '#ffd166');
        this.audio.pickup();
      }
    }
  }

  updateCamera(dt, ambient) {
    const target = this.player.car ?? this.player;
    // In play, the camera leans into the velocity a little; on the other
    // screens it simply settles where Leo is.
    const look = ambient ? 0 : CAMERA_LEAD;
    const tx = target.x + (target.vx ?? 0) * look;
    const ty = target.y + (target.vy ?? 0) * look;
    const k = ambient ? 1 : 1 - Math.exp(-5 * dt);
    this.camera.x += (tx - this.camera.x) * k;
    this.camera.y += (ty - this.camera.y) * k;
    if (this.combat.shake > 0) {
      this.camera.x += (Math.random() - 0.5) * this.combat.shake;
      this.camera.y += (Math.random() - 0.5) * this.combat.shake;
    }
  }

  // --- The morning after ------------------------------------------------------

  /** Busted or wasted, the bill is the same shape: some cash, all of the
   * heat, and a walk out of a public building at dawn. */
  respawn() {
    const busted = this.screen === 'busted';
    const at = busted ? this.city.places.policeStation : this.city.places.hospital;
    this.cash = Math.max(0, this.cash - (busted ? 150 : 200));
    this.player.car = null;
    this.player.health = 100;
    this.player.dead = false;
    this.player.x = at.x;
    this.player.y = at.y + 40;
    this.wanted.clear();
    this.police.units = [];
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.screen = 'play';
    this.saveGame();
  }
}

// --- Boot -----------------------------------------------------------------------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const renderer = new Renderer();
const hud = new HUD();

function fitCanvas(game) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  game.viewW = canvas.width;
  game.viewH = canvas.height;
}

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? 20261117) || 20261117;
const game = new Game(seed);
game.audio.muted = !!loadPrefs().muted;
game.viewW = window.innerWidth;
game.viewH = window.innerHeight;
const input = new Input(canvas);
game.input = input;
fitCanvas(game);
window.addEventListener('resize', () => fitCanvas(game));

function draw() {
  if (game.screen === 'title') {
    renderer.drawTitle(ctx, game, canvas.width, canvas.height);
  } else {
    renderer.drawWorld(ctx, game, canvas.width, canvas.height);
    hud.draw(ctx, game, canvas.width, canvas.height);
    if (game.screen !== 'play') renderer.drawOverlay(ctx, game, canvas.width, canvas.height);
  }
}

if (params.has('shot')) {
  // One staged frame, drawn once, exactly as the screenshots show it.
  game.screen = stageShot(params.get('shot'), game);
  draw();
  window.__shotReady = true;
} else {
  let last = performance.now();
  let acc = 0;
  // Alt-tabbing mid-chase should not hand the SHD a free arrest: losing
  // the window pauses a run in progress, and lets go of every key.
  window.addEventListener('blur', () => {
    input.reset();
    if (game.screen === 'play') game.screen = 'paused';
  });
  const frame = (now) => {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      handleScreenInput();
      game.step(STEP, input);
      input.endStep();
      acc -= STEP;
    }
    draw();
    requestAnimationFrame(frame);
  };

  function handleScreenInput() {
    game.audio.unlock();
    if (input.tapped('KeyM')) {
      game.audio.muted = !game.audio.muted;
      storePrefs({ muted: game.audio.muted });
    }
    if (game.dialogue) {
      if (input.tapped('Enter') || input.mouseClicked) {
        game.dialogue.index += 1;
        if (game.dialogue.index >= game.dialogue.lines.length) {
          const done = game.dialogue.onDone;
          game.dialogue = null;
          if (done) done();
        }
      }
      return;
    }
    if (game.screen === 'title') {
      if (input.tapped('KeyW', 'ArrowUp')) game.titleIndex = Math.max(0, game.titleIndex - 1);
      if (input.tapped('KeyS', 'ArrowDown')) game.titleIndex = Math.min(game.titleItems.length - 1, game.titleIndex + 1);
      if (input.tapped('Enter')) chooseTitle();
      if (input.mouseClicked) {
        const i = Math.floor((input.mouseY - canvas.height * 0.58) / 40 + 0.5);
        if (i >= 0 && i < game.titleItems.length) {
          game.titleIndex = i;
          chooseTitle();
        }
      }
      return;
    }
    if (game.screen === 'busted' || game.screen === 'wasted') {
      if (input.tapped('Enter')) game.respawn();
      return;
    }
    if (game.screen === 'complete') {
      if (input.tapped('Enter')) game.screen = 'play';
      return;
    }
    if (input.tapped('KeyP', 'Escape')) {
      game.screen = game.screen === 'paused' ? 'play' : 'paused';
    }
  }

  function chooseTitle() {
    const item = game.titleItems[game.titleIndex];
    if (item === 'Continue' && game.savedGame) {
      const s = game.savedGame;
      game.cash = s.cash;
      game.missions.storyIndex = s.storyIndex;
      game.missions.completedStory = s.completedStory;
      game.missions.jobsDone = s.jobsDone ?? 0;
      game.stats = s.stats ?? game.stats;
      game.player.x = s.px;
      game.player.y = s.py;
      game.camera.x = s.px;
      game.camera.y = s.py;
      game.storyCompleteShown = s.completedStory;
    } else {
      clearSave();
      game.startDialogue([
        { who: 'Marisol Vega', text: 'Leo Santos. Heard you drive like the road owes you money. Come see me at Vega Auto Works — west side, by the docks road. I have work.' },
        { who: 'Leo', text: 'First day in Sunhaven and already employed. Let us see how long that lasts.' },
      ], null);
    }
    game.screen = 'play';
    game.audio.pickup();
  }

  requestAnimationFrame(frame);
}
