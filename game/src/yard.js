// yard.js — the container yard: geometry, colliders, shootables and the bot
// waypoint graph. Map is 44 x 36 m, dusk light, three lanes between the south
// (attacker) and north (defender) spawns. The relay pad sits at (0, -10).
import {
  BackSide,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
} from 'three';
import { INK } from './look.js';

export const BOUNDS = { minX: -21.4, maxX: 21.4, minZ: -17.4, maxZ: 17.4 };
export const PAD = { x: 0, z: -10, radius: 2.5 };
export const SPAWNS = {
  south: [
    [-6, 15],
    [-2, 15],
    [2, 15],
    [6, 15],
  ],
  north: [
    [-6, -15],
    [-2, -15],
    [2, -15],
    [6, -15],
  ],
};

// 21 waypoints: south staging, west lane, mid (around the central stack),
// east lane, pad approaches, north staging.
export const NODES = [
  [-8, 12], [0, 12], [8, 12], // 0-2 south
  [-14, 8], [-14, 0], [-14, -8], // 3-5 west
  [-4, 6], [4, 6], [-4, 0], [4, 0], [-4, -6], [4, -6], // 6-11 mid
  [14, 8], [14, 0], [14, -8], // 12-14 east
  [-3, -10], [3, -10], [0, -10], // 15-17 pad
  [-8, -12], [0, -12], [8, -12], // 18-20 north
];
const LINKS = [
  [0, 1], [1, 2], [0, 3], [1, 6], [1, 7], [2, 12],
  [3, 4], [4, 5], [5, 18], [5, 15],
  [6, 7], [6, 8], [7, 9], [8, 10], [9, 11], [10, 11], [10, 15], [11, 16],
  [12, 13], [13, 14], [14, 20], [14, 16],
  [15, 17], [16, 17], [17, 19], [15, 18], [16, 20], [18, 19], [19, 20],
];
export const ADJ = NODES.map(() => []);
for (const [a, b] of LINKS) {
  ADJ[a].push(b);
  ADJ[b].push(a);
}

