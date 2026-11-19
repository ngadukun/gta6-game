// The story of Sunhaven: five jobs for Marisol Vega of Vega Auto Works, told
// through a stage engine. A mission is a list of stages; a stage is an
// objective with a place, an optional clock, and a test the world must pass.
// Between missions the chop shop offers quick side work (this file's second
// pass). Failing a job — a wrecked prize car, a dead clock — just means
// Marisol will offer it again.
import { CAR_TYPES, makeCar } from './vehicles.js';

const MARISOL = 'Marisol Vega';
const LEO = 'Leo';

export class MissionSystem {
  constructor() {
    this.storyIndex = 0;      // next story mission to offer
    this.active = null;       // { def, stageIndex, stageT, data }
    this.sideJob = null;      // generated side work, when offered
    this.completedStory = false;
    this.jobsDone = 0;
  }

  get busy() { return this.active !== null; }

  /** The HUD objective: text plus a world target, or null. */
  objective(game) {
    if (!this.active) return null;
    const stage = this.active.def.stages[this.active.stageIndex];
    if (!stage) return null;
    const target = typeof stage.target === 'function' ? stage.target(game, this.active) : stage.target;
    const text = stage.dynamicText ? stage.dynamicText(this.active) : stage.text;
    return { text, target, timer: stage.timer ? this.active.stageT : null };
  }

  /** Begin the next story mission — or generated side work once the story
   * is done, so Sunhaven keeps paying Leo long after the credits. */
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
    game.passenger = false;   // whoever was riding with Leo bails here
    this.active = null;
  }

  complete(game) {
    const mission = this.active;
    const { def } = mission;
    // A reward may be a function of how the job went (a fare's distance, a
    // chopped car's worth and condition) as well as a flat story fee.
    const reward = typeof def.reward === 'function' ? def.reward(game, mission) : def.reward;
    this.active = null;
    game.passenger = false;   // the fare, the accountant: delivered and gone
    this.jobsDone += 1;
    if (def.isStory) {
      this.storyIndex += 1;
      if (this.storyIndex >= STORY.length) this.completedStory = true;
    }
    game.earnCash(reward, game.player.car ? game.player.car.x : game.player.x, game.player.car ? game.player.car.y : game.player.y);
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

// --- Stage helpers -----------------------------------------------------------

function atPlace(place, r = 60) {
  return (game) => {
    const p = game.player.car ?? game.player;
    return Math.hypot(p.x - place.x, p.y - place.y) < r;
  };
}

function gotoStage(text, place, extra = {}) {
  const stage = { text, target: place, ...extra };
  // The target is read from the stage itself at check time: fixed places are
  // bound after the city exists (bindStoryPlaces), so nothing is captured early.
  stage.check = (game, mission) => {
    const t = mission.def.stages[mission.stageIndex].target;
    if (!t) return false;
    const p = game.player.car ?? game.player;
    return Math.hypot(p.x - t.x, p.y - t.y) < (stage.r ?? 60);
  };
  return stage;
}

// --- The story ---------------------------------------------------------------

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

// --- Side work -----------------------------------------------------------------
// Endless small jobs for after the story: Marisol always needs cars, and
// Sunhaven always needs rides. Alternating by jobs done keeps them fresh.

const FARE_PLACES = ['hotel', 'marina', 'bank', 'hospital', 'docks', 'hideout'];
const PLACE_NAMES = {
  hotel: 'the Coral Court Hotel', marina: 'Palma Marina', bank: 'Sunhaven Trust Bank',
  hospital: 'Sunhaven General', docks: 'the Docks', hideout: 'Leo’s Hideout',
};

function makeSideJob(game, n) {
  const P = game.city.places;
  if (n % 2 === 0) {
    // Chop Run: any car worth stealing, priced by value and condition.
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
  // Fare Job: a stranger, a clock, and a tip for distance.
  const [fromKey, toKey] = game.rng.shuffle(FARE_PLACES);
  const from = P[fromKey];
  const to = P[toKey];
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
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

// Stage targets that point at fixed places are filled in here, once, from the
// city the game built: the defs above are written before any city exists.
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
