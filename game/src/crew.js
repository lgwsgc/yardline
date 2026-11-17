// crew.js — the five bots: two azure teammates (Vex, Mira) and three crimson
// opponents (Rook, Juno, Kade). Waypoint pathfinding, line-of-sight sensing,
// burst firefights, and the plant/defuse objective game.
//
// Friendly fire is off by construction: only crimson bots ever consider the
// player a target (the player fights for azure), bot bullets never damage a
// bot of the shooter's own team, and the player-damage callback is only ever
// invoked by crimson shooters.
import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Raycaster,
  SphereGeometry,
  Vector3,
} from 'three';
import { ADJ, NODES, PAD, SPAWNS, findPath, nearestNode } from './yard.js';
import { INK } from './look.js';

const BOT_SPEED = 3.6;
const BOT_RADIUS = 0.35;
const EYE = 1.5;
const SENSE_RANGE = 45;
const FOV_COS = 0.5; // 120 degrees total
const RIFLE_DMG = 28;
const HEAD_X = 4;

const ROSTER = [
  { name: 'Vex', team: 'azure' },
  { name: 'Mira', team: 'azure' },
  { name: 'Rook', team: 'crimson' },
  { name: 'Juno', team: 'crimson' },
  { name: 'Kade', team: 'crimson' },
];

