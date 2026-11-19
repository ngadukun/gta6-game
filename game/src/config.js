// Sunhaven's tuning constants: world size, the road grid, physics and heat.
// Everything the other modules agree on lives here so the city feels the same
// from every system that touches it.

// The city grid: city blocks separated by two-lane roads, a beach and the sea
// along the east edge, the docks in the south-east corner.
export const BLOCK = 288;          // city block size in pixels
export const ROAD_W = 96;          // road width in pixels
export const PITCH = BLOCK + ROAD_W;
export const COLS = 9;             // blocks across
export const ROWS = 7;             // blocks down
export const CITY_W = COLS * PITCH + ROAD_W;
export const BEACH_W = 420;        // sand strip east of the last road
export const WORLD_W = CITY_W + BEACH_W;
export const WORLD_H = ROWS * PITCH + ROAD_W;

// Player on foot.
export const PLAYER_RADIUS = 11;
export const PLAYER_WALK = 150;    // px per second
export const PLAYER_SPRINT = 235;

// Wanted heat: crimes add heat, heat decays out of sight, stars follow heat.
export const HEAT_PER_STAR = 100;
export const MAX_STARS = 5;
export const HEAT_DECAY = 4.5;     // heat per second while no cop sees you

// Ammo pickups scattered at friendly porches around the city.
export const AMMO_PICKUP = 36;

// District names, shown on the HUD so the player learns the city's geography.
export const DISTRICT_NAMES = {
  downtown: 'Downtown Sunhaven',
  suburb: 'Palma Heights',
  beach: 'Coral Beachfront',
  docks: 'The Docks',
};

// Fixed simulation step, so the game and the screenshot scenes agree.
export const STEP = 1 / 60;

// Sun-soaked palette shared by the renderer and the minimap.
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
  roofEdge: '#00000022',
};
