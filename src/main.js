import * as THREE from 'three';
import { LEVELS } from './levels.js';
import { Level } from './level.js';
import { Player } from './player.js';
import { Projectiles, Effects } from './weapons.js';
import { EnemyManager } from './enemies.js';
import { PowerupManager } from './powerups.js';
import { hud } from './hud.js';
import { initAudio, sfx } from './audio.js';

// --- renderer / scene -------------------------------------------------------

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);

scene.add(new THREE.AmbientLight(0xffffff, 0.22));

// Close-range fill so the hull/nearby geometry isn't pitch black outside
// the headlight cones.
const fillLight = new THREE.PointLight(0xffffff, 90, 40, 1.8);
camera.add(fillLight);

// Twin cockpit headlights: forward-facing beams mounted either side of the
// canopy, like a ship's actual headlamps rather than a floating glow. Each
// spotlight's target is a sibling object out in front of it — since both
// are children of the camera, they inherit its position/orientation every
// frame for free.
for (const side of [-1, 1]) {
  const spot = new THREE.SpotLight(0xdcefff, 480, 140, THREE.MathUtils.degToRad(26), 0.45, 1.6);
  spot.position.set(side * 1.6, -0.7, -0.4);
  const target = new THREE.Object3D();
  target.position.set(side * 1.6, -0.7, -30);
  spot.target = target;
  camera.add(spot, target);
}

scene.add(camera);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- game state --------------------------------------------------------------

let state = 'menu'; // menu | playing | paused | dead | gameover | won
let levelIndex = 0;
let score = 0;
let level = null;
let exitPortal = null;
let exitOpen = false;
let laserCooldown = 0;
let missileCooldown = 0;
let shakeTime = 0;
let guidePingTime = 0;
const GUIDE_PING_DURATION = 4;

const effects = new Effects(scene);
const player = new Player(camera, null);
const projectiles = new Projectiles(scene, null, effects, sfx);
const enemies = new EnemyManager(scene);
const powerups = new PowerupManager(scene);

function loadLevel(index) {
  const config = LEVELS[index];
  if (level) scene.remove(level.group);
  if (exitPortal) scene.remove(exitPortal);

  level = new Level(config);
  scene.add(level.group);
  scene.fog = new THREE.Fog(config.fog, 30, 160);
  scene.background = new THREE.Color(config.fog);

  player.setLevel(level);
  projectiles.setLevel(level);
  enemies.spawnForLevel(level);
  powerups.spawnForLevel(level);
  exitOpen = false;

  exitPortal = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4, 0.5, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xff3333 }),
  );
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(3.6, 24),
    new THREE.MeshBasicMaterial({ color: 0x220000, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  exitPortal.add(ring, disc);
  exitPortal.position.copy(level.exitPos);
  scene.add(exitPortal);

  hud.setLevel(config.name);
  hud.setLives(player.lives);
  hud.message(config.name, 3);
  guidePingTime = 0;
  hud.hideGuide();

  warmShaders();
}

// Three.js compiles a shader program the first time a given material/light
// combination is actually rendered, which stalls the frame it happens on.
// Point lights in particular change the compiled "light count" variant for
// every lit material in the scene, so the first time the player drifts into
// an open room with several level lights + the reactor light + a stray
// explosion, a bunch of programs recompile at once — the mid-flight dip.
// Precompiling here (during the level-load hitch, which is already expected)
// with some extra headroom lights covers both the level's real light count
// and the handful of dynamic explosion/muzzle-flash lights that show up
// during combat, so those compiles never happen mid-flight again.
let shadersWarmed = false;
function warmShaders() {
  const extras = [];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight(0xffffff, 1, 10);
    l.position.set(1e4 + i, 1e4, 1e4);
    scene.add(l);
    extras.push(l);
  }
  // Also prime the bolt/explosion sprite & points materials once — they're
  // created fresh per-shot/per-kill, so their shader program only exists
  // after the first real one fires mid-combat otherwise.
  if (!shadersWarmed) {
    shadersWarmed = true;
    const far = new THREE.Vector3(1e4, 1e4, 1e4);
    projectiles.spawn({ pos: far, dir: new THREE.Vector3(1, 0, 0), speed: 1, damage: 0, color: 0xffffff, scale: 1, fromPlayer: true });
    effects.explosion(far, 0xffffff, true);
  }
  renderer.compile(scene, camera);
  for (const l of extras) scene.remove(l);
}

