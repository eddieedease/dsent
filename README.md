# DSENT

A Descent-style 6DOF tunnel shooter built with [three.js](https://threejs.org/).

Fly a ship through procedurally generated 3D mine mazes, blast robot drones,
collect powerups, destroy the reactor and escape through the exit portal.
Three levels of increasing size and difficulty.

## Controls

| Input | Action |
| --- | --- |
| Mouse | Look / steer |
| Left mouse / Space | Fire |
| W / S | Thrust forward / back |
| A / D | Strafe left / right |
| R / F | Slide up / down |
| Q / E | Roll |
| 1 / 2 | Select laser / missiles |

## Gameplay

- **Lasers** consume energy (recharges slowly); upgrade them up to level 4.
- **Missiles** are limited ammo with splash damage.
- Powerups: shield (blue), energy (yellow), laser upgrade (purple), missiles (red).
- Each level hides a **reactor** — destroy it to open the green **exit portal**, then fly through it.

## Development

Requires Node 16+.

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build in dist/
```

Everything (textures, sounds, levels) is generated procedurally — there are no
asset files.
