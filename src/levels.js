// Level definitions. Mazes are generated from a seed so each level is
// stable between plays but the three levels feel distinct.
// `neon` drives the emissive grid/panel accents per level.

export const LEVELS = [
  {
    name: 'LEVEL 1 — NEON SPRAWL',
    seed: 1337,
    size: [15, 5, 15],        // maze grid cells (x, y, z)
    rooms: 4,
    neon: '#00eaff',
    tint: { base: [16, 22, 46], variation: [26, 34, 62], floorBase: [14, 17, 28] },
    fog: 0x030510,
    enemies: { drone: 6, hulk: 1 },
    powerups: 6,
  },
  {
    name: 'LEVEL 2 — SYNTH DISTRICT',
    seed: 4242,
    size: [19, 7, 19],
    rooms: 6,
    neon: '#ff2fd6',
    tint: { base: [34, 14, 38], variation: [48, 24, 56], floorBase: [22, 12, 26] },
    fog: 0x0a0210,
    enemies: { drone: 9, hulk: 3 },
    powerups: 8,
  },
  {
    name: 'LEVEL 3 — GRID ZERO',
    seed: 9001,
    size: [23, 9, 23],
    rooms: 8,
    neon: '#39ff88',
    tint: { base: [12, 32, 22], variation: [20, 52, 34], floorBase: [10, 22, 16] },
    fog: 0x010804,
    enemies: { drone: 12, hulk: 5 },
    powerups: 10,
  },
];
