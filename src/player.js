import * as THREE from 'three';

// 6DOF ship: the camera IS the ship. Quaternion-based orientation so there
// is no gimbal lock and full Descent-style freedom (pitch/yaw/roll/slide).

const ACCEL = 90;
const MAX_SPEED = 42;
const DAMPING = 3.2;       // per-second velocity damping
const ROLL_SPEED = 2.2;    // rad/s
const MOUSE_SENS = 0.0022;
const RADIUS = 2.4;        // collision sphere

export class Player {
  constructor(camera, level) {
    this.camera = camera;
    this.level = level;
    this.velocity = new THREE.Vector3();
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

  wantsFire() { return this.firing || this.keys['Space']; }

  update(dt) {
    const cam = this.camera;

    // --- look (pitch/yaw from mouse, roll from Q/E), all in ship-local space
    const pitch = -this.mouseDY * MOUSE_SENS;
    const yaw = -this.mouseDX * MOUSE_SENS;
    this.mouseDX = 0;
    this.mouseDY = 0;
    let roll = 0;
    if (this.keys['KeyQ']) roll += ROLL_SPEED * dt;
    if (this.keys['KeyE']) roll -= ROLL_SPEED * dt;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
    cam.quaternion.multiply(q);

    // --- thrust in local axes
    const thrust = new THREE.Vector3();
    if (this.keys['KeyW']) thrust.z -= 1;
    if (this.keys['KeyS']) thrust.z += 1;
    if (this.keys['KeyA']) thrust.x -= 1;
    if (this.keys['KeyD']) thrust.x += 1;
    if (this.keys['KeyR']) thrust.y += 1;
    if (this.keys['KeyF']) thrust.y -= 1;
    if (thrust.lengthSq() > 0) {
      thrust.normalize().applyQuaternion(cam.quaternion).multiplyScalar(ACCEL * dt);
      this.velocity.add(thrust);
    }

    // damping + speed cap
    this.velocity.multiplyScalar(Math.exp(-DAMPING * dt));
    if (this.velocity.length() > MAX_SPEED) this.velocity.setLength(MAX_SPEED);

    // --- integrate + collide (substep so fast movement can't tunnel)
    const steps = Math.max(1, Math.ceil((this.velocity.length() * dt) / (RADIUS * 0.5)));
    for (let i = 0; i < steps; i++) {
      cam.position.addScaledVector(this.velocity, dt / steps);
      if (this.level.collideSphere(cam.position, RADIUS)) {
        // kill velocity into the wall by re-deriving it from actual motion
        this.velocity.multiplyScalar(0.82);
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
