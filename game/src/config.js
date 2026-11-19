// Sunhaven's shared tuning. The shape of the road grid, how fast Leo walks,
// how heat turns into stars: every module reads these from here, so a number
// changed once changes everywhere the same way.

// Streets and blocks. A block is a square of buildings; roads run between
// them, and the whole grid is COLS by ROWS blocks with one extra road along
// the far edges. East of the last road: a strip of sand, then the sea.
export const BLOCK = 288;            // one city block, in pixels
export const ROAD_W = 96;            // one road, in pixels
export const PITCH = BLOCK + ROAD_W; // block-to-block spacing
export const COLS = 9;               // blocks across
export const ROWS = 7;               // blocks down
export const CITY_W = COLS * PITCH + ROAD_W;
export const BEACH_W = 420;          // sand between the last road and the water
export const WORLD_W = CITY_W + BEACH_W;
export const WORLD_H = ROWS * PITCH + ROAD_W;

// Leo on foot: his size and his two gaits.
export const PLAYER_RADIUS = 11;
export const PLAYER_WALK = 150;      // px per second
export const PLAYER_SPRINT = 235;

// Wanted heat. Crimes add points, an unseen minute lets them bleed away, and
// every full hundred is another star — and another reason to run.
export const HEAT_PER_STAR = 100;
export const MAX_STARS = 5;
export const HEAT_DECAY = 4.5;       // points per second once nobody is watching

// The arrest, in numbers the police and the HUD share: an officer who can
// see Leo at COP_SIGHT_RANGE is "watching", and BUST_TIME seconds of being
// held close and slow is a bust. The siren carries SIREN_RANGE.
export const COP_SIGHT_RANGE = 360;
export const BUST_TIME = 2.4;
export const SIREN_RANGE = 720;

// Rounds in one ammo pickup (the green boxes on friendly porches).
export const AMMO_PICKUP = 36;

// How the HUD names the ground Leo is standing on.
export const DISTRICT_NAMES = {
  downtown: 'Downtown Sunhaven',
  suburb: 'Palma Heights',
  beach: 'Coral Beachfront',
  docks: 'The Docks',
};

// The simulation advances in fixed steps, so the live game and the staged
// screenshot scenes can never drift apart.
export const STEP = 1 / 60;

// Colours the renderer and the minimap agree on.
export const COLORS = {
  grass: '#79a85b',
  grassDark: '#6d9c52',
  sidewalk: '#cfc4ae',
  road: '#3d4148',
  roadEdge: '#f3ead2',
  lane: '#e8c85a',
  sand: '#eed9a4',
  water: '#2e8fa3',
  waterDeep: '#22707f',
};
