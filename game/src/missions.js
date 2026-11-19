// The work. Five story jobs for Marisol Vega of Vega Auto Works, run by a
// small stage engine: a job is a list of stages, a stage is an objective —
// a place to be, a thing to have done, sometimes a clock — and the engine
// walks the list as the world satisfies each stage in turn. When the story
// runs out, the engine deals generated side work instead, forever. A failed
// job is not the end of anything: Marisol shrugs and offers it again.
import { CAR_TYPES, makeCar } from './vehicles.js';

const MARISOL = 'Marisol Vega';
const LEO = 'Leo';

export class MissionSystem {
  constructor() {
    this.storyIndex = 0;       // the next story job Marisol will offer
    this.active = null;        // { def, stageIndex, stageT, data, isStory }
    this.sideJob = null;       // the generated job currently on the table
    this.completedStory = false;
    this.jobsDone = 0;         // every finished job, story and side alike
  }

  get busy() { return this.active !== null; }

  /** What the HUD shows: the current stage as one line, its target, and
   * its clock when it has one. Null when no job is running. */
  objective(game) {
    if (!this.active) return null;
    const stage = this.active.def.stages[this.active.stageIndex];
    if (!stage) return null;
    const target = typeof stage.target === 'function' ? stage.target(game, this.active) : stage.target;
    const text = stage.dynamicText ? stage.dynamicText(this.active) : stage.text;
    return { text, target, timer: stage.timer ? this.active.stageT : null };
  }

  /** Offer the next job: the next story chapter while any remain, then
   * generated side work for as long as Leo keeps showing up. */
  startNext(game) {
    if (this.busy) return false;
    const def = STORY[this.storyIndex];
    if (def) {
      this.begin(game, def, true);
      return true;
    }
    const job = makeSideJob(game, this.jobsDone);
    if (job) {
      this.sideJob = job;
      this.begin(game, job, false);
      return true;
    }
    return false;
  }

  begin(game, def, isStory) {
    this.active = { def, stageIndex: 0, stageT: def.stages[0].timer ?? 0, data: {}, isStory };
    if (def.intro) game.startDialogue(def.intro, null);
    const first = def.stages[0];
    if (first.onStart) first.onStart(game, this.active);
  }

  fail(game, reason) {
    if (!this.active) return;
    game.audio.sting(false);
    game.banner('JOB FAILED', reason, '#ef476f');
    game.passenger = false;   // whoever was riding with Leo bails out here
    this.active = null;
  }

  complete(game) {
    const mission = this.active;
    const { def } = mission;
    // A reward can be a flat fee, or a reckoning made from how the job
    // went — a fare's distance, a chopped car's shine.
    const reward = typeof def.reward === 'function' ? def.reward(game, mission) : def.reward;
    this.active = null;
    game.passenger = false;   // delivered is delivered: the seat empties
    this.jobsDone += 1;
    if (game.stats) game.stats.jobs = this.jobsDone;   // the tally the story-complete screen reads
    if (def.isStory) {
      this.storyIndex += 1;
      if (this.storyIndex >= STORY.length) this.completedStory = true;
    }
    const earner = game.player.car ?? game.player;
    game.earnCash(reward, earner.x, earner.y);
    game.audio.sting(true);
    game.banner('JOB DONE', `${def.title} — $${reward}`, '#06d6a0');
    if (def.outro) game.startDialogue(def.outro, null);
    if (this.completedStory && def === STORY[STORY.length - 1]) game.onStoryComplete();
    game.saveGame();
  }

  update(dt, game) {
    if (!this.active) return;
    const mission = this.active;
    const stage = mission.def.stages[mission.stageIndex];
    if (!stage) {
      this.complete(game);
      return;
    }
    if (stage.timer) {
      mission.stageT -= dt;
      if (mission.stageT <= 0) {
        this.fail(game, 'Out of time. Marisol shrugs: “Traffic, huh?”');
        return;
      }
    }
    if (stage.tick) stage.tick(game, mission, dt);
    if (stage.check(game, mission)) {
      mission.stageIndex += 1;
      const next = mission.def.stages[mission.stageIndex];
      if (!next) {
        this.complete(game);
        return;
      }
      mission.stageT = next.timer ?? 0;
      if (next.onStart) next.onStart(game, mission);
      if (next.say) game.startDialogue(next.say, null);
    }
  }
}

// --- Stage shapes --------------------------------------------------------------

function atPlace(place, r = 60) {
  return (game) => {
    const p = game.player.car ?? game.player;
    return Math.hypot(p.x - place.x, p.y - place.y) < r;
  };
}

/** A stage that is simply "be at this place". The place is read back off
 * the stage at check time, because the defs below are written before any
 * city exists — bindStoryPlaces fills the fixed targets in afterwards. */
function gotoStage(text, place, extra = {}) {
  const stage = { text, target: place, ...extra };
  stage.check = (game, mission) => {
    const t = mission.def.stages[mission.stageIndex].target;
    if (!t) return false;
    const p = game.player.car ?? game.player;
    return Math.hypot(p.x - t.x, p.y - t.y) < (stage.r ?? 60);
  };
  return stage;
}

