import * as THREE from 'three';

// 6DOF ship: the camera IS the ship. Quaternion-based orientation so there
// is no gimbal lock and full Descent-style freedom (pitch/yaw/roll/slide).

const ACCEL = 90;
const MAX_SPEED = 42;
const DAMPING = 3.2;       // per-second velocity damping
const ROLL_SPEED = 2.2;    // rad/s
const MOUSE_SENS = 0.0022;
const RADIUS = 2.4;        // collision sphere
const BOUNCE = 0.4;        // restitution when caroming off a wall (0 = stick, 1 = perfectly elastic)

// gamepad tuning
const PAD_DEADZONE = 0.18;
const PAD_YAW_RATE = 2.1;   // rad/s at full stick
const PAD_PITCH_RATE = 1.8;
const PAD_ROLL_RATE = 2.2;

function dz(v) { return Math.abs(v) > PAD_DEADZONE ? v : 0; }

export class Player {
  constructor(camera, level) {
    this.camera = camera;
    this.level = level;
    this.velocity = new THREE.Vector3();
    this._hitNormal = new THREE.Vector3();
    this.keys = {};
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.firing = false;

    // stats
    this.shield = 100;
    this.energy = 100;
    this.lives = 2;
    this.missiles = 3;
    this.laserLevel = 1;
    this.weapon = 'laser'; // 'laser' | 'missile'
    this.radius = RADIUS;

    // gamepad state (polled each frame)
    this.padPrimary = false;   // RT / A: fire selected weapon
    this.padMissile = false;   // LT: fire a missile directly
    this.pingRequested = false; // Y: guide ping, consumed by main.js
    this.prevPadButtons = {};
    this.onWeaponChange = null; // set by main.js to sync the HUD

    window.addEventListener('gamepadconnected', (e) => {
      this.onGamepad?.(e.gamepad.id);
    });

    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    window.addEventListener('mousedown', (e) => { if (e.button === 0) this.firing = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.firing = false; });
  }

  setLevel(level) {
    this.level = level;
    this.respawn();
  }

  respawn() {
    this.camera.position.copy(this.level.playerStart);
    this.camera.quaternion.identity();
    // face the first open corridor instead of a wall
    const [sx, sy, sz] = this.level.startCell;
    const dirs = [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1], [0, 1, 0], [0, -1, 0]];
    for (const [dx, dy, dz] of dirs) {
      if (!this.level.isSolid(sx + dx, sy + dy, sz + dz)) {
        this.camera.lookAt(this.level.cellCenter(sx + dx, sy + dy, sz + dz));
        break;
      }
    }
    this.velocity.set(0, 0, 0);
    this.shield = 100;
    this.energy = 100;
  }

  wantsFire() { return this.firing || this.keys['Space'] || this.padPrimary; }

  // Poll the first connected gamepad.
  // Left stick: throttle (Y) + strafe (X). Right stick: look (pitch/yaw).
  // LB: slide down, RB: slide up. RT/A: fire, LT: missile, B: switch weapon.
  // D-pad: left/right strafe, up/down roll.
  pollGamepad(dt, look, thrust) {
    this.padPrimary = false;
    this.padMissile = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) { if (p && p.connected) { gp = p; break; } }
    if (!gp) return;

    const btn = (i) => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.3);
    const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0);
    const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);

    look.yaw += -rx * PAD_YAW_RATE * dt;
    look.pitch += -ry * PAD_PITCH_RATE * dt;

    thrust.z += ly;                       // stick up = forward
    thrust.x += lx;                       // stick left/right = strafe
    if (btn(4)) thrust.y -= 1;            // LB: down
    if (btn(5)) thrust.y += 1;            // RB: up
    if (btn(14)) thrust.x -= 1;           // d-pad left: strafe
    if (btn(15)) thrust.x += 1;           // d-pad right
    if (btn(12)) look.roll += PAD_ROLL_RATE * dt;   // d-pad up
    if (btn(13)) look.roll -= PAD_ROLL_RATE * dt;   // d-pad down

    this.padPrimary = btn(7) || btn(0);   // RT or A
    this.padMissile = btn(6);             // LT

    // B: toggle weapon (edge-triggered)
    const b = btn(1);
    if (b && !this.prevPadButtons[1]) {
      this.weapon = this.weapon === 'laser' ? 'missile' : 'laser';
      this.onWeaponChange?.(this.weapon);
    }
    this.prevPadButtons[1] = b;

    // Y: guide ping (edge-triggered)
    const y = btn(3);
    if (y && !this.prevPadButtons[3]) this.pingRequested = true;
    this.prevPadButtons[3] = y;
  }

  update(dt) {
    const cam = this.camera;

    // --- look (pitch/yaw from mouse, roll from Q/E), all in ship-local space
    const look = {
      pitch: -this.mouseDY * MOUSE_SENS,
      yaw: -this.mouseDX * MOUSE_SENS,
      roll: 0,
    };
    this.mouseDX = 0;
    this.mouseDY = 0;
    if (this.keys['KeyQ']) look.roll += ROLL_SPEED * dt;
    if (this.keys['KeyE']) look.roll -= ROLL_SPEED * dt;

    // --- thrust in local axes
    const thrust = new THREE.Vector3();
    if (this.keys['KeyW']) thrust.z -= 1;
    if (this.keys['KeyS']) thrust.z += 1;
    if (this.keys['KeyA']) thrust.x -= 1;
    if (this.keys['KeyD']) thrust.x += 1;
    if (this.keys['KeyC']) thrust.y += 1;   // C: slide up
    if (this.keys['KeyZ']) thrust.y -= 1;   // Z: slide down

    this.pollGamepad(dt, look, thrust);

    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(look.pitch, look.yaw, look.roll, 'YXZ'));
    cam.quaternion.multiply(q);

    if (thrust.lengthSq() > 0) {
      thrust.clampLength(0, 1).applyQuaternion(cam.quaternion).multiplyScalar(ACCEL * dt);
      this.velocity.add(thrust);
    }

    // damping + speed cap
    this.velocity.multiplyScalar(Math.exp(-DAMPING * dt));
    if (this.velocity.length() > MAX_SPEED) this.velocity.setLength(MAX_SPEED);

    // --- integrate + collide (substep so fast movement can't tunnel)
    const steps = Math.max(1, Math.ceil((this.velocity.length() * dt) / (RADIUS * 0.5)));
    for (let i = 0; i < steps; i++) {
      cam.position.addScaledVector(this.velocity, dt / steps);
      if (this.level.collideSphere(cam.position, RADIUS, this._hitNormal)) {
        // Bounce off the wall: reflect the velocity component along the
        // surface normal (with restitution) instead of just sanding it
        // down, so hitting a wall caroms the ship off it rather than
        // gluing it to a slow grind. Tangential (sliding) velocity is
        // left mostly intact.
        if (this._hitNormal.lengthSq() > 1e-8) {
          const n = this._hitNormal.normalize();
          const vn = this.velocity.dot(n);
          if (vn < 0) this.velocity.addScaledVector(n, -vn * (1 + BOUNCE));
        }
        this.velocity.multiplyScalar(0.92);
      }
    }

    // energy slowly recharges
    this.energy = Math.min(100, this.energy + 1.6 * dt);
  }

  damage(amount) {
    this.shield -= amount;
    return this.shield <= 0;
  }
}
