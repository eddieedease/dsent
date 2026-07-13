import * as THREE from 'three';
import { glowTexture } from './textures.js';

const LASER_COLORS = [0xff4444, 0x44aaff, 0xbb44ff, 0x66ff66]; // per laser level

// Shared glow texture / materials.
let glowTex = null;
function getGlowTex() {
  if (!glowTex) glowTex = glowTexture();
  return glowTex;
}

function makeBoltSprite(color, scale) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTex(),
    color,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(scale);
  return s;
}

// --- explosions -----------------------------------------------------------

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  explosion(pos, color = 0xffaa33, big = false) {
    const count = big ? 60 : 24;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const v = new THREE.Vector3(
        Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5,
      ).normalize().multiplyScalar((big ? 22 : 14) * (0.4 + Math.random() * 0.6));
      vels.push(v);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: getGlowTex(),
      color,
      size: big ? 3.5 : 2,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    const flash = makeBoltSprite(0xffffcc, big ? 14 : 6);
    flash.position.copy(pos);
    this.scene.add(flash);

    const light = new THREE.PointLight(color, big ? 300 : 120, big ? 60 : 30, 2);
    light.position.copy(pos);
    this.scene.add(light);

    this.items.push({ points, vels, flash, light, life: 0, maxLife: big ? 0.9 : 0.5 });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      e.life += dt;
      const t = e.life / e.maxLife;
      if (t >= 1) {
        this.scene.remove(e.points, e.flash, e.light);
        e.points.geometry.dispose();
        e.points.material.dispose();
        e.flash.material.dispose();
        this.items.splice(i, 1);
        continue;
      }
      const posAttr = e.points.geometry.attributes.position;
      for (let p = 0; p < e.vels.length; p++) {
        posAttr.array[p * 3] += e.vels[p].x * dt;
        posAttr.array[p * 3 + 1] += e.vels[p].y * dt;
        posAttr.array[p * 3 + 2] += e.vels[p].z * dt;
      }
      posAttr.needsUpdate = true;
      e.points.material.opacity = 1 - t;
      e.flash.material.opacity = Math.max(0, 1 - t * 3);
      e.flash.scale.setScalar(e.flash.scale.x * (1 + dt * 4));
      e.light.intensity *= Math.max(0, 1 - dt * 6);
    }
  }
}

// --- projectiles -----------------------------------------------------------

export class Projectiles {
  constructor(scene, level, effects, sfx) {
    this.scene = scene;
    this.level = level;
    this.effects = effects;
    this.sfx = sfx;
    this.items = [];
  }

  setLevel(level) {
    this.level = level;
    for (const p of this.items) this.scene.remove(p.sprite);
    this.items = [];
  }

  spawn({ pos, dir, speed, damage, color, scale, fromPlayer, splash = 0 }) {
    const sprite = makeBoltSprite(color, scale);
    sprite.position.copy(pos);
    this.scene.add(sprite);
    this.items.push({
      sprite,
      vel: dir.clone().normalize().multiplyScalar(speed),
      damage, fromPlayer, splash, color,
      life: 0,
    });
  }

  firePlayerLaser(camera, laserLevel) {
    const lvl = Math.min(laserLevel, 4);
    const color = LASER_COLORS[lvl - 1];
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    for (const side of [-1, 1]) {
      const offset = new THREE.Vector3(side * 1.4, -0.9, -1).applyQuaternion(camera.quaternion);
      this.spawn({
        pos: camera.position.clone().add(offset),
        dir, speed: 110,
        damage: 8 + lvl * 5,
        color, scale: 1.6,
        fromPlayer: true,
      });
    }
    this.sfx.laser();
  }

  firePlayerMissile(camera) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const offset = new THREE.Vector3(0, -1.2, -1.5).applyQuaternion(camera.quaternion);
    this.spawn({
      pos: camera.position.clone().add(offset),
      dir, speed: 70,
      damage: 70, splash: 14,
      color: 0xffcc66, scale: 2.4,
      fromPlayer: true,
    });
    this.sfx.missile();
  }

  fireEnemyBolt(pos, target, speed, damage, color = 0x66ff66) {
    const dir = target.clone().sub(pos);
    this.spawn({ pos: pos.clone(), dir, speed, damage, color, scale: 1.8, fromPlayer: false });
    this.sfx.enemyShot();
  }

  // ctx: { enemies: Enemy[], player, onEnemyHit(enemy, damage, pos), onPlayerHit(damage) }
  update(dt, ctx) {
    outer:
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life += dt;
      if (p.life > 4) { this.remove(i); continue; }

      const move = p.vel.length() * dt;
      const steps = Math.max(1, Math.ceil(move / 2.5));
      for (let s = 0; s < steps; s++) {
        p.sprite.position.addScaledVector(p.vel, dt / steps);
        const pos = p.sprite.position;

        if (this.level.isSolidAt(pos)) {
          this.detonate(i, ctx);
          continue outer;
        }
        if (p.fromPlayer) {
          for (const enemy of ctx.enemies) {
            if (enemy.dead) continue;
            if (pos.distanceToSquared(enemy.mesh.position) < enemy.radius * enemy.radius) {
              ctx.onEnemyHit(enemy, p.damage, pos.clone());
              this.detonate(i, ctx);
              continue outer;
            }
          }
        } else {
          const pr = ctx.player.radius + 0.6;
          if (pos.distanceToSquared(ctx.player.camera.position) < pr * pr) {
            ctx.onPlayerHit(p.damage);
            this.detonate(i, ctx, true);
            continue outer;
          }
        }
      }
    }
  }

  detonate(i, ctx, quiet = false) {
    const p = this.items[i];
    const pos = p.sprite.position.clone();
    if (!quiet) this.effects.explosion(pos, p.color, p.splash > 0);
    if (p.splash > 0) {
      this.sfx.explosion(true);
      for (const enemy of ctx.enemies) {
        if (enemy.dead) continue;
        const d = pos.distanceTo(enemy.mesh.position);
        if (d < p.splash) ctx.onEnemyHit(enemy, p.damage * (1 - d / p.splash), enemy.mesh.position.clone());
      }
      const pd = pos.distanceTo(ctx.player.camera.position);
      if (pd < p.splash) ctx.onPlayerHit(20 * (1 - pd / p.splash));
    }
    this.remove(i);
  }

  remove(i) {
    const p = this.items[i];
    this.scene.remove(p.sprite);
    p.sprite.material.dispose();
    this.items.splice(i, 1);
  }
}