// --- The story -----------------------------------------------------------------

const STORY = [
  {
    title: 'First Wheels', reward: 300, isStory: true,
    intro: [
      { who: MARISOL, text: 'You must be Leo. I run Vega Auto Works — and half the favours in this town. Prove you can drive: there is a package at the docks with my name on it.' },
      { who: LEO, text: 'Pick it up, bring it back. Simple.' },
      { who: MARISOL, text: 'In Sunhaven, mijo, nothing is simple. But start there.' },
    ],
    stages: [
      gotoStage('Pick up the package at the Sunhaven Docks', null, { target: null }),
      gotoStage('Deliver the package to Vega Auto Works', null),
    ],
    outro: [
      { who: MARISOL, text: 'On time and in one piece. You might last here, Leo.' },
    ],
  },
  {
    title: 'Hot Property', reward: 600, isStory: true,
    intro: [
      { who: MARISOL, text: 'A Futo GT sits downtown, owned by a man who owes me money. Bring it home — and bring it home pretty, scratches cost you.' },
    ],
    stages: [
      {
        text: 'Steal the marked Futo GT downtown',
        target: (game, m) => m.data.car,
        onStart: (game, m) => { m.data.car = game.spawnMissionCar('sport', game.city.places.bank); },
        check: (game, m) => game.player.car === m.data.car,
      },
      {
        text: 'Deliver the Futo to Vega Auto Works — keep it clean',
        target: null,
        check: (game, m) => {
          if (m.data.car.dead || m.data.car.health <= 0) { game.missions.fail(game, 'The Futo is wrecked. Marisol wanted a car, not a sculpture.'); return false; }
          const p = game.player.car;
          return p === m.data.car && Math.hypot(p.x - game.city.places.chopShop.x, p.y - game.city.places.chopShop.y) < 70;
        },
      },
    ],
    outro: [
      { who: MARISOL, text: 'Beautiful. The debt is settled, and you drive like you mean it.' },
    ],
  },
  {
    title: 'The Courier', reward: 900, isStory: true,
    intro: [
      { who: MARISOL, text: 'My accountant, Paco, is at the Coral Court Hotel with a head full of numbers the SHD would love to hear. Take him to the marina. Quietly.' },
      { who: LEO, text: 'And if it is not quiet?' },
      { who: MARISOL, text: 'Then drive like it is.' },
    ],
    stages: [
      gotoStage('Pick up Paco at the Coral Court Hotel', null),
      {
        text: 'Drive Paco to Palma Marina — he is hot, move!',
        target: null, timer: 150,
        onStart: (game) => { game.passenger = true; game.wanted.addCrime(200); },
        check: (game, m) => atPlace(game.city.places.marina, 65)(game),
      },
    ],
    outro: [
      { who: MARISOL, text: 'Paco is on a boat and the numbers are safe. Good work.' },
    ],
  },
  {
    title: 'Dockside Distraction', reward: 1400, isStory: true,
    intro: [
      { who: MARISOL, text: 'The dock crew loads a container tonight that must not be watched. Make noise, Leo: smash their crates, draw every badge in Sunhaven — then disappear to your hideout.' },
    ],
    stages: [
      {
        text: 'Smash 8 dock crates — draw the heat',
        target: null, timer: 130,
        onStart: (game, m) => { m.data.chaos = 0; game.wanted.addCrime(150); game.resetCrates(); },
        check: (game, m) => (m.data.chaos ?? 0) >= 8,
        dynamicText: (m) => `Smash the dock crates — ${m.data.chaos ?? 0}/8 smashed`,
      },
      {
        text: 'Lose the heat and reach Leo’s Hideout',
        target: null,
        check: (game) => game.wanted.stars === 0 && atPlace(game.city.places.hideout, 70)(game),
      },
    ],
    outro: [
      { who: MARISOL, text: 'The container sailed clean. You are a one-man parade, Leo.' },
    ],
  },
  {
    title: 'The Sunhaven Score', reward: 3000, isStory: true,
    intro: [
      { who: MARISOL, text: 'Last job, the big one. Sunhaven Trust moves its cash in an armoured Pony. Take it from the bank, bring it to my warehouse at the docks. Every badge in the city will come. Come back rich or do not come back.' },
    ],
    stages: [
      {
        text: 'Steal the armoured Pony at Sunhaven Trust Bank',
        target: (game, m) => m.data.car,
        onStart: (game, m) => { m.data.car = game.spawnMissionCar('van', game.city.places.bank, { armored: true }); },
        check: (game, m) => game.player.car === m.data.car,
      },
      {
        text: 'Deliver the Pony to the docks warehouse — survive',
        target: null,
        onStart: (game) => { game.wanted.addCrime(400); },
        check: (game, m) => {
          const p = game.player.car;
          return p === m.data.car && Math.hypot(p.x - game.city.places.docks.x, p.y - game.city.places.docks.y) < 75;
        },
      },
    ],
    outro: [
      { who: MARISOL, text: 'Count it twice, Leo. Sunhaven is yours now — every road, every favour. Keep driving.' },
    ],
  },
];