export function nearestNode(x, z) {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < NODES.length; i += 1) {
    const d = (NODES[i][0] - x) ** 2 + (NODES[i][1] - z) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

// Breadth-first shortest path over the waypoint graph, as node indices.
export function findPath(from, to) {
  if (from === to) return [from];
  const prev = new Array(NODES.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length) {
    const n = queue.shift();
    for (const m of ADJ[n]) {
      if (prev[m] === -1) {
        prev[m] = n;
        if (m === to) {
          const path = [to];
          let cur = to;
          while (cur !== from) {
            cur = prev[cur];
            path.push(cur);
          }
          return path.reverse();
        }
        queue.push(m);
      }
    }
  }
  return [from];
}

export function buildYard(scene, look) {
  const colliders = [];
  const shootables = [];
  const addCollider = (x0, z0, x1, z1, h) => colliders.push({ x0, z0, x1, z1, h });

  scene.fog = new Fog(new Color(INK.fog), 30, 95);

  // Sky dome.
  const dome = new Mesh(
    new SphereGeometry(120, 24, 16),
    new MeshBasicMaterial({ map: look.sky, side: BackSide, fog: false }),
  );
  scene.add(dome);

  // Lights: warm dusk key from the south-west, cool fill, hemisphere base.
  scene.add(new HemisphereLight(new Color('#a8b6c8'), new Color('#3a2f28'), 1.2));
  const key = new DirectionalLight(new Color('#ffb37a'), 2.8);
  key.position.set(-30, 26, 22);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -32;
  key.shadow.camera.right = 32;
  key.shadow.camera.top = 32;
  key.shadow.camera.bottom = -32;
  key.shadow.camera.far = 100;
  scene.add(key);
  const fill = new DirectionalLight(new Color('#7d90b8'), 0.75);
  fill.position.set(28, 18, -24);
  scene.add(fill);

  const concreteMat = new MeshStandardMaterial({ map: look.concrete, roughness: 0.95 });
  const wallMat = new MeshStandardMaterial({ color: INK.wall, roughness: 0.9 });
  const woodMat = new MeshStandardMaterial({ map: look.wood, roughness: 0.9 });
  const hazardMat = new MeshStandardMaterial({ map: look.hazard, roughness: 0.8 });
  const darkMat = new MeshStandardMaterial({ color: INK.darkPart, roughness: 0.6, metalness: 0.4 });

  function box(w, h, d, mat, x, y, z, ry = 0) {
    const m = new Mesh(new BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    shootables.push(m);
    return m;
  }

  // Ground.
  const ground = new Mesh(new PlaneGeometry(44, 36), concreteMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  shootables.push(ground);

  // Perimeter walls.
  box(45, 3, 0.5, wallMat, 0, 1.5, -18.25);
  box(45, 3, 0.5, wallMat, 0, 1.5, 18.25);
  box(0.5, 3, 37, wallMat, -22.25, 1.5, 0);
  box(0.5, 3, 37, wallMat, 22.25, 1.5, 0);

  // Painted lane lines and the floor decal.
  const lineMat = new MeshStandardMaterial({
    color: INK.hazardYellow,
    emissive: INK.hazardYellow,
    emissiveIntensity: 0.35,
    roughness: 0.8,
  });
  for (const x of [-7.5, 7.5]) {
    const line = new Mesh(new PlaneGeometry(0.25, 18), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.02, 3);
    scene.add(line);
  }
  const decal = new Mesh(
    new PlaneGeometry(8, 2),
    new MeshStandardMaterial({
      map: look.decal,
      transparent: true,
      emissiveMap: look.decal,
      emissive: new Color('#ffffff'),
      emissiveIntensity: 0.25,
      roughness: 0.9,
    }),
  );
  decal.rotation.x = -Math.PI / 2;
  decal.position.set(0, 0.025, 12);
  scene.add(decal);

  // Containers: [x, z, alongX?, texture, stacked?]. 6 long x 2.4 wide x 2.6 high.
  const steelMats = {
    rust: new MeshStandardMaterial({ map: look.rust, roughness: 0.7, metalness: 0.25 }),
    teal: new MeshStandardMaterial({ map: look.teal, roughness: 0.7, metalness: 0.25 }),
    olive: new MeshStandardMaterial({ map: look.olive, roughness: 0.7, metalness: 0.25 }),
    slate: new MeshStandardMaterial({ map: look.slate, roughness: 0.7, metalness: 0.25 }),
  };
  const boxes = [
    [-19, 10, false, 'rust', false],
    [-19, 2, false, 'teal', false],
    [-19, -6, false, 'slate', false],
    [-10.5, 4, false, 'rust', false],
    [-10.5, -4, false, 'teal', false],
    [-1.3, 0, false, 'rust', true],
    [1.3, 0, false, 'slate', false],
    [17.5, 6, false, 'olive', false],
    [17.5, -6, false, 'rust', false],
  ];
  for (const [x, z, alongX, tex, stacked] of boxes) {
    const w = alongX ? 6 : 2.4;
    const d = alongX ? 2.4 : 6;
    box(w, 2.6, d, steelMats[tex], x, 1.3, z);
    if (stacked) box(w, 2.6, d, steelMats.teal, x, 3.9, z);
    addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, stacked ? 5.2 : 2.6);
  }

  // Crates (1 m cubes).
  const crates = [
    [-6, 6], [6, 6], [-5.8, -2], [5.8, -2], [0, 8],
    [-11, 0], [11, 0], [-8, -4], [8, -4],
  ];
  for (const [x, z] of crates) {
    box(1, 1, 1, woodMat, x, 0.5, z);
    addCollider(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 1);
  }

  // East warehouse: roof slab, east wall, corner columns; open to the west.
  box(8.4, 0.3, 24.6, darkMat, 16, 4.15, 0);
  box(0.4, 4.4, 24.6, wallMat, 20.1, 2.2, 0);
  addCollider(19.9, -12.3, 20.3, 12.3, 4.4);
  for (const [x, z] of [[12.5, 11], [12.5, -11], [19.5, 11], [19.5, -11]]) {
    box(0.3, 4, 0.3, darkMat, x, 2, z);
    addCollider(x - 0.15, z - 0.15, x + 0.15, z + 0.15, 4);
  }

  // Relay pad: hazard frame, pedestal, pulsing amber beacon.
  const frame = new Mesh(new BoxGeometry(3.4, 0.08, 3.4), hazardMat);
  frame.position.set(PAD.x, 0.04, PAD.z);
  frame.receiveShadow = true;
  scene.add(frame);
  const pedestal = new Mesh(new CylinderGeometry(0.5, 0.62, 0.9, 14), darkMat);
  pedestal.position.set(PAD.x, 0.45, PAD.z);
  pedestal.castShadow = true;
  scene.add(pedestal);
  shootables.push(pedestal);
  addCollider(PAD.x - 0.55, PAD.z - 0.55, PAD.x + 0.55, PAD.z + 0.55, 0.9);
  const beaconMat = new MeshBasicMaterial({ color: INK.amber });
  const beacon = new Mesh(new SphereGeometry(0.24, 12, 10), beaconMat);
  beacon.position.set(PAD.x, 1.45, PAD.z);
  scene.add(beacon);
  const beaconLight = new PointLight(new Color(INK.amber), 16, 20, 2);
  beaconLight.position.set(PAD.x, 1.8, PAD.z);
  scene.add(beaconLight);

  // Light poles at the four corners.
  const lampMat = new MeshStandardMaterial({
    color: INK.lamp,
    emissive: INK.lamp,
    emissiveIntensity: 2.5,
  });
  for (const [x, z] of [[-20, -15], [20, -15], [-20, 15], [20, 15]]) {
    box(0.25, 6, 0.25, darkMat, x, 3, z);
    addCollider(x - 0.13, z - 0.13, x + 0.13, z + 0.13, 6);
    const head = new Mesh(new BoxGeometry(0.7, 0.16, 0.34), lampMat);
    head.position.set(x + (x < 0 ? 0.3 : -0.3), 6.05, z);
    scene.add(head);
  }

  // Barrels in three clusters.
  const barrelMat = new MeshStandardMaterial({ color: '#5a4636', roughness: 0.75, metalness: 0.3 });
  const barrelSpots = [
    [-19, -14], [-18.1, -14.6], [-19.2, -13.1],
    [19, 14], [18.2, 14.5], [19.1, 13.1],
    [-19, 2], [-18.2, 2.6], [-19.3, 1.2],
  ];
  for (const [x, z] of barrelSpots) {
    const b = new Mesh(new CylinderGeometry(0.42, 0.42, 1.0, 14), barrelMat);
    b.position.set(x, 0.5, z);
    b.castShadow = true;
    scene.add(b);
    shootables.push(b);
    addCollider(x - 0.42, z - 0.42, x + 0.42, z + 0.42, 1);
  }

  // Team-coloured ring markers under the spawn rows.
  const ringGeo = new CircleGeometry(1.1, 24);
  for (const [x, z] of SPAWNS.south) {
    const r = new Mesh(ringGeo, new MeshBasicMaterial({ color: INK.azure, transparent: true, opacity: 0.3 }));
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.03, z);
    scene.add(r);
  }
  for (const [x, z] of SPAWNS.north) {
    const r = new Mesh(ringGeo, new MeshBasicMaterial({ color: INK.crimson, transparent: true, opacity: 0.3 }));
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.03, z);
    scene.add(r);
  }

  return { colliders, shootables, beacon, beaconLight, beaconMat };
}
