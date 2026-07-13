import * as THREE from 'three';

const KINDS = {
  shield:  { color: 0x3388ff, label: 'SHIELD +25' },
  energy:  { color: 0xffdd33, label: 'ENERGY +30' },
  laser:   { color: 0xbb44ff, label: 'LASER UPGRADE' },
  missile: { color: 0xff5533, label: 'MISSILES +2' },
};

const PICKUP_DIST = 5;

export class PowerupManager {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  spawnForLevel(level) {
    this.clear();
    const kinds = Object.keys(KINDS);
    level.powerupSpawns.forEach((pos, i) => {
      // guarantee a spread of kinds, then random
      const kind = i < kinds.length ? kinds[i % kinds.length] : kinds[Math.floor(Math.random() * kinds.length)];
      this.add(kind, pos);
    });
  }

  add(kind, pos) {
    const { color } = KINDS[kind];
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.3, 0),
      new THREE.MeshBasicMaterial({ color }),
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2, 0.15, 6, 18),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }),
    );
    const light = new THREE.PointLight(color, 60, 25, 2);
    group.add(core, ring, light);
    group.position.copy(pos);
    this.scene.add(group);
    this.items.push({ kind, group, baseY: pos.y, phase: Math.random() * Math.PI * 2, time: 0 });
  }

  clear() {
    for (const p of this.items) this.scene.remove(p.group);
    this.items = [];
  }

  // Returns the kind + label of a powerup picked up this frame, or null.
  update(dt, playerPos) {
    let picked = null;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.time += dt;
      p.group.rotation.y += dt * 2;
      p.group.rotation.x += dt * 0.7;
      p.group.position.y = p.baseY + Math.sin(p.time * 2 + p.phase) * 0.8;
      if (p.group.position.distanceTo(playerPos) < PICKUP_DIST) {
        picked = { kind: p.kind, label: KINDS[p.kind].label };
        this.scene.remove(p.group);
        this.items.splice(i, 1);
      }
    }
    return picked;
  }
}
