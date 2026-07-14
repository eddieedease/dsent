import * as THREE from 'three';
import { rockTexture, panelTexture, panelGlowTexture, floorTexture, gridGlowTexture } from './textures.js';

export const CELL = 12; // world units per maze cell

// Deterministic RNG so each level layout is stable.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Level {
  constructor(config) {
    this.config = config;
    const [w, h, d] = config.size;
    this.w = w; this.h = h; this.d = d;
    this.rand = mulberry32(config.seed);
    this.grid = new Uint8Array(w * h * d).fill(1); // 1 = solid rock
    this.group = new THREE.Group();

    this.carveMaze();
    this.carveRooms();
    this.pickSpecialCells();
    this.pickZones();
    this.buildMeshes();
  }

  idx(x, y, z) { return x + this.w * (y + this.h * z); }

  inBounds(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d;
  }

  isSolid(x, y, z) {
    if (!this.inBounds(x, y, z)) return true;
    return this.grid[this.idx(x, y, z)] === 1;
  }

  carve(x, y, z) {
    if (this.inBounds(x, y, z)) this.grid[this.idx(x, y, z)] = 0;
  }

  cellCenter(x, y, z) {
    return new THREE.Vector3((x + 0.5) * CELL, (y + 0.5) * CELL, (z + 0.5) * CELL);
  }

  worldToCell(pos) {
    return [Math.floor(pos.x / CELL), Math.floor(pos.y / CELL), Math.floor(pos.z / CELL)];
  }

  // --- generation -------------------------------------------------------

  carveMaze() {
    // Recursive backtracker on the odd-coordinate lattice. Horizontal moves
    // are favored so the mine feels like tunnels with occasional shafts.
    const rand = this.rand;
    const stack = [[1, 1, 1]];
    this.carve(1, 1, 1);
    const dirs = [
      [2, 0, 0], [-2, 0, 0], [0, 0, 2], [0, 0, -2],
      [2, 0, 0], [-2, 0, 0], [0, 0, 2], [0, 0, -2], // duplicated: horizontal bias
      [0, 2, 0], [0, -2, 0],
    ];
    while (stack.length) {
      const [x, y, z] = stack[stack.length - 1];
      const options = [];
      for (const [dx, dy, dz] of dirs) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (this.inBounds(nx, ny, nz) && this.isSolid(nx, ny, nz)) {
          options.push([dx, dy, dz]);
        }
      }
      if (!options.length) { stack.pop(); continue; }
      const [dx, dy, dz] = options[Math.floor(rand() * options.length)];
      this.carve(x + dx / 2, y + dy / 2, z + dz / 2);
      this.carve(x + dx, y + dy, z + dz);
      stack.push([x + dx, y + dy, z + dz]);
    }
    // Punch a few extra connections so the maze has loops (less dead-endy).
    const extra = Math.floor(this.w * this.d * 0.05);
    for (let i = 0; i < extra; i++) {
      const x = 1 + Math.floor(rand() * (this.w - 2));
      const y = 1 + Math.floor(rand() * (this.h - 2));
      const z = 1 + Math.floor(rand() * (this.d - 2));
      if (!this.isSolid(x - 1, y, z) && !this.isSolid(x + 1, y, z)) this.carve(x, y, z);
      if (!this.isSolid(x, y, z - 1) && !this.isSolid(x, y, z + 1)) this.carve(x, y, z);
    }
  }

  carveRoom(cx, cy, cz, rx, ry, rz) {
    for (let x = cx - rx; x <= cx + rx; x++)
      for (let y = cy - ry; y <= cy + ry; y++)
        for (let z = cz - rz; z <= cz + rz; z++)
          if (x > 0 && y > 0 && z > 0 && x < this.w - 1 && y < this.h - 1 && z < this.d - 1)
            this.carve(x, y, z);
  }

  carveRooms() {
    // Mix of room shapes so a few chambers read as distinct landmarks
    // instead of every open space being the same little box — helps players
    // build a mental map ("the tall shaft", "the big cross room").
    const rand = this.rand;
    for (let i = 0; i < this.config.rooms; i++) {
      const x = 2 + Math.floor(rand() * (this.w - 4));
      const y = 1 + Math.floor(rand() * (this.h - 2));
      const z = 2 + Math.floor(rand() * (this.d - 4));
      const shape = rand();
      if (shape < 0.15) {
        // tall vertical shaft
        this.carveRoom(x, y, z, 1, 1 + Math.floor(rand() * (this.h - 2)), 1);
      } else if (shape < 0.3) {
        // wide cross-shaped hub
        const r = 2 + Math.floor(rand() * 2);
        this.carveRoom(x, y, z, r, 1, 1);
        this.carveRoom(x, y, z, 1, 1, r);
      } else {
        this.carveRoom(x, y, z, 1 + Math.floor(rand() * 2), 1, 1 + Math.floor(rand() * 2));
      }
    }
  }

  // BFS distances (in cells) from a start cell through empty space.
  bfs(sx, sy, sz) {
    const dist = new Int32Array(this.grid.length).fill(-1);
    const q = [[sx, sy, sz]];
    dist[this.idx(sx, sy, sz)] = 0;
    const N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (let head = 0; head < q.length; head++) {
      const [x, y, z] = q[head];
      const d0 = dist[this.idx(x, y, z)];
      for (const [dx, dy, dz] of N) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (!this.isSolid(nx, ny, nz) && dist[this.idx(nx, ny, nz)] === -1) {
          dist[this.idx(nx, ny, nz)] = d0 + 1;
          q.push([nx, ny, nz]);
        }
      }
    }
    return { dist, order: q };
  }

  pickSpecialCells() {
    const rand = this.rand;
    this.startCell = [1, 1, 1];
    this.playerStart = this.cellCenter(1, 1, 1);

    // Reactor: the empty cell farthest from the start, widened into a room.
    let { dist, order } = this.bfs(1, 1, 1);
    const far = order[order.length - 1];
    this.carveRoom(far[0], far[1], far[2], 1, 1, 1);
    this.reactorCell = far;
    this.reactorPos = this.cellCenter(far[0], far[1], far[2]);

    // Exit: farthest empty cell from the reactor (recompute after carving).
    const reactorBfs = this.bfs(far[0], far[1], far[2]);
    ({ dist, order } = reactorBfs);
    let exit = order[order.length - 1];
    // Avoid placing the exit on top of the player start.
    if (exit[0] === 1 && exit[1] === 1 && exit[2] === 1) exit = order[order.length - 2];
    this.exitCell = exit;
    this.exitPos = this.cellCenter(exit[0], exit[1], exit[2]);

    // Corridor-following distance fields for the objective guide ping: how
    // many cells away (through the maze, not as the crow flies) each cell is
    // from the reactor / exit. Reused every time the player pings.
    this.distFromReactor = reactorBfs.dist;
    this.distFromExit = this.bfs(exit[0], exit[1], exit[2]).dist;

    // Candidate cells for enemies/powerups: away from the start.
    const startBfs = this.bfs(1, 1, 1);
    const candidates = startBfs.order.filter(([x, y, z]) => {
      const d = startBfs.dist[this.idx(x, y, z)];
      return d > 5 && !(x === exit[0] && y === exit[1] && z === exit[2]);
    });
    const pick = () => candidates[Math.floor(rand() * candidates.length)];

    this.enemySpawns = [];
    for (const [type, count] of Object.entries(this.config.enemies)) {
      for (let i = 0; i < count; i++) {
        const [x, y, z] = pick();
        this.enemySpawns.push({ type, pos: this.cellCenter(x, y, z) });
      }
    }

    this.powerupSpawns = [];
    for (let i = 0; i < this.config.powerups; i++) {
      const [x, y, z] = pick();
      this.powerupSpawns.push(this.cellCenter(x, y, z));
    }
  }

  // A handful of large Voronoi-ish colour zones scattered across the floor
  // plan, each a subtle hue-shifted tint of the level's neon accent. Purely
  // visual: it gives distinct "districts" (rock walls carry a color cast) so
  // players can orient by "past the purple stretch" instead of every tunnel
  // looking identical.
  pickZones() {
    const rand = this.rand;
    const count = 5;
    const base = new THREE.Color(this.config.neon);
    const hsl = {};
    base.getHSL(hsl);
    this.zones = [];
    for (let i = 0; i < count; i++) {
      const hue = (hsl.h + i / count + rand() * 0.1) % 1;
      const col = new THREE.Color().setHSL(hue, Math.min(1, hsl.s * 0.85 + 0.15), 0.55);
      const mult = new THREE.Color(1, 1, 1).lerp(col, 0.4);
      this.zones.push({ x: rand() * this.w, z: rand() * this.d, mult });
    }
  }

  zoneColorAt(x, z) {
    let best = this.zones[0];
    let bestD = Infinity;
    for (const zn of this.zones) {
      const d = (zn.x - x) ** 2 + (zn.z - z) ** 2;
      if (d < bestD) { bestD = d; best = zn; }
    }
    return best.mult;
  }

  // --- geometry ---------------------------------------------------------

  buildMeshes() {
    const rand = this.rand;
    // face definitions: normal n, tangents u,v with u x v = n
    const FACES = [
      { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
      { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
      { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] }, // ceiling (faces down)
      { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] }, // floor (faces up)
      { n: [0, 0, -1], u: [1, 0, 0], v: [0, -1, 0] },
      { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    ];

    const buckets = { rock: [], floor: [], panel: [] };
    this.lightSpots = [];

    for (let x = 0; x < this.w; x++) {
      for (let y = 0; y < this.h; y++) {
        for (let z = 0; z < this.d; z++) {
          if (this.isSolid(x, y, z)) continue;
          const center = this.cellCenter(x, y, z);
          for (const f of FACES) {
            const [nx, ny, nz] = f.n;
            // face exists where the neighbor opposite the normal is solid
            if (!this.isSolid(x - nx, y - ny, z - nz)) continue;
            let bucket = 'rock';
            if (ny === 1) bucket = 'floor';
            else if (ny === 0 && rand() < 0.1) bucket = 'panel';
            const facePos = center.clone().addScaledVector(new THREE.Vector3(-nx, -ny, -nz), CELL / 2);
            if (bucket === 'panel') this.lightSpots.push(facePos.clone().addScaledVector(new THREE.Vector3(nx, ny, nz), 2));
            buckets[bucket].push({ pos: facePos, f, cellX: x, cellZ: z });
          }
        }
      }
    }

    const tint = this.config.tint;
    const neon = this.config.neon;
    const mats = {
      rock: new THREE.MeshLambertMaterial({ map: rockTexture(tint), vertexColors: true }),
      floor: new THREE.MeshLambertMaterial({
        map: floorTexture(tint),
        emissive: 0xffffff,
        emissiveMap: gridGlowTexture(neon),
        emissiveIntensity: 0.85,
        vertexColors: true,
      }),
      panel: new THREE.MeshLambertMaterial({
        map: panelTexture(neon),
        emissive: 0xffffff,
        emissiveMap: panelGlowTexture(neon),
        emissiveIntensity: 1.0,
      }),
    };

    for (const [name, faces] of Object.entries(buckets)) {
      if (!faces.length) continue;
      const positions = new Float32Array(faces.length * 4 * 3);
      const normals = new Float32Array(faces.length * 4 * 3);
      const uvs = new Float32Array(faces.length * 4 * 2);
      const zoned = name === 'rock' || name === 'floor';
      const colors = zoned ? new Float32Array(faces.length * 4 * 3) : null;
      const indices = [];
      const h = CELL / 2;
      faces.forEach(({ pos, f, cellX, cellZ }, i) => {
        const u = new THREE.Vector3(...f.u).multiplyScalar(h);
        const v = new THREE.Vector3(...f.v).multiplyScalar(h);
        const corners = [
          pos.clone().sub(u).sub(v),
          pos.clone().add(u).sub(v),
          pos.clone().add(u).add(v),
          pos.clone().sub(u).add(v),
        ];
        const uvCoords = [[0, 0], [1, 0], [1, 1], [0, 1]];
        const zoneColor = zoned ? this.zoneColorAt(cellX, cellZ) : null;
        corners.forEach((c, j) => {
          const vi = (i * 4 + j) * 3;
          positions[vi] = c.x; positions[vi + 1] = c.y; positions[vi + 2] = c.z;
          normals[vi] = f.n[0]; normals[vi + 1] = f.n[1]; normals[vi + 2] = f.n[2];
          const ti = (i * 4 + j) * 2;
          uvs[ti] = uvCoords[j][0]; uvs[ti + 1] = uvCoords[j][1];
          if (zoneColor) { colors[vi] = zoneColor.r; colors[vi + 1] = zoneColor.g; colors[vi + 2] = zoneColor.b; }
        });
        const b = i * 4;
        indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.setIndex(indices);
      this.group.add(new THREE.Mesh(geo, mats[name]));
    }

    // A handful of real lights at panel spots for atmosphere.
    const shuffled = this.lightSpots.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (const spot of shuffled.slice(0, 10)) {
      const light = new THREE.PointLight(new THREE.Color(this.config.neon), 14, CELL * 3.5, 1.6);
      light.position.copy(spot);
      this.group.add(light);
    }
  }

  // Direction (unit vector, world space) from `fromPos` toward the next
  // corridor cell on the shortest path to the reactor or exit, following the
  // precomputed BFS distance field so it hugs corridors instead of pointing
  // straight through walls. Returns null if already effectively there.
  guideDirection(fromPos, target) {
    const distField = target === 'exit' ? this.distFromExit : this.distFromReactor;
    let [x, y, z] = this.worldToCell(fromPos);
    if (this.isSolid(x, y, z)) {
      // Player is straddling a wall face; nudge to the nearest open neighbor.
      const N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      for (const [dx, dy, dz] of N) {
        if (!this.isSolid(x + dx, y + dy, z + dz)) { x += dx; y += dy; z += dz; break; }
      }
    }
    if (!this.inBounds(x, y, z) || this.isSolid(x, y, z)) return null;
    const myDist = distField[this.idx(x, y, z)];
    if (myDist <= 0) return null; // already at the objective
    const N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    let best = null, bestDist = myDist;
    for (const [dx, dy, dz] of N) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (this.isSolid(nx, ny, nz)) continue;
      const d = distField[this.idx(nx, ny, nz)];
      if (d >= 0 && d < bestDist) { bestDist = d; best = [nx, ny, nz]; }
    }
    if (!best) return null;
    return this.cellCenter(best[0], best[1], best[2]).sub(fromPos).normalize();
  }

  // --- physics helpers ---------------------------------------------------

  // Push a sphere out of any solid cells. Mutates pos; returns true on contact.
  // If `outNormal` (a Vector3) is given, accumulates the (unnormalized) sum of
  // per-cell push directions into it — callers use this to bounce velocity
  // off the surface instead of just killing it.
  collideSphere(pos, radius, outNormal) {
    let hit = false;
    if (outNormal) outNormal.set(0, 0, 0);
    const minX = Math.floor((pos.x - radius) / CELL);
    const maxX = Math.floor((pos.x + radius) / CELL);
    const minY = Math.floor((pos.y - radius) / CELL);
    const maxY = Math.floor((pos.y + radius) / CELL);
    const minZ = Math.floor((pos.z - radius) / CELL);
    const maxZ = Math.floor((pos.z + radius) / CELL);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (!this.isSolid(x, y, z)) continue;
          const bx0 = x * CELL, by0 = y * CELL, bz0 = z * CELL;
          const cx = Math.max(bx0, Math.min(pos.x, bx0 + CELL));
          const cy = Math.max(by0, Math.min(pos.y, by0 + CELL));
          const cz = Math.max(bz0, Math.min(pos.z, bz0 + CELL));
          const dx = pos.x - cx, dy = pos.y - cy, dz = pos.z - cz;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq >= radius * radius) continue;
          hit = true;
          const dist = Math.sqrt(distSq);
          if (dist > 1e-6) {
            const push = (radius - dist) / dist;
            pos.x += dx * push; pos.y += dy * push; pos.z += dz * push;
            if (outNormal) { outNormal.x += dx / dist; outNormal.y += dy / dist; outNormal.z += dz / dist; }
          } else {
            pos.y = by0 + CELL + radius; // degenerate: pop upward
            if (outNormal) outNormal.y += 1;
          }
        }
      }
    }
    return hit;
  }

  // True if a point is inside a solid cell (cheap projectile test).
  isSolidAt(pos) {
    const [x, y, z] = this.worldToCell(pos);
    return this.isSolid(x, y, z);
  }

  // Voxel DDA: can `a` see `b` without a wall in between?
  hasLineOfSight(a, b) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len < 1e-6) return true;
    dir.divideScalar(len);
    let [x, y, z] = this.worldToCell(a);
    const [tx, ty, tz] = this.worldToCell(b);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const next = (p, cell, step) => {
      const edge = (cell + (step > 0 ? 1 : 0)) * CELL;
      return (edge - p);
    };
    let tMaxX = dir.x !== 0 ? next(a.x, x, stepX) / dir.x : Infinity;
    let tMaxY = dir.y !== 0 ? next(a.y, y, stepY) / dir.y : Infinity;
    let tMaxZ = dir.z !== 0 ? next(a.z, z, stepZ) / dir.z : Infinity;
    const tDeltaX = dir.x !== 0 ? CELL / Math.abs(dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? CELL / Math.abs(dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? CELL / Math.abs(dir.z) : Infinity;
    let guard = 0;
    while (!(x === tx && y === ty && z === tz) && guard++ < 200) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; if (tMaxX > len) break; tMaxX += tDeltaX; }
      else if (tMaxY < tMaxZ) { y += stepY; if (tMaxY > len) break; tMaxY += tDeltaY; }
      else { z += stepZ; if (tMaxZ > len) break; tMaxZ += tDeltaZ; }
      if (this.isSolid(x, y, z)) return false;
    }
    return true;
  }
}
