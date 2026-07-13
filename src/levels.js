// Level definitions. Mazes are generated from a seed so each level is
// stable between plays but the three levels feel distinct.

export const LEVELS = [
  {
    name: 'LEVEL 1 — LUNAR OUTPOST',
    seed: 1337,
    size: [15, 5, 15],        // maze grid cells (x, y, z)
    rooms: 4,
    tint: { base: [40, 45, 90], variation: [60, 60, 90], floorBase: [70, 70, 78] },
    fog: 0x04060c,
    enemies: { drone: 6, hulk: 1 },
    powerups: 6,
  },
  {
    name: 'LEVEL 2 — VENUS MINES',
    seed: 4242,
    size: [19, 7, 19],
    rooms: 6,
    tint: { base: [80, 50, 30], variation: [80, 60, 40], floorBase: [80, 68, 58] },
    fog: 0x0a0503,
    enemies: { drone: 9, hulk: 3 },
    powerups: 8,
  },
  {
    name: 'LEVEL 3 — MARS PROCESSING CORE',
    seed: 9001,
    size: [23, 9, 23],
    rooms: 8,
    tint: { base: [55, 75, 55], variation: [50, 70, 50], floorBase: [60, 76, 62] },
    fog: 0x020803,
    enemies: { drone: 12, hulk: 5 },
    powerups: 10,
  },
];
