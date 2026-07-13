import * as THREE from 'three';

const TYPES = {
  drone: {
    hp: 30, radius: 2.2, speed: 13, preferredDist: 26,
    fireCooldown: 1.9, boltSpeed: 45, boltDamage: 7, boltColor: 0x66ff66,
    score: 100, dropChance: 0.35,
  },
  hulk: {
    hp: 90, radius: 3.2, speed: 8, preferredDist: 32,
    fireCooldown: 2.6, boltSpeed: 38, boltDamage: 14, boltColor: 0xff8844,
    score: 300, dropChance: 0.7,
  },
  reactor: {
    hp: 260, radius: 5.5, speed: 0, preferredDist: 0,
    fireCooldown: 2.2, boltSpeed: 50, boltDamage: 12, boltColor: 0xff44ff,
    score: 1000, dropChance: 0,
  },
};

function buildDroneMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.7, 0),
    new THREE.MeshLambertMaterial({ color: 0x1e2a44, flatShading: true, emissive: 0x0a1530 }),
  );
  g.add(body);
  const wingMat = new THREE.MeshLambertMaterial({ color: 0x2c3a55 });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.1), wingMat);
    wing.position.set(side * 1.9, 0, 0);
    g.add(wing);
  }
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2fd6 }),
  );
  eye.position.set(0, 0.2, 1.4);
  g.add(eye);
  return g;
}

function buildHulkMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 2.6, 3),
    new THREE.MeshLambertMaterial({ color: 0x3a2048, flatShading: true, emissive: 0x180a24 }),
  );
  g.add(body);
  const armMat = new THREE.MeshLambertMaterial({ color: 0x281838 });
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2.6), armMat);
    arm.position.set(side * 2.3, -0.4, 0.4);
    g.add(arm);
  }
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x00eaff }),
  );
  eye.position.set(0, 0.6, 1.7);
  g.add(eye);
  return g;
}

function buildReactorMesh() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(4.6, 0),
    new THREE.MeshLambertMaterial({ color: 0x334455, flatShading: true, transparent: true, opacity: 0.92 }),
  );
  g.add(shell);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff33ff }),
  );
  g.add(core);
  const light = new THREE.PointLight(0xff44ff, 220, 70, 1.8);
  g.add(light);
  g.userData.core = core;
  return g;
}

const BUILDERS = { drone: buildDroneMesh, hulk: buildHulkMesh, reactor: buildReactorMesh };

class Enemy {
  constructor(type, pos) {
    this.type = type;
    this.cfg = TYPES[type];
    this.hp = this.cfg.hp;
    this.radius = this.cfg.radius;
    this.mesh = BUILDERS[type]();
    this.mesh.position.copy(pos);
    this.dead = false;
    this.cooldown = 1 + Math.random() * this.cfg.fireCooldown;
    this.wanderDir = new THREE.Vector3();
    this.wanderTimer = 0;
    this.strafePhase = Math.random() * Math.PI * 2;
    this.time = 0;
  }

  update(dt, ctx) {
    this.time += dt;
    const { player, level, projectiles } = ctx;
    const myPos = this.mesh.position;
    const playerPos = player.camera.position;
    const toPlayer = playerPos.clone().sub(myPos);
    const dist = toPlayer.length();

    if (this.type === 'reactor') {
      this.mesh.rotation.y += dt * 0.6;
      this.mesh.rotation.x += dt * 0.25;
      const core = this.mesh.userData.core;
      core.scale.setScalar(1 + Math.sin(this.time * 5) * 0.12);
      this.cooldown -= dt;
      if (this.cooldown <= 0 && dist < 80 && level.hasLineOfSight(myPos, playerPos)) {
        projectiles.fireEnemyBolt(myPos, playerPos, this.cfg.boltSpeed, this.cfg.boltDamage, this.cfg.boltColor);
        this.cooldown = this.cfg.fireCooldown;
      }
      return;
    }

    const seesPlayer = dist < 95 && level.hasLineOfSight(myPos, playerPos);
    const vel = new THREE.Vector3();

    if (seesPlayer) {
      this.mesh.lookAt(playerPos);
      // close to preferred range, then strafe around the player
      const dir = toPlayer.clone().divideScalar(dist);
      if (dist > this.cfg.preferredDist) vel.addScaledVector(dir, this.cfg.speed);
      else if (dist < this.cfg.preferredDist * 0.6) vel.addScaledVector(dir, -this.cfg.speed * 0.7);
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      vel.addScaledVector(side, Math.sin(this.time * 1.3 + this.strafePhase) * this.cfg.speed * 0.6);
      vel.y += Math.cos(this.time * 1.7 + this.strafePhase) * 2;

      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        // lead the shot slightly toward where the player is drifting
        const aim = playerPos.clone().addScaledVector(player.velocity, dist / this.cfg.boltSpeed * 0.5);
        const muzzle = myPos.clone().addScaledVector(toPlayer.normalize(), this.radius + 1);
        projectiles.fireEnemyBolt(muzzle, aim, this.cfg.boltSpeed, this.cfg.boltDamage, this.cfg.boltColor);
        this.cooldown = this.cfg.fireCooldown * (0.8 + Math.random() * 0.4);
      }
    } else {
      // lazy wander
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderDir.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5).normalize();
        this.wanderTimer = 2 + Math.random() * 3;
      }
      vel.addScaledVector(this.wanderDir, this.cfg.speed * 0.35);
      this.mesh.rotation.y += dt * 0.5;
    }

    myPos.addScaledVector(vel, dt);
    if (level.collideSphere(myPos, this.radius)) {
      this.wanderTimer = 0; // pick a new direction after bumping a wall
    }
  }
}

export class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
  }

  spawnForLevel(level) {
    this.clear();
    for (const { type, pos } of level.enemySpawns) this.add(type, pos);
    this.reactor = this.add('reactor', level.reactorPos);
  }

  add(type, pos) {
    const e = new Enemy(type, pos);
    this.scene.add(e.mesh);
    this.enemies.push(e);
    return e;
  }

  kill(enemy) {
    enemy.dead = true;
    this.scene.remove(enemy.mesh);
  }

  clear() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
    this.reactor = null;
  }

  update(dt, ctx) {
    for (const e of this.enemies) {
      if (!e.dead) e.update(dt, ctx);
    }
  }

  get alive() { return this.enemies.filter((e) => !e.dead); }
}
