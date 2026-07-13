# DSENT

A Descent-style 6DOF tunnel shooter built with [three.js](https://threejs.org/).

Fly a ship through procedurally generated 3D mine mazes, blast robot drones,
collect powerups, destroy the reactor and escape through the exit portal.
Three levels of increasing size and difficulty.

## Controls

### Keyboard + mouse

| Input | Action |
| --- | --- |
| Mouse | Look / steer |
| Left mouse / Space | Fire |
| W / S | Thrust forward / back |
| A / D | Strafe left / right |
| Z / C | Slide down / up |
| Q / E | Roll |
| 1 / 2 | Select laser / missiles |
| F | Toggle fullscreen |

### Gamepad

| Input | Action |
| --- | --- |
| Left stick | Throttle (Y) + strafe (X) |
| Right stick | Look (pitch / yaw) |
| LB / RB | Slide down / up |
| RT or A | Fire selected weapon |
| LT | Fire missile |
| B | Switch weapon |
| D-pad left/right | Strafe |
| D-pad up/down | Roll |

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
