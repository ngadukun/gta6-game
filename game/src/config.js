// config.js — the numbers every other module agrees on.
//
// Sunhaven is tuned from this one table: the street grid, Leo's pace, the
// way witnessed heat becomes stars, the reach of an officer's eyes. Change
// a value here and it changes once, everywhere, consistently — physics,
// police, HUD and minimap all read from the same page.

// --- The street plan -------------------------------------------------------
// Blocks are squares of buildings with a road on every side: COLS × ROWS
// of them, plus one closing road along the far edges. Past the last
// east–west road the ground gives up: a strip of sand, then open water.
export const BLOCK = 288;            // a block's side, in pixels
export const ROAD_W = 96;            // a road's width, in pixels
export const PITCH = BLOCK + ROAD_W; // how far apart block corners sit
export const COLS = 9;               // blocks west to east
export const ROWS = 7;               // blocks north to south
export const CITY_W = COLS * PITCH + ROAD_W;
export const BEACH_W = 420;          // sand between the last road and the sea
export const WORLD_W = CITY_W + BEACH_W;
export const WORLD_H = ROWS * PITCH + ROAD_W;

// --- Leo on foot ------------------------------------------------------------
export const PLAYER_RADIUS = 11;     // his collision circle
export const PLAYER_WALK = 150;      // px per second, unhurried
export const PLAYER_SPRINT = 235;    // px per second, Shift held

// --- Wanted heat --------------------------------------------------------------
// Crimes witnessed add points to a pot; a hundred points is a star. Left
// unwatched, the pot cools — slowly at first, then faster (see police.js).
export const HEAT_PER_STAR = 100;
export const MAX_STARS = 5;
export const HEAT_DECAY = 4.5;       // points per second while unseen

// --- The arrest -----------------------------------------------------------------
// One vocabulary for the law and the HUD alike: an officer who can see Leo
// inside COP_SIGHT_RANGE is watching him; BUST_TIME seconds held close and
// slow is an arrest; a siren is audible inside SIREN_RANGE.
export const COP_SIGHT_RANGE = 360;
export const BUST_TIME = 2.4;
export const SIREN_RANGE = 720;

// --- Supplies ---------------------------------------------------------------------
export const AMMO_PICKUP = 36;       // rounds in one porch ammo box
export const PICKUP_RESPAWN_T = 25;  // seconds before a taken box comes back

// --- How crowded the world is ---------------------------------------------------------
// The Game constructor deals this many of each citizen of the road.
export const TRAFFIC_COUNT = 15;
export const PARKED_COUNT = 18;
export const PED_COUNT = 30;
export const PED_RADIUS = 9;         // a pedestrian's collision circle

// --- Ears and eyes ----------------------------------------------------------------------
export const HORN_HEAR_RANGE = 620;  // how far a traffic horn carries to the camera
export const CAMERA_LEAD = 0.32;     // how far the camera leans into a car's velocity

// --- Naming the ground ------------------------------------------------------------
export const DISTRICT_NAMES = {
  downtown: 'Downtown Sunhaven',
  suburb: 'Palma Heights',
  beach: 'Coral Beachfront',
  docks: 'The Docks',
};

// --- Time ---------------------------------------------------------------------------
// The world advances in fixed steps. Live play and the staged screenshot
// scenes step the same clock, so a scene can never drift from the game.
export const STEP = 1 / 60;

// --- Angles ------------------------------------------------------------------------------
// The one true way to subtract two headings: the difference, folded into
// (−π, π]. Traffic, police and pedestrians all steer by it, so they can
// never disagree about which way is shorter.
/** @param {number} a @returns {number} */
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// --- Paint the renderer and the minimap share ---------------------------------------
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