export function createCrew(scene, yard, rng) {
  const raycaster = new Raycaster();
  raycaster.far = 90;
  const tmpA = new Vector3();
  const tmpB = new Vector3();
  const tmpC = new Vector3();

  const darkMat = new MeshStandardMaterial({ color: INK.darkPart, roughness: 0.6, metalness: 0.4 });
  const legMat = new MeshStandardMaterial({ color: '#1c1e22', roughness: 0.8 });

  function teamColor(team) {
    return team === 'azure' ? new Color(INK.azure) : new Color(INK.crimson);
  }

  function buildBot(def, index) {
    const g = new Object3D();
    const tc = teamColor(def.team);
    const teamMat = new MeshStandardMaterial({ color: tc, roughness: 0.5, metalness: 0.3 });
    const visorMat = new MeshStandardMaterial({
      color: tc,
      emissive: tc,
      emissiveIntensity: 1.6,
    });
    const add = (mesh, x, y, z) => {
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      g.add(mesh);
      return mesh;
    };
    add(new Mesh(new BoxGeometry(0.16, 0.75, 0.2), legMat), -0.11, 0.375, 0);
    add(new Mesh(new BoxGeometry(0.16, 0.75, 0.2), legMat), 0.11, 0.375, 0);
    const torso = add(new Mesh(new BoxGeometry(0.5, 0.62, 0.3), darkMat), 0, 1.06, 0);
    add(new Mesh(new BoxGeometry(0.4, 0.45, 0.05), darkMat), 0, 1.08, -0.16);
    add(new Mesh(new BoxGeometry(0.2, 0.1, 0.28), darkMat), -0.32, 1.38, 0);
    add(new Mesh(new BoxGeometry(0.2, 0.1, 0.28), darkMat), 0.32, 1.38, 0);
    const head = add(new Mesh(new SphereGeometry(0.16, 12, 10), darkMat), 0, 1.62, 0);
    const helmet = add(
      new Mesh(new SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), teamMat),
      0, 1.64, 0,
    );
    const visor = add(new Mesh(new BoxGeometry(0.3, 0.09, 0.06), visorMat), 0, 1.62, -0.14);
    const rifle = add(new Mesh(new BoxGeometry(0.06, 0.08, 0.7), darkMat), 0.18, 1.25, -0.3);
    rifle.rotation.x = 0.06;
    const ring = new Mesh(
      new CircleGeometry(0.55, 24),
      new MeshBasicMaterial({ color: tc, transparent: true, opacity: 0.45 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);
    torso.userData.botRef = null;
    torso.userData.part = 'torso';
    head.userData.botRef = null;
    head.userData.part = 'head';
    scene.add(g);
    const bot = {
      name: def.name,
      team: def.team,
      group: g,
      head,
      helmet,
      visor,
      torso,
      pos: new Vector3(),
      yaw: 0,
      hp: 100,
      alive: true,
      mode: 'advance',
      path: [],
      pathAt: 0,
      target: null,
      senseAt: index * 0.11,
      reactLeft: 0,
      burstLeft: 0,
      burstGap: 0,
      burstPause: 0,
      strafeDir: 1,
      strafeAt: 0,
      channel: 0,
      channelKind: null,
      holdNode: 19,
      guardNode: 15,
      speed: 0,
    };
    torso.userData.botRef = bot;
    head.userData.botRef = bot;
    return bot;
  }

  const list = ROSTER.map((def, i) => buildBot(def, i));
  let hitMeshes = [];
  function rebuildHits() {
    hitMeshes = [];
    for (const b of list) {
      if (b.alive) hitMeshes.push(b.torso, b.head);
    }
  }
  rebuildHits();

  function blocked(x, z, y) {
    for (const c of yard.colliders) {
      if (y >= c.h - 0.05) continue;
      if (x + BOT_RADIUS > c.x0 && x - BOT_RADIUS < c.x1 && z + BOT_RADIUS > c.z0 && z - BOT_RADIUS < c.z1) {
        return true;
      }
    }
    return false;
  }

  function walkToward(bot, tx, tz, dt) {
    tmpA.set(tx - bot.pos.x, 0, tz - bot.pos.z);
    const dist = tmpA.length();
    if (dist < 0.05) return true;
    tmpA.divideScalar(dist);
    const want = Math.atan2(-tmpA.x, -tmpA.z);
    let dy = want - bot.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    bot.yaw += dy * Math.min(1, dt * 8);
    const stepLen = Math.min(dist, BOT_SPEED * dt);
    const nx = bot.pos.x + tmpA.x * stepLen;
    const nz = bot.pos.z + tmpA.z * stepLen;
    if (!blocked(nx, bot.pos.z, 0)) bot.pos.x = nx;
    if (!blocked(bot.pos.x, nz, 0)) bot.pos.z = nz;
    bot.pos.x = Math.max(-21.4, Math.min(21.4, bot.pos.x));
    bot.pos.z = Math.max(-17.4, Math.min(17.4, bot.pos.z));
    bot.speed = BOT_SPEED;
    return dist < 0.6;
  }

  function faceToward(bot, tx, tz, dt, rate = 10) {
    const want = Math.atan2(-(tx - bot.pos.x), -(tz - bot.pos.z));
    let dy = want - bot.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    bot.yaw += dy * Math.min(1, dt * rate);
  }

  function eyeOf(bot, out) {
    return out.set(bot.pos.x, bot.pos.y + EYE, bot.pos.z);
  }

  // True when nothing solid stands between the bot's eye and the point.
  function seesPoint(bot, point, dist) {
    eyeOf(bot, tmpA);
    tmpB.subVectors(point, tmpA);
    const d = tmpB.length();
    if (d > dist) return false;
    tmpB.divideScalar(d || 1);
    raycaster.set(tmpA, tmpB);
    const hits = raycaster.intersectObjects(yard.shootables, false);
    return hits.length === 0 || hits[0].distance > d - 0.4;
  }

  function inView(bot, tx, tz) {
    tmpA.set(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
    tmpB.set(tx - bot.pos.x, 0, tz - bot.pos.z).normalize();
    return tmpA.dot(tmpB) > FOV_COS;
  }

  function sense(bot, ctx) {
    let best = null;
    let bestD = Infinity;
    for (const other of list) {
      if (!other.alive || other.team === bot.team) continue;
      const d = bot.pos.distanceTo(other.pos);
      if (d > SENSE_RANGE || d >= bestD) continue;
      if (!inView(bot, other.pos.x, other.pos.z)) continue;
      tmpC.set(other.pos.x, other.pos.y + 1.2, other.pos.z);
      if (!seesPoint(bot, tmpC, SENSE_RANGE)) continue;
      best = { kind: 'bot', ref: other };
      bestD = d;
    }
    // The player fights for azure: only crimson bots hunt them.
    if (ctx.playerAlive && bot.team === 'crimson') {
      const d = bot.pos.distanceTo(ctx.playerPos);
      if (d < SENSE_RANGE && d < bestD && inView(bot, ctx.playerPos.x, ctx.playerPos.z)) {
        tmpC.set(ctx.playerPos.x, ctx.playerPos.y + 1.2, ctx.playerPos.z);
        if (seesPoint(bot, tmpC, SENSE_RANGE)) {
          best = { kind: 'player', ref: null };
          bestD = d;
        }
      }
    }
    const sameTarget = best && bot.target
      && bot.target.kind === best.kind
      && bot.target.ref === best.ref;
    if (best && !sameTarget) {
      bot.reactLeft = 0.45 + rng() * 0.3 + Math.min(0.22, bestD * 0.005);
      bot.burstLeft = 0;
      bot.burstPause = 0;
    }
    bot.target = best;
    return bestD;
  }

  function shootOnce(bot, ctx, targetPos, dist) {
    const err = 0.02 * (1 + dist / 30);
    eyeOf(bot, tmpA);
    tmpB.subVectors(targetPos, tmpA).normalize();
    tmpB.x += (rng() * 2 - 1) * err;
    tmpB.y += (rng() * 2 - 1) * err;
    tmpB.z += (rng() * 2 - 1) * err;
    tmpB.normalize();
    raycaster.set(tmpA, tmpB);
    const foes = hitMeshes.filter((m) => m.userData.botRef !== bot);
    const hits = raycaster.intersectObjects(yard.shootables.concat(foes), false);
    const end = hits.length ? hits[0].point : tmpA.clone().addScaledVector(tmpB, 60);
    ctx.onBotShot(tmpA.clone(), end.clone());
    const hit = hits.length ? hits[0] : null;
    const hitDist = hit ? hit.distance : Infinity;
    if (hit) {
      const struck = hit.object.userData.botRef;
      if (struck) {
        if (struck.team === bot.team) return; // safety net: no team damage
        const head = hit.object.userData.part === 'head';
        ctx.hurtBot(struck, RIFLE_DMG * (head ? HEAD_X : 1), head, bot);
        return;
      }
    }
    // Did the ray pass through the player on its way to the wall (or to open
    // air, when nothing was hit at all)?
    if (bot.team === 'crimson' && ctx.playerAlive) {
      tmpC.set(ctx.playerPos.x, ctx.playerPos.y + 1.2, ctx.playerPos.z);
      const toPlayer = tmpC.clone().sub(tmpA);
      const along = toPlayer.dot(tmpB);
      if (along > 0 && along < hitDist) {
        const closest = tmpA.clone().addScaledVector(tmpB, along);
        if (closest.distanceTo(tmpC) < 0.55) {
          const head = closest.y > ctx.playerPos.y + 1.4;
          ctx.hurtPlayer(RIFLE_DMG * (head ? HEAD_X : 1), bot, head);
        }
      }
    }
  }

  function objectiveNode(bot, ctx) {
    if (ctx.planted) {
      // Defenders rush the pad to defuse; attackers guard it from the flanks.
      return bot.team === ctx.defending ? 17 : bot.guardNode;
    }
    if (bot.team === ctx.attacking) return 17;
    return bot.holdNode;
  }

  function stepBot(bot, dt, ctx) {
    if (!bot.alive) return;
    bot.speed = 0;
    bot.senseAt -= dt;
    let targetDist = Infinity;
    if (bot.senseAt <= 0) {
      bot.senseAt = 0.12;
      targetDist = sense(bot, ctx);
      if (bot.target) bot.mode = 'combat';
      else if (bot.mode === 'combat') bot.mode = 'advance';
    } else if (bot.target) {
      const t = bot.target;
      targetDist = t.kind === 'bot'
        ? bot.pos.distanceTo(t.ref.pos)
        : bot.pos.distanceTo(ctx.playerPos);
      if (t.kind === 'bot' && !t.ref.alive) bot.target = null;
      if (t.kind === 'player' && !ctx.playerAlive) bot.target = null;
    }

    // Plant / defuse channelling.
    const atPad = Math.hypot(bot.pos.x - PAD.x, bot.pos.z - PAD.z) < PAD.radius;
    if (!ctx.planted && bot.team === ctx.attacking && atPad && !bot.target) {
      bot.mode = 'plant';
      bot.channel += dt;
      if (bot.channel >= 4) {
        bot.channel = 0;
        ctx.onPlant(bot);
      }
      syncVisual(bot);
      return;
    }
    if (ctx.planted && bot.team === ctx.defending && atPad && !bot.target) {
      bot.mode = 'defuse';
      bot.channel += dt;
      if (bot.channel >= 5) {
        bot.channel = 0;
        ctx.onDefuse(bot);
      }
      syncVisual(bot);
      return;
    }
    bot.channel = 0;

    if (bot.target && bot.mode === 'combat') {
      const t = bot.target;
      const tx = t.kind === 'bot' ? t.ref.pos.x : ctx.playerPos.x;
      const tz = t.kind === 'bot' ? t.ref.pos.z : ctx.playerPos.z;
      faceToward(bot, tx, tz, dt);
      // Strafe sideways while fighting.
      bot.strafeAt -= dt;
      if (bot.strafeAt <= 0) {
        bot.strafeAt = 0.7 + rng() * 0.6;
        bot.strafeDir = rng() < 0.5 ? -1 : 1;
      }
      const sx = Math.cos(bot.yaw) * bot.strafeDir;
      const sz = -Math.sin(bot.yaw) * bot.strafeDir;
      const nx = bot.pos.x + sx * 2.2 * dt;
      const nz = bot.pos.z + sz * 2.2 * dt;
      if (!blocked(nx, bot.pos.z, 0)) bot.pos.x = nx;
      if (!blocked(bot.pos.x, nz, 0)) bot.pos.z = nz;
      bot.speed = 2.2;
      if (bot.reactLeft > 0) {
        bot.reactLeft -= dt;
      } else if (bot.burstLeft > 0) {
        bot.burstGap -= dt;
        if (bot.burstGap <= 0) {
          bot.burstGap = 0.13;
          bot.burstLeft -= 1;
          tmpC.set(tx, (t.kind === 'bot' ? t.ref.pos.y : ctx.playerPos.y) + 1.2, tz);
          shootOnce(bot, ctx, tmpC, targetDist);
        }
      } else {
        bot.burstPause -= dt;
        if (bot.burstPause <= 0) {
          bot.burstLeft = 3;
          bot.burstGap = 0;
          bot.burstPause = 0.5 + rng() * 0.4;
        }
      }
      syncVisual(bot);
      return;
    }

    // Advance toward the objective along the waypoint graph.
    const goal = objectiveNode(bot, ctx);
    if (bot.path.length === 0 || bot.path[bot.path.length - 1] !== goal) {
      bot.path = findPath(nearestNode(bot.pos.x, bot.pos.z), goal);
      bot.pathAt = 0;
    }
    // Defenders stop at their hold node instead of bunching on it.
    const holding = bot.team === ctx.defending && !ctx.planted && bot.pathAt >= bot.path.length;
    if (!holding && bot.pathAt < bot.path.length) {
      const node = NODES[bot.path[bot.pathAt]];
      if (walkToward(bot, node[0], node[1], dt)) bot.pathAt += 1;
    } else if (holding) {
      bot.yaw += Math.sin(ctx.time * 0.5 + bot.pos.x) * dt * 0.25;
    }
    // Separation: keep a little personal space.
    for (const other of list) {
      if (other === bot || !other.alive) continue;
      const dx = bot.pos.x - other.pos.x;
      const dz = bot.pos.z - other.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 0.9) {
        bot.pos.x += (dx / d) * (0.9 - d) * 0.5 * dt * 4;
        bot.pos.z += (dz / d) * (0.9 - d) * 0.5 * dt * 4;
      }
    }
    syncVisual(bot);
  }

  function syncVisual(bot) {
    bot.group.position.copy(bot.pos);
    bot.group.rotation.y = bot.yaw;
    bot.group.rotation.x = bot.speed > 0.5 ? 0.06 : 0;
  }

  return {
    list,
    get hitMeshes() {
      return hitMeshes;
    },
    reset(azureAttacking) {
      const azureSpawns = azureAttacking ? SPAWNS.south : SPAWNS.north;
      const crimsonSpawns = azureAttacking ? SPAWNS.north : SPAWNS.south;
      const azureYaw = azureAttacking ? 0 : Math.PI;
      const crimsonYaw = azureAttacking ? Math.PI : 0;
      const holdNodes = [18, 20, 19];
      let ai = 1;
      let ci = 0;
      let gi = 0;
      for (const bot of list) {
        bot.hp = 100;
        bot.alive = true;
        bot.mode = 'advance';
        bot.path = [];
        bot.pathAt = 0;
        bot.target = null;
        bot.channel = 0;
        bot.guardNode = 15 + (gi % 2);
        gi += 1;
        bot.group.rotation.set(0, 0, 0);
        bot.head.visible = true;
        bot.helmet.visible = true;
        bot.visor.visible = true;
        if (bot.team === 'azure') {
          const s = azureSpawns[ai];
          ai += 1;
          bot.pos.set(s[0], 0, s[1]);
          bot.yaw = azureYaw;
        } else {
          const s = crimsonSpawns[ci];
          bot.holdNode = holdNodes[ci];
          ci += 1;
          bot.pos.set(s[0], 0, s[1]);
          bot.yaw = crimsonYaw;
        }
        syncVisual(bot);
      }
      rebuildHits();
    },
    damage(bot, amount, part) {
      if (!bot.alive) return false;
      bot.hp -= amount;
      if (bot.hp > 0) return false;
      bot.hp = 0;
      bot.alive = false;
      bot.mode = 'dead';
      bot.target = null;
      bot.group.rotation.x = -Math.PI / 2;
      bot.group.position.y = 0.25;
      rebuildHits();
      return true;
    },
    step(dt, ctx) {
      for (const bot of list) stepBot(bot, dt, ctx);
    },
    aliveCount(team) {
      return list.filter((b) => b.alive && b.team === team).length;
    },
    living(team) {
      return list.filter((b) => b.alive && b.team === team);
    },
    hideHead(bot) {
      bot.head.visible = false;
      bot.helmet.visible = false;
      bot.visor.visible = false;
    },
    showHead(bot) {
      bot.head.visible = true;
      bot.helmet.visible = true;
      bot.visor.visible = true;
    },
  };
}