function openExit() {
  exitOpen = true;
  exitPortal.children[0].material.color.set(0x33ff66);
  exitPortal.children[1].material.color.set(0x0a3311);
  hud.message('REACTOR DESTROYED — EXIT OPEN', 4);
}

// --- combat callbacks ---------------------------------------------------------

function onEnemyHit(enemy, damage, pos) {
  enemy.hp -= damage;
  if (enemy.hp <= 0 && !enemy.dead) {
    enemies.kill(enemy);
    const big = enemy.type !== 'drone';
    effects.explosion(enemy.mesh.position, 0xffaa33, big);
    sfx.explosion(big);
    score += enemy.cfg.score;
    hud.setScore(score);
    if (enemy.type === 'reactor') {
      openExit();
    } else if (Math.random() < enemy.cfg.dropChance) {
      const kinds = ['shield', 'energy', 'missile', 'laser'];
      const kind = kinds[Math.floor(Math.random() * (Math.random() < 0.8 ? 3 : 4))];
      powerups.add(kind, enemy.mesh.position.clone());
    }
  } else {
    effects.explosion(pos, 0xff6633, false);
  }
}

function onPlayerHit(damage) {
  if (state !== 'playing') return;
  sfx.hit();
  shakeTime = 0.35;
  if (player.damage(damage)) {
    playerDied();
  }
}

function playerDied() {
  effects.explosion(camera.position.clone(), 0xffcc44, true);
  sfx.explosion(true);
  player.lives -= 1;
  hud.setLives(Math.max(0, player.lives));
  if (player.lives < 0) {
    state = 'gameover';
    document.exitPointerLock();
    hud.overlay('GAME OVER', `FINAL SCORE: ${score}`, 'CLICK TO RESTART');
  } else {
    player.respawn();
    hud.message('SHIP DESTROYED', 2.5);
  }
}

function applyPowerup(kind) {
  switch (kind) {
    case 'shield': player.shield = Math.min(200, player.shield + 25); break;
    case 'energy': player.energy = Math.min(100, player.energy + 30); break;
    case 'missile': player.missiles += 2; hud.setMissiles(player.missiles); break;
    case 'laser':
      player.laserLevel = Math.min(4, player.laserLevel + 1);
      hud.setLaserLevel(player.laserLevel);
      break;
  }
  score += 50;
  hud.setScore(score);
  sfx.pickup();
}

function requestGuidePing() {
  if (state !== 'playing') return;
  guidePingTime = GUIDE_PING_DURATION;
  sfx.pickup();
}

// --- input / flow --------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (e.code === 'Digit1') { player.weapon = 'laser'; hud.setWeapon('LASER'); }
  if (e.code === 'Digit2') { player.weapon = 'missile'; hud.setWeapon('MISSILE'); }
  if (e.code === 'KeyG') requestGuidePing();
  if (e.code === 'KeyF') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
});

player.onWeaponChange = (w) => hud.setWeapon(w === 'laser' ? 'LASER' : 'MISSILE');
player.onGamepad = (id) => hud.message('GAMEPAD CONNECTED', 2);

const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => {
  initAudio();
  if (state === 'menu' || state === 'gameover') {
    if (state === 'gameover') {
      score = 0; levelIndex = 0;
      player.lives = 2; player.missiles = 3; player.laserLevel = 1;
      hud.setScore(0); hud.setMissiles(3); hud.setLaserLevel(1);
      loadLevel(0);
    } else {
      loadLevel(levelIndex);
    }
  } else if (state === 'won') {
    score = 0; levelIndex = 0;
    player.lives = 2; player.missiles = 3; player.laserLevel = 1;
    hud.setScore(0); hud.setMissiles(3); hud.setLaserLevel(1);
    loadLevel(0);
  }
  state = 'playing';
  hud.hideOverlay();
  renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing') {
    state = 'paused';
    hud.overlay('PAUSED', 'Pointer released', 'CLICK TO RESUME');
  }
});

