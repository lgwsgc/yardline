// arms.js — weapons: definitions, first-person viewmodels, spread and bloom,
// tracers, muzzle flash and frag grenades. Four guns plus a grenade; the P9
// sidearm is free, the rest are bought in the buy phase.
import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  Vector3,
} from 'three';
import { INK } from './look.js';

export const GUNS = {
  P9: { name: 'P9', price: 0, dmg: 22, headX: 2, gap: 0.18, auto: false, mag: 12, reserve: 48, reload: 1.4, spread: 0.008, range: 60 },
  VK7: { name: 'VK-7', price: 1200, dmg: 28, headX: 4, gap: 0.11, auto: true, mag: 30, reserve: 90, reload: 2.2, spread: 0.011, range: 80 },
  H9: { name: 'Hornet-9', price: 800, dmg: 16, headX: 2, gap: 0.07, auto: true, mag: 32, reserve: 96, reload: 1.9, spread: 0.016, range: 50 },
  DMR: { name: 'Longshot', price: 2000, dmg: 65, headX: 2, gap: 0.9, auto: false, mag: 5, reserve: 20, reload: 2.8, spread: 0.002, range: 120 },
};
export const GRENADE = { name: 'Frag', price: 300, fuse: 1.2, radius: 5.5, maxDmg: 110, minDmg: 15 };
export const ORDER = ['P9', 'VK7', 'H9', 'DMR'];

const HIP = { x: 0.26, y: -0.24, z: -0.45 };
const AIM = { x: 0, y: -0.172, z: -0.38 };

