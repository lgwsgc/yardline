// body.js — the player's physical body: WASD movement, jump, crouch, axis by
// axis AABB collision, health and recoil. Eye height sits at 1.55 m standing,
// 1.05 m crouched.
import { Vector3 } from 'three';
import { BOUNDS } from './yard.js';

const RADIUS = 0.35;
const WALK = 5.2;
const CROUCH_SPEED = 2.6;
const AIM_SPEED = 3.4;
const JUMP = 5.6;
const GRAVITY = 14;
const EYE_UP = 1.55;
const EYE_DOWN = 1.05;

export function createBody(colliders) {
  const pos = new Vector3(0, 0, 15);
  const vel = new Vector3();
  const state = {
    pos,
    yaw: 0,
    pitch: 0,
    onGround: true,
    crouched: false,
    health: 100,
    alive: true,
    eye: EYE_UP,
    recoilPitch: 0,
    recoilYaw: 0,
  };

  function blocked(x, z) {
    if (x < BOUNDS.minX + RADIUS || x > BOUNDS.maxX - RADIUS) return true;
    if (z < BOUNDS.minZ + RADIUS || z > BOUNDS.maxZ - RADIUS) return true;
    for (const c of colliders) {
      if (pos.y >= c.h - 0.05) continue;
      if (x + RADIUS > c.x0 && x - RADIUS < c.x1 && z + RADIUS > c.z0 && z - RADIUS < c.z1) {
        return true;
      }
    }
    return false;
  }

  function moveAxis(dx, dz) {
    const nx = pos.x + dx;
    if (!blocked(nx, pos.z)) pos.x = nx;
    const nz = pos.z + dz;
    if (!blocked(pos.x, nz)) pos.z = nz;
  }

  return {
    state,
    reset(x, z, yaw) {
      pos.set(x, 0, z);
      vel.set(0, 0, 0);
      state.yaw = yaw;
      state.pitch = 0;
      state.health = 100;
      state.alive = true;
      state.eye = EYE_UP;
      state.crouched = false;
      state.recoilPitch = 0;
      state.recoilYaw = 0;
    },
    look(dx, dy) {
      state.yaw -= dx * 0.0022;
      state.pitch -= dy * 0.0022;
      const lim = Math.PI / 2 - 0.02;
      state.pitch = Math.max(-lim, Math.min(lim, state.pitch));
    },
    kick(dp, dy) {
      state.recoilPitch += dp;
      state.recoilYaw += dy;
    },
    groundSpeed() {
      return Math.hypot(vel.x, vel.z);
    },
    // A copy of the current velocity, for the camera strafe roll.
    velocity() {
      return vel.clone();
    },
    damage(amount) {
      if (!state.alive) return false;
      state.health -= amount;
      if (state.health <= 0) {
        state.health = 0;
        state.alive = false;
        return true;
      }
      return false;
    },
    step(dt, keys, aiming) {
      // Recoil recovers toward zero.
      state.recoilPitch *= Math.max(0, 1 - dt * 7);
      state.recoilYaw *= Math.max(0, 1 - dt * 7);
      if (Math.abs(state.recoilPitch) < 0.0004) state.recoilPitch = 0;
      if (Math.abs(state.recoilYaw) < 0.0004) state.recoilYaw = 0;

      const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      const str = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      state.crouched = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
      const speed = state.crouched ? CROUCH_SPEED : aiming ? AIM_SPEED : WALK;
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      let mx = (-sin * fwd + cos * str) * speed;
      let mz = (-cos * fwd - sin * str) * speed;
      const len = Math.hypot(mx, mz);
      if (len > speed) {
        mx = (mx / len) * speed;
        mz = (mz / len) * speed;
      }
      // Smooth acceleration toward the wish velocity.
      const k = state.onGround ? 12 : 4;
      vel.x += (mx - vel.x) * Math.min(1, k * dt);
      vel.z += (mz - vel.z) * Math.min(1, k * dt);
      moveAxis(vel.x * dt, vel.z * dt);

      if (keys.has('Space') && state.onGround) {
        vel.y = JUMP;
        state.onGround = false;
      }
      vel.y -= GRAVITY * dt;
      pos.y += vel.y * dt;
      if (pos.y <= 0) {
        pos.y = 0;
        vel.y = 0;
        state.onGround = true;
      }
      const targetEye = state.crouched ? EYE_DOWN : EYE_UP;
      state.eye += (targetEye - state.eye) * Math.min(1, dt * 10);
    },
  };
}
