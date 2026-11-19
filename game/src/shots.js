// The screenshot scenes behind ?shot=title|chase|city|mission&seed=N. Each one
// builds a fresh world from the seed, then plays the real rules forward with a
// simple autopilot at the wheel, so the frame is what a real session looks
// like — and the same seed always gives the same frame.
import { STEP } from './config.js';
import { laneTarget } from './vehicles.js';

/** A keyboard the scene can drive: the game's Input, minus the human. */
class StubInput {
  constructor() {
    this.down = new Set();
    this.mouseX = 640;
    this.mouseY = 300;
    this.mouseDown = false;
    this.mouseClicked = false;
  }

  held(...codes) { return codes.some((c) => this.down.has(c)); }
  tapped() { return false; }
  mouseWorld(camera, viewW, viewH) { return { x: this.mouseX - viewW / 2 + camera.x, y: this.mouseY - viewH / 2 + camera.y }; }
  endStep() { this.mouseClicked = false; }

  set(...codes) { this.down = new Set(codes); }
}

/** Steer a car toward a point with the real keys: W, and A or D to turn. */
function driveToward(input, car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const keys = ['KeyW'];
  if (diff > 0.14) keys.push('KeyD');
  else if (diff < -0.14) keys.push('KeyA');
  if (Math.abs(diff) > 2.5) keys.push('Space');
  input.set(...keys);
  return Math.hypot(tx - car.x, ty - car.y);
}

/** Walk Leo toward a point. */
function walkToward(input, player, tx, ty) {
  const keys = [];
  if (tx - player.x > 8) keys.push('KeyD');
  if (player.x - tx > 8) keys.push('KeyA');
  if (ty - player.y > 8) keys.push('KeyS');
  if (player.y - ty > 8) keys.push('KeyW');
  input.set(...keys);
}

function stepSeconds(game, input, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (drive) drive(i);
    game.step(STEP, input);
    input.endStep();
  }
}

/**
 * Stage the named scene on a fresh game and return the screen to draw.
 * Any other name is the title.
 */
export function stageShot(name, game) {
  const input = new StubInput();
  game.input = input;
  const city = game.city;

  if (name === 'chase') {
    // The cover: Leo in the stolen Futo, three stars, the SHD on his tail,
    // mid-delivery through downtown with the job on the HUD.
    game.screen = 'play';
    game.startStoryAt(1);
    game.missions.startNext(game);
    game.dialogue = null;
    const car = game.missions.active.data.car;
    game.player.x = car.x + 34;
    game.player.y = car.y + 12;
    game.enterCar(car);
    game.wanted.addCrime(320);
    let wp = 0;
    const route = [[5, 3], [5, 5], [3, 5], [3, 3], [4, 3]];
    stepSeconds(game, input, 13, () => {
      const [ci, ri] = route[wp % route.length];
      const t = laneTarget(ci, ri, 1, 0);
      if (driveToward(input, car, t.x, t.y) < 70) wp += 1;
    });
    // A cover needs badges in frame: if the pack lost the scent, stage the
    // nearest Interceptor a block behind Leo for the portrait.
    const inFrame = game.police.cars.some((c) => Math.hypot(c.x - car.x, c.y - car.y) < 560);
    if (!inFrame && game.police.cars.length) {
      const cop = game.police.cars[0];
      cop.x = car.x - Math.cos(car.angle) * 210;
      cop.y = car.y - Math.sin(car.angle) * 210;
      cop.angle = car.angle;
      cop.speed = Math.abs(car.speed) * 0.9;
    }
    game.dialogue = null;
    return 'play';
  }

  if (name === 'city') {
    // On foot in the thick of it: traffic, pedestrians, and Marisol's first
    // job waiting on the HUD.
    game.screen = 'play';
    game.player.x = city.places.chopShop.x + 60;
    game.player.y = city.places.chopShop.y + 46;
    game.missions.startNext(game);
    game.dialogue = null;
    stepSeconds(game, input, 5, () => walkToward(input, game.player, game.player.x + 40, game.player.y + 130));
    game.camera.x = game.player.x + 120;
    game.camera.y = game.player.y + 40;
    return 'play';
  }

  if (name === 'mission') {
    // The Courier, mid-flight: Paco in the passenger seat, two stars up,
    // the marina clock running down.
    game.screen = 'play';
    game.startStoryAt(2);
    game.missions.startNext(game);
    game.dialogue = null;
    const mission = game.missions.active;
    mission.stageIndex = 1;
    mission.stageT = 96;
    mission.def.stages[1].onStart(game, mission);
    const car = game.givePlayerCar('sedan', city.places.hotel.x, city.places.hotel.y, Math.PI / 2);
    // Straight south down the beach road, the marina clock running.
    stepSeconds(game, input, 6, () => {
      driveToward(input, car, city.places.marina.x, city.places.marina.y);
    });
    game.dialogue = null;
    return 'play';
  }

  // Title: the city alive behind the name, camera drifting over downtown.
  game.player.x = city.places.bank.x;
  game.player.y = city.places.bank.y;
  stepSeconds(game, input, 4, null);
  game.camera.x = city.places.bank.x + 260;
  game.camera.y = city.places.bank.y - 60;
  return 'title';
}