function nextLevel() {
  levelIndex += 1;
  if (levelIndex >= LEVELS.length) {
    state = 'won';
    document.exitPointerLock();
    hud.overlay('MISSION COMPLETE', `ALL MINES CLEARED<br/>FINAL SCORE: ${score}`, 'CLICK TO PLAY AGAIN');
    return;
  }
  loadLevel(levelIndex);
  hud.message(LEVELS[levelIndex].name, 3);
}

// --- main loop -------------------------------------------------------------------

const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state === 'playing') {
    player.update(dt);
    if (player.pingRequested) { player.pingRequested = false; requestGuidePing(); }

    // firing
    laserCooldown -= dt;
    missileCooldown -= dt;
    if (player.wantsFire()) {
      if (player.weapon === 'laser' && laserCooldown <= 0 && player.energy >= 2) {
        projectiles.firePlayerLaser(camera, player.laserLevel);
        player.energy -= 2;
        laserCooldown = 0.22;
      } else if (player.weapon === 'missile' && missileCooldown <= 0 && player.missiles > 0) {
        projectiles.firePlayerMissile(camera);
        player.missiles -= 1;
        hud.setMissiles(player.missiles);
        missileCooldown = 0.8;
      }
    }
    // gamepad LT fires missiles regardless of the selected weapon
    if (player.padMissile && missileCooldown <= 0 && player.missiles > 0) {
      projectiles.firePlayerMissile(camera);
      player.missiles -= 1;
      hud.setMissiles(player.missiles);
      missileCooldown = 0.8;
    }

    enemies.update(dt, { player, level, projectiles });
    projectiles.update(dt, { enemies: enemies.alive, player, onEnemyHit, onPlayerHit });

    const picked = powerups.update(dt, camera.position);
    if (picked) {
      applyPowerup(picked.kind);
      hud.message(picked.label, 1.5);
    }

    // exit portal
    exitPortal.rotation.y += dt * (exitOpen ? 2 : 0.4);
    if (exitOpen && camera.position.distanceTo(exitPortal.position) < 5) {
      sfx.pickup();
      nextLevel();
    }

    // camera shake on damage
    if (shakeTime > 0) {
      shakeTime -= dt;
      camera.position.x += (Math.random() - 0.5) * 0.3;
      camera.position.y += (Math.random() - 0.5) * 0.3;
    }

    // objective guide ping: points toward the reactor (or exit, once open)
    // by following the maze's corridors rather than a straight line.
    if (guidePingTime > 0) {
      guidePingTime -= dt;
      const target = exitOpen ? 'exit' : 'reactor';
      const dir = level.guideDirection(camera.position, target);
      const opacity = Math.min(1, Math.max(0, guidePingTime));
      if (dir) {
        const localDir = dir.clone().applyQuaternion(camera.quaternion.clone().invert());
        const angle = Math.atan2(localDir.x, localDir.y) * THREE.MathUtils.RAD2DEG;
        hud.setGuide(angle, exitOpen ? 'EXIT' : 'REACTOR', opacity);
      } else {
        hud.setGuide(180, exitOpen ? 'EXIT' : 'REACTOR', opacity);
      }
      if (guidePingTime <= 0) hud.hideGuide();
    }

    hud.setShield(player.shield);
    hud.setEnergy(player.energy);
  }

  effects.update(dt);
  renderer.render(scene, camera);
}

tick();

if (import.meta.env.DEV) {
  window.__game = {
    THREE, scene, camera, player, enemies, projectiles, renderer,
    get level() { return level; },
    get state() { return state; },
  };
}