export function createArms(camera, scene, look, sfx) {
  const metal = new MeshStandardMaterial({ color: INK.gunmetal, metalness: 0.65, roughness: 0.42 });
  const poly = new MeshStandardMaterial({ color: INK.polymer, roughness: 0.7 });
  const dark = new MeshStandardMaterial({ color: INK.darkPart, roughness: 0.6, metalness: 0.4 });
  const sightGlow = new MeshStandardMaterial({
    color: '#ff7a1a',
    emissive: '#ff7a1a',
    emissiveIntensity: 0.7,
  });

  function part(geo, mat, x, y, z, rx = 0) {
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    return m;
  }

  // Each viewmodel is assembled from small boxes and tubes; the muzzle anchor
  // sits at the barrel tip so tracers start at the real muzzle.
  function buildModel(kind) {
    const g = new Object3D();
    const muzzle = new Object3D();
    if (kind === 'P9') {
      g.add(part(new BoxGeometry(0.05, 0.07, 0.22), metal, 0, 0, -0.08));
      g.add(part(new CylinderGeometry(0.013, 0.013, 0.12, 10), dark, 0, 0.012, -0.24, Math.PI / 2));
      g.add(part(new BoxGeometry(0.045, 0.1, 0.05), poly, 0, -0.075, 0.02));
      g.add(part(new BoxGeometry(0.04, 0.07, 0.045), poly, 0, -0.06, -0.02));
      g.add(part(new BoxGeometry(0.008, 0.03, 0.008), sightGlow, 0, 0.05, -0.18));
      muzzle.position.set(0, 0.012, -0.31);
    } else if (kind === 'VK7') {
      g.add(part(new BoxGeometry(0.06, 0.08, 0.4), metal, 0, 0, -0.1));
      g.add(part(new CylinderGeometry(0.014, 0.014, 0.3, 10), dark, 0, 0.01, -0.42, Math.PI / 2));
      g.add(part(new CylinderGeometry(0.02, 0.02, 0.06, 10), dark, 0, 0.01, -0.58, Math.PI / 2));
      g.add(part(new BoxGeometry(0.05, 0.09, 0.16), poly, 0, -0.01, 0.16));
      g.add(part(new BoxGeometry(0.045, 0.09, 0.05), poly, 0, -0.08, 0.05));
      g.add(part(new BoxGeometry(0.05, 0.15, 0.07), poly, 0, -0.1, -0.08));
      g.add(part(new BoxGeometry(0.008, 0.035, 0.008), sightGlow, 0, 0.055, -0.3));
      g.add(part(new BoxGeometry(0.05, 0.02, 0.02), dark, 0, 0.05, 0.05));
      muzzle.position.set(0, 0.01, -0.62);
    } else if (kind === 'H9') {
      g.add(part(new BoxGeometry(0.055, 0.07, 0.3), metal, 0, 0, -0.06));
      g.add(part(new CylinderGeometry(0.012, 0.012, 0.18, 10), dark, 0, 0.01, -0.28, Math.PI / 2));
      g.add(part(new BoxGeometry(0.05, 0.08, 0.12), poly, 0, -0.01, 0.13));
      g.add(part(new BoxGeometry(0.045, 0.09, 0.05), poly, 0, -0.075, 0.03));
      g.add(part(new BoxGeometry(0.04, 0.17, 0.06), poly, 0, -0.11, -0.05));
      g.add(part(new BoxGeometry(0.008, 0.03, 0.008), sightGlow, 0, 0.05, -0.2));
      muzzle.position.set(0, 0.01, -0.38);
    } else {
      g.add(part(new BoxGeometry(0.06, 0.08, 0.5), metal, 0, 0, -0.12));
      g.add(part(new CylinderGeometry(0.013, 0.013, 0.4, 10), dark, 0, 0.01, -0.52, Math.PI / 2));
      g.add(part(new BoxGeometry(0.05, 0.09, 0.18), poly, 0, -0.01, 0.18));
      g.add(part(new BoxGeometry(0.045, 0.09, 0.05), poly, 0, -0.08, 0.06));
      g.add(part(new BoxGeometry(0.05, 0.13, 0.07), poly, 0, -0.1, -0.1));
      g.add(part(new CylinderGeometry(0.026, 0.026, 0.18, 12), dark, 0, 0.085, -0.1, Math.PI / 2));
      const lens = new Mesh(new CircleGeometry(0.02, 12), new MeshBasicMaterial({ color: '#9fd8ff' }));
      lens.position.set(0, 0.085, -0.195);
      lens.rotation.y = Math.PI;
      g.add(lens);
      g.add(part(new BoxGeometry(0.008, 0.03, 0.008), sightGlow, 0, 0.05, -0.35));
      muzzle.position.set(0, 0.01, -0.73);
    }
    g.add(muzzle);
    g.userData.muzzle = muzzle;
    g.visible = false;
    camera.add(g);
    return g;
  }

  const models = {};
  for (const id of ORDER) models[id] = buildModel(id);

  // Muzzle flash: two crossed additive star planes on the camera.
  const flashMat = new MeshBasicMaterial({
    map: look.flash,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  const flashA = new Mesh(new PlaneGeometry(0.17, 0.17), flashMat);
  const flashB = new Mesh(new PlaneGeometry(0.17, 0.17), flashMat);
  flashB.rotation.z = Math.PI / 2;
  flashA.visible = false;
  flashB.visible = false;
  camera.add(flashA);
  camera.add(flashB);
  const flashLight = new PointLight(new Color('#ffbf66'), 18, 9, 2);
  flashLight.visible = false;
  camera.add(flashLight);

  // Tracer pool: thin additive boxes, stretched between two points.
  const tracerGeo = new BoxGeometry(0.02, 0.02, 1);
  const tracers = [];
  for (let i = 0; i < 24; i += 1) {
    const m = new Mesh(
      tracerGeo,
      new MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    );
    m.visible = false;
    scene.add(m);
    tracers.push({ mesh: m, ttl: 0 });
  }
  let tracerIdx = 0;

  // Grenade blast visuals: an expanding additive sphere plus a light.
  const blastMat = new MeshBasicMaterial({
    color: '#ff9a3c',
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const blast = new Mesh(new SphereGeometry(1, 16, 12), blastMat);
  blast.visible = false;
  scene.add(blast);
  const blastLight = new PointLight(new Color('#ff9933'), 0, 16, 2);
  blastLight.visible = false;
  scene.add(blastLight);
  let blastTtl = 0;

  const grenades = [];
  const grenadeMat = new MeshStandardMaterial({ color: '#23262b', roughness: 0.5, metalness: 0.5 });
  const grenadeGeo = new SphereGeometry(0.07, 10, 8);

  const ammo = {};
  for (const id of ORDER) ammo[id] = { mag: GUNS[id].mag, reserve: GUNS[id].reserve };
  const state = {
    owned: new Set(['P9']),
    current: 'P9',
    reloading: 0,
    gapLeft: 0,
    bloom: 0,
    aimBlend: 0,
    bobPhase: 0,
    swayTime: 0,
    shotCount: 0,
    flashTtl: 0,
    hidden: false,
  };
  models.P9.visible = true;

  const tmpV = new Vector3();
  const tmpMid = new Vector3();

  return {
    state,
    ammo,
    def(id) {
      return GUNS[id];
    },
    owns(id) {
      return state.owned.has(id);
    },
    give(id) {
      state.owned.add(id);
    },
    refill() {
      for (const id of ORDER) {
        ammo[id].mag = GUNS[id].mag;
        ammo[id].reserve = GUNS[id].reserve;
      }
      state.reloading = 0;
    },
    switchTo(id) {
      if (!state.owned.has(id) || id === state.current) return false;
      models[state.current].visible = false;
      state.current = id;
      state.reloading = 0;
      state.gapLeft = 0.15;
      state.bloom = Math.min(state.bloom, 0.01);
      models[id].visible = !state.hidden;
      return true;
    },
    setHidden(h) {
      state.hidden = h;
      models[state.current].visible = !h;
    },
    spreadFor(speed, crouched, aiming, airborne) {
      const def = GUNS[state.current];
      let s = def.spread + state.bloom + speed * 0.0016;
      if (crouched) s *= 0.7;
      if (aiming) s *= 0.5;
      if (airborne) s *= 2.2;
      return s;
    },
    canFire() {
      return state.reloading <= 0 && state.gapLeft <= 0 && ammo[state.current].mag > 0;
    },
    fire() {
      if (!this.canFire()) return false;
      const def = GUNS[state.current];
      ammo[state.current].mag -= 1;
      state.gapLeft = def.gap;
      state.bloom = Math.min(0.03, state.bloom + (def.auto ? 0.0035 : 0.0012));
      state.shotCount += 1;
      state.flashTtl = 0.045;
      sfx.shot(state.current === 'DMR' ? 'DMR' : state.current);
      return true;
    },
    reload() {
      const a = ammo[state.current];
      if (state.reloading > 0 || a.mag >= GUNS[state.current].mag || a.reserve <= 0) return false;
      state.reloading = GUNS[state.current].reload;
      sfx.reload();
      return true;
    },
    muzzleWorld(out) {
      return models[state.current].userData.muzzle.getWorldPosition(out);
    },
    spawnTracer(from, to) {
      const t = tracers[tracerIdx];
      tracerIdx = (tracerIdx + 1) % tracers.length;
      tmpMid.addVectors(from, to).multiplyScalar(0.5);
      t.mesh.position.copy(tmpMid);
      t.mesh.lookAt(to);
      t.mesh.scale.set(1, 1, Math.max(0.1, from.distanceTo(to)));
      t.mesh.material.opacity = 0.9;
      t.mesh.visible = true;
      t.ttl = 0.09;
    },
    throwGrenade(origin, dir) {
      const mesh = new Mesh(grenadeGeo, grenadeMat);
      mesh.position.copy(origin);
      scene.add(mesh);
      grenades.push({
        mesh,
        vel: new Vector3(dir.x * 11, dir.y * 11 + 2.6, dir.z * 11),
        fuse: GRENADE.fuse,
      });
    },
    grenadeCount() {
      return grenades.length;
    },
    updateGrenades(dt, colliders, onBoom) {
      for (let i = grenades.length - 1; i >= 0; i -= 1) {
        const g = grenades[i];
        g.vel.y -= 14 * dt;
        g.mesh.position.addScaledVector(g.vel, dt);
        const p = g.mesh.position;
        if (p.y < 0.07) {
          p.y = 0.07;
          g.vel.y *= -0.45;
          g.vel.x *= 0.7;
          g.vel.z *= 0.7;
        }
        if (p.x < -21.3 || p.x > 21.3) g.vel.x *= -0.5;
        if (p.z < -17.3 || p.z > 17.3) g.vel.z *= -0.5;
        p.x = Math.max(-21.3, Math.min(21.3, p.x));
        p.z = Math.max(-17.3, Math.min(17.3, p.z));
        g.fuse -= dt;
        if (g.fuse <= 0) {
          scene.remove(g.mesh);
          grenades.splice(i, 1);
          blast.position.copy(p);
          blast.visible = true;
          blastTtl = 0.28;
          blastLight.position.copy(p).add(new Vector3(0, 1, 0));
          blastLight.visible = true;
          blastLight.intensity = 26;
          sfx.boom();
          onBoom(p);
        }
      }
      if (blastTtl > 0) {
        blastTtl -= dt;
        const k = 1 - Math.max(0, blastTtl) / 0.28;
        const r = 0.6 + k * 4.4;
        blast.scale.set(r, r, r);
        blastMat.opacity = 0.85 * (1 - k);
        blastLight.intensity = 26 * (1 - k);
        if (blastTtl <= 0) {
          blast.visible = false;
          blastLight.visible = false;
        }
      }
    },
    step(dt, speed, aiming) {
      state.gapLeft = Math.max(0, state.gapLeft - dt);
      state.bloom = Math.max(0, state.bloom - dt * 0.03);
      if (state.reloading > 0) {
        state.reloading -= dt;
        if (state.reloading <= 0) {
          const def = GUNS[state.current];
          const a = ammo[state.current];
          const need = def.mag - a.mag;
          const take = Math.min(need, a.reserve);
          a.mag += take;
          a.reserve -= take;
        }
      }
      state.aimBlend += ((aiming ? 1 : 0) - state.aimBlend) * Math.min(1, dt * 10);
      const speedFactor = Math.min(1, speed / 5.2);
      state.bobPhase += speed * dt * 1.6;
      state.swayTime += dt;
      const calm = 1 - state.aimBlend * 0.7;
      const bobX = Math.cos(state.bobPhase) * 0.008 * speedFactor * calm;
      const bobY = Math.sin(state.bobPhase * 2) * 0.006 * speedFactor * calm;
      const swayX = Math.sin(state.swayTime * 1.7) * 0.0015 * calm;
      const swayY = Math.cos(state.swayTime * 2.3) * 0.0015 * calm;
      const m = models[state.current];
      const b = state.aimBlend;
      m.position.set(
        HIP.x + (AIM.x - HIP.x) * b + bobX + swayX,
        HIP.y + (AIM.y - HIP.y) * b + bobY + swayY,
        HIP.z + (AIM.z - HIP.z) * b,
      );
      m.rotation.y = -0.06 * (1 - b);
      m.visible = !state.hidden;

      // Muzzle flash follows the muzzle's camera-local position.
      if (state.flashTtl > 0) {
        state.flashTtl -= dt;
        this.muzzleWorld(tmpV);
        camera.worldToLocal(tmpV);
        flashA.position.copy(tmpV);
        flashB.position.copy(tmpV);
        flashA.rotation.z = state.shotCount * 2.39996;
        flashB.rotation.z = state.shotCount * 2.39996 + Math.PI / 2;
        flashA.visible = true;
        flashB.visible = true;
        flashLight.position.copy(tmpV);
        flashLight.visible = true;
      } else {
        flashA.visible = false;
        flashB.visible = false;
        flashLight.visible = false;
      }
      for (const t of tracers) {
        if (t.ttl <= 0) continue;
        t.ttl -= dt;
        if (t.ttl <= 0) {
          t.mesh.visible = false;
        } else {
          t.mesh.material.opacity = 0.9 * (t.ttl / 0.09);
        }
      }
    },
  };
}