// --- Side work -------------------------------------------------------------------
// What the shop lives on once the story is told. Three kinds of job, dealt
// in turn: cars for the chop shop, people who need to be somewhere else,
// and packages that need to be somewhere else even faster.

const FARE_PLACES = ['hotel', 'marina', 'bank', 'hospital', 'docks', 'hideout'];
const PLACE_NAMES = {
  hotel: 'the Coral Court Hotel', marina: 'Palma Marina', bank: 'Sunhaven Trust Bank',
  hospital: 'Sunhaven General', docks: 'the Docks', hideout: 'Leo’s Hideout',
};

/** Two different named places and the distance between them, drawn off the
 * game stream so a replayed world offers the same work. */
function twoPlaces(game) {
  const [fromKey, toKey] = game.rng.shuffle(FARE_PLACES);
  const from = game.city.places[fromKey];
  const to = game.city.places[toKey];
  return { fromKey, toKey, from, to, dist: Math.hypot(to.x - from.x, to.y - from.y) };
}

function makeSideJob(game, n) {
  const P = game.city.places;
  if (n % 3 === 0) {
    // Chop Run: anything worth stealing, priced on arrival by what it is
    // worth and how much of it is left.
    return {
      title: 'Chop Run', isStory: false,
      reward: (g, m) => Math.max(60, Math.round(m.data.car.type.value * 0.5 * Math.max(0.25, m.data.car.health / 100))),
      intro: [
        { who: MARISOL, text: 'Side work, Leo: bring me anything worth stealing — a pickup or better — and I will price it by its shine. Dents cost you.' },
      ],
      stages: [
        {
          text: 'Steal a car worth $240+ (pickup, muscle, Futo GT…)',
          target: null,
          check: (g, m) => {
            const c = g.player.car;
            if (c && c.type.value >= 240) { m.data.car = c; return true; }
            return false;
          },
        },
        {
          text: 'Deliver it to Vega Auto Works — keep it pretty',
          target: P.chopShop,
          check: (g, m) => {
            if (!m.data.car || m.data.car.dead || m.data.car.health <= 0) { g.missions.fail(g, 'The car is wrecked. Marisol pays for cars, not sculptures.'); return false; }
            const p = g.player.car;
            return p === m.data.car && Math.hypot(p.x - P.chopShop.x, p.y - P.chopShop.y) < 70;
          },
        },
      ],
    };
  }
  if (n % 3 === 1) {
    // Fare Job: a stranger, a destination, a clock, and a fare that grows
    // with the distance between the two.
    const { fromKey, toKey, from, to, dist } = twoPlaces(game);
    return {
      title: 'Fare Job', isStory: false,
      reward: () => Math.round(110 + dist * 0.22),
      intro: [
        { who: MARISOL, text: `A friend of mine needs a ride from ${PLACE_NAMES[fromKey]} to ${PLACE_NAMES[toKey]}. Off the books. The meter is generous.` },
      ],
      stages: [
        {
          text: `Pick up your fare at ${PLACE_NAMES[fromKey]} — bring a car`,
          target: from,
          check: (g) => !!g.player.car && atPlace(from, 62)(g),
        },
        {
          text: `Drop your fare at ${PLACE_NAMES[toKey]}`,
          target: to,
          timer: Math.round(dist / 21) + 35,
          onStart: (g) => { g.passenger = true; },
          check: (g) => !!g.player.car && atPlace(to, 68)(g),
        },
      ],
    };
  }
  // Delivery Run: no passenger, no conversation — a package, a clock set
  // by the same generous arithmetic as the fares, and a fee for the miles.
  const { fromKey, toKey, from, to, dist } = twoPlaces(game);
  return {
    title: 'Delivery Run', isStory: false,
    reward: () => Math.round(140 + dist * 0.18),
    intro: [
      { who: MARISOL, text: `A package at ${PLACE_NAMES[fromKey]} needs to be at ${PLACE_NAMES[toKey]} — quickly, and without ever having officially existed. You know the way.` },
    ],
    stages: [
      {
        text: `Collect the package at ${PLACE_NAMES[fromKey]}`,
        target: from,
        check: (g) => atPlace(from, 60)(g),
      },
      {
        text: `Deliver the package to ${PLACE_NAMES[toKey]}`,
        target: to,
        timer: Math.round(dist / 21) + 35,
        check: (g) => atPlace(to, 65)(g),
      },
    ],
  };
}

// The defs above are written before any city exists, so the stages that
// point at fixed places carry null targets until this binds them, once,
// from the city the game actually built.
export function bindStoryPlaces(city) {
  const P = city.places;
  STORY[0].stages[0].target = P.docks;
  STORY[0].stages[1].target = P.chopShop;
  STORY[1].stages[1].target = P.chopShop;
  STORY[2].stages[0].target = P.hotel;
  STORY[2].stages[1].target = P.marina;
  STORY[3].stages[0].target = P.docks;
  STORY[3].stages[1].target = P.hideout;
  STORY[4].stages[1].target = P.docks;
  return STORY;
}

export { STORY, CAR_TYPES };
