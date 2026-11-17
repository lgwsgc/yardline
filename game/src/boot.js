// boot.js — entry point: renderer, module wiring, the fixed-step loop,
// player shooting, grenades, camera (including death spectating) and the
// deterministic ?shot= staging scenes used for the screenshots.
import {
  ACESFilmicToneMapping,
  Color,
  PCFShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { buildLook, makeRng } from './look.js';
import { PAD, SPAWNS, buildYard } from './yard.js';
import { createSfx } from './sfx.js';
import { createKeys } from './keys.js';
import { createBody } from './body.js';
import { GRENADE, GUNS, createArms } from './arms.js';
import { createCrew } from './crew.js';
import { DEFUSE_SECS, PLANT_SECS, createMatch } from './match.js';
import { createFace } from './face.js';

const STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const rng = makeRng(Number.isFinite(seedParam) ? seedParam : (Date.now() % 2147483647));

const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color('#131a29');
const camera = new PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 220);
scene.add(camera);

const look = buildLook();
const yard = buildYard(scene, look);
const sfx = createSfx();
const match = createMatch();
const face = createFace();
const crew = createCrew(scene, yard, rng);
const body = createBody(yard.colliders);
const arms = createArms(camera, scene, look, sfx);
const keys = createKeys(renderer.domElement, onLockChange);
const raycaster = new Raycaster();
raycaster.far = 120;

const dirV = new Vector3();
const fromV = new Vector3();
const hitV = new Vector3();
const markerHoldMs = shot ? 4000 : 90;

let started = false;
let frozen = false;
let elapsed = 0;
let camBobPhase = 0;
let camRoll = 0;
let fovNow = 74;
let spectating = false;
let spectateTarget = null;
let channelKind = null;
let channelT = 0;
let accumulator = 0;
let lastTime = performance.now();

const game = match.state;
const phys = body.state;

face.setScore(0, 0, 1, 'azure');
face.setCash(800);
face.setHealth(100);
face.setPips(3, 3);
face.setAmmo(12, 48, 'P9', 0);
face.showOverlay('start');

function aliveCounts() {
  return {
    azure: (phys.alive ? 1 : 0) + crew.aliveCount('azure'),
    crimson: crew.aliveCount('crimson'),
  };
}

function resetRound() {
  const azureAttacking = match.attacking() === 'azure';
  const spawns = azureAttacking ? SPAWNS.south : SPAWNS.north;
  const yaw = azureAttacking ? 0 : Math.PI;
  body.reset(spawns[0][0], spawns[0][1], yaw);
  crew.reset(azureAttacking);
  arms.refill();
  stopSpectating();
  channelKind = null;
  channelT = 0;
  face.hideChannel();
  face.setScore(game.scores.azure, game.scores.crimson, game.round, match.attacking());
  face.setHealth(100);
  face.setPips(3, 3);
  face.setCash(game.money);
  face.setAmmo(arms.ammo[arms.state.current].mag, arms.ammo[arms.state.current].reserve, GUNS[arms.state.current].name, game.grenades);
}

function startSpectating() {
  spectating = true;
  arms.setHidden(true);
  keys.takeClicks();
  const mates = crew.living('azure');
  spectateTarget = mates.length ? mates[0] : null;
  if (spectateTarget) {
    crew.hideHead(spectateTarget);
    face.setSpectating(spectateTarget.name);
  }
}

function cycleSpectate() {
  const mates = crew.living('azure');
  if (!mates.length) return;
  const at = spectateTarget ? mates.indexOf(spectateTarget) : -1;
  const next = mates[(at + 1) % mates.length];
  if (spectateTarget) crew.showHead(spectateTarget);
  spectateTarget = next;
  crew.hideHead(next);
  face.setSpectating(next.name);
}

function stopSpectating() {
  if (spectateTarget) crew.showHead(spectateTarget);
  spectateTarget = null;
  if (spectating) {
    spectating = false;
    arms.setHidden(false);
    face.hideSpectating();
  }
}

function damagePlayer(amount, sourceBot, headshot) {
  // Second line of defence: an azure bot can never damage the player.
  if (sourceBot && sourceBot.team === 'azure') return;
  if (!phys.alive || game.phase !== 'live') return;
  sfx.hurt();
  face.flashHurt();
  if (body.damage(amount)) {
    startSpectating();
    if (keys.locked) keys.exitLock();
    face.showOverlay('dead');
  }
  face.setHealth(phys.health);
}

function hurtBot(bot, amount, headshot, sourceBot) {
  if (crew.damage(bot, amount, headshot ? 'head' : 'torso')) {
    match.addKill(sourceBot.name, bot.name, 'VK-7', headshot);
  }
}

function onPlant() {
  match.plant();
  yard.beaconLight.intensity = 28;
  sfx.beep();
  face.banner('RELAY PLANTED', 'Defenders: defuse it before the charge completes');
}

function onDefuse() {
  match.defuse();
  yard.beaconLight.intensity = 16;
  face.banner('RELAY DEFUSED', 'The charge is disarmed');
}

function onBotShot(from, to) {
  arms.spawnTracer(from, to);
  // Bot gunfire fades with distance instead of blasting at full volume.
  const d = from.distanceTo(phys.pos);
  if (d < 30) sfx.shot('VK7', Math.max(0.15, 1 - d / 30));
}

const crewCtx = {
  get playerPos() {
    return phys.pos;
  },
  get playerAlive() {
    return phys.alive;
  },
  get planted() {
    return game.planted;
  },
  get attacking() {
    return match.attacking();
  },
  get defending() {
    return match.defending();
  },
  get time() {
    return elapsed;
  },
  hurtPlayer: (amount, bot, head) => damagePlayer(amount, bot, head),
  hurtBot,
  onPlant,
  onDefuse,
  onBotShot,
};

function shoot(spread) {
  if (!arms.fire()) {
    if (arms.ammo[arms.state.current].mag === 0) sfx.dry();
    return;
  }
  camera.getWorldDirection(dirV);
  dirV.x += (rng() * 2 - 1) * spread;
  dirV.y += (rng() * 2 - 1) * spread;
  dirV.z += (rng() * 2 - 1) * spread;
  dirV.normalize();
  arms.muzzleWorld(fromV);
  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, dirV);
  const targets = yard.shootables.concat(crew.hitMeshes);
  const hit = raycaster.intersectObjects(targets, false)[0];
  const end = hit ? hit.point : camera.position.clone().addScaledVector(dirV, 80);
  arms.spawnTracer(fromV, end);
  const def = GUNS[arms.state.current];
  if (hit) {
    const bot = hit.object.userData.botRef;
    if (bot && bot.alive) {
      if (bot.team !== 'azure') {
        const head = hit.object.userData.part === 'head';
        const dist = hit.distance;
        const falloff = dist > 30 ? Math.max(0.6, 1 - (dist - 30) * 0.008) : 1;
        const dmg = def.dmg * (head ? def.headX : 1) * falloff;
        const died = crew.damage(bot, dmg, head ? 'head' : 'torso');
        face.hitMarker(died, markerHoldMs);
        if (died) {
          sfx.kill();
          match.addKill('You', bot.name, def.name, head);
        } else {
          sfx.hit();
        }
      }
      // A teammate in the line of fire: the tracer stops, nothing else happens.
    }
  }
  body.kick(0.009 + rng() * 0.004, (rng() * 2 - 1) * 0.004);
  face.setAmmo(arms.ammo[arms.state.current].mag, arms.ammo[arms.state.current].reserve, def.name, game.grenades);
}

function throwGrenade() {
  if (game.grenades <= 0 || !phys.alive || game.phase !== 'live') return;
  game.grenades -= 1;
  camera.getWorldDirection(dirV);
  fromV.copy(camera.position).addScaledVector(dirV, 0.5);
  arms.throwGrenade(fromV, dirV);
  face.setAmmo(arms.ammo[arms.state.current].mag, arms.ammo[arms.state.current].reserve, GUNS[arms.state.current].name, game.grenades);
}

function explodeAt(p) {
  for (const bot of crew.list) {
    if (!bot.alive || bot.team === 'azure') continue;
    const d = Math.hypot(bot.pos.x - p.x, bot.pos.z - p.z);
    if (d > GRENADE.radius) continue;
    const dmg = GRENADE.maxDmg - ((GRENADE.maxDmg - GRENADE.minDmg) * d) / GRENADE.radius;
    if (crew.damage(bot, dmg, 'torso')) match.addKill('You', bot.name, 'Frag', false);
  }
  const pd = Math.hypot(phys.pos.x - p.x, phys.pos.z - p.z);
  if (phys.alive && pd < GRENADE.radius) {
    const dmg = (GRENADE.maxDmg - ((GRENADE.maxDmg - GRENADE.minDmg) * pd) / GRENADE.radius) * 0.6;
    damagePlayer(dmg, null, false);
  }
}

function deploy() {
  match.deploy();
  face.hideBuy();
  face.hideHint();
  if (!shot) keys.requestLock();
}

face.onPlay(() => {
  sfx.unlock();
  if (shot) return;
  if (game.phase === 'matchEnd') {
    window.location.reload();
    return;
  }
  if (!started) {
    started = true;
    match.startBuy();
    return;
  }
  face.hideOverlay();
  keys.requestLock();
});
face.onRestart(() => {
  window.location.reload();
});
face.onDeploy(() => deploy());
function buyItem(id) {
  if (game.phase !== 'buy') return;
  if (id === 'FRAG') {
    match.buyGrenade(GRENADE.price);
  } else if (match.state.owned.has(id)) {
    if (arms.switchTo(id)) sfx.swap();
  } else if (match.buyGun(id, GUNS[id].price)) {
    arms.give(id);
    arms.switchTo(id);
    sfx.swap();
  }
  face.updateBuy(game.money, match.state.owned, arms.state.current);
  face.setAmmo(arms.ammo[arms.state.current].mag, arms.ammo[arms.state.current].reserve, GUNS[arms.state.current].name, game.grenades);
}

face.onBuy((id) => buyItem(id));

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    face.hideOverlay();
    face.hideHint();
  } else if (started && game.phase === 'live') {
    face.showOverlay(phys.alive ? 'paused' : 'dead');
  }
}

renderer.domElement.addEventListener('click', () => {
  if (!shot && started && game.phase === 'live' && !keys.locked) keys.requestLock();
});

function handleEvents() {
  for (const ev of match.drainEvents()) {
    if (ev.type === 'buyPhase') {
      resetRound();
      face.hideOverlay();
      // A stale buy event can drain after a deploy: only open the menu when
      // the game is genuinely still in the buy phase.
      if (game.phase !== 'buy') continue;
      keys.exitLock();
      face.showBuy(game.money, match.state.owned, arms.state.current);
      face.setBuyTimer(game.timer);
    } else if (ev.type === 'deploy') {
      face.banner(`ROUND ${ev.round}`, match.attacking() === 'azure' ? 'AZURE attacks — plant the relay' : 'CRIMSON attacks — hold the pad');
    } else if (ev.type === 'kill') {
      face.feed(ev.killer, ev.weapon, ev.victim, ev.headshot);
      face.setCash(game.money);
      face.setPips(aliveCounts().azure, aliveCounts().crimson);
    } else if (ev.type === 'roundEnd') {
      const won = ev.winner === 'azure';
      const why = { eliminated: 'Enemy team eliminated', charged: 'Relay charge complete', defused: 'Relay defused', time: 'Time expired — defenders hold' }[ev.reason] || '';
      face.banner(won ? 'ROUND WON' : 'ROUND LOST', why);
      sfx.sting(won);
      face.setScore(game.scores.azure, game.scores.crimson, game.round, match.attacking());
      face.setCash(game.money);
    } else if (ev.type === 'matchEnd') {
      stopSpectating();
      keys.exitLock();
      face.showOverlay('matchEnd', { win: ev.winner === 'azure', a: game.scores.azure, c: game.scores.crimson });
    } else if (ev.type === 'planted') {
      yard.beaconLight.intensity = 28;
    } else if (ev.type === 'bought') {
      sfx.beep();
    }
  }
}

function updateChannel(dt) {
  const nearPad = Math.hypot(phys.pos.x - PAD.x, phys.pos.z - PAD.z) < PAD.radius + 0.8;
  const holding = keys.down('KeyE');
  let kind = null;
  if (game.phase === 'live' && phys.alive && nearPad && holding) {
    if (match.attacking() === 'azure' && !game.planted) kind = 'plant';
    else if (match.defending() === 'azure' && game.planted) kind = 'defuse';
  }
  if (kind) {
    if (kind !== channelKind) {
      channelKind = kind;
      channelT = 0;
    }
    const dur = kind === 'plant' ? PLANT_SECS : DEFUSE_SECS;
    channelT += dt / dur;
    face.setChannel(kind === 'plant' ? 'PLANTING RELAY' : 'DEFUSING RELAY', Math.min(1, channelT));
    if (channelT >= 1) {
      channelKind = null;
      channelT = 0;
      face.hideChannel();
      if (kind === 'plant') onPlant();
      else onDefuse();
    }
  } else if (channelKind) {
    channelKind = null;
    channelT = 0;
    face.hideChannel();
  }
}

function step(dt) {
  elapsed += dt;
  match.tick(dt, aliveCounts());
  if (game.phase === 'live') {
    body.step(dt, keys.keys, keys.aiming);
    crew.step(dt, crewCtx);
    arms.updateGrenades(dt, yard.colliders, explodeAt);
    updateChannel(dt);
    // Spectate target died: switch to another living teammate, or hold the view.
    if (spectating && spectateTarget && !spectateTarget.alive) {
      const mates = crew.living('azure');
      if (mates.length) {
        crew.showHead(spectateTarget);
        spectateTarget = mates[0];
        crew.hideHead(spectateTarget);
        face.setSpectating(spectateTarget.name);
      } else {
        spectateTarget = null;
        face.hideSpectating();
      }
    }
  }
  arms.step(dt, phys.alive ? body.groundSpeed() : 0, keys.aiming && phys.alive);
  // Beacon pulse: calm shimmer, or urgent bright while the charge runs.
  yard.beaconLight.intensity = game.planted
    ? 28
    : 16 + Math.sin(elapsed * 4) * 3;
  handleEvents();
}

function syncCamera() {
  if (spectating && spectateTarget) {
    camera.position.set(spectateTarget.pos.x, spectateTarget.pos.y + 1.5, spectateTarget.pos.z);
    camera.rotation.set(0, spectateTarget.yaw, 0, 'YXZ');
    fovNow += (74 - fovNow) * 0.2;
  } else {
    const speed = body.groundSpeed();
    const speedFactor = Math.min(1, speed / 5.2);
    camBobPhase += speed * (1 / 60) * 1.6;
    const bobY = Math.sin(camBobPhase * 2) * 0.012 * speedFactor * (phys.onGround ? 1 : 0);
    camera.position.set(phys.pos.x, phys.pos.y + phys.eye + bobY, phys.pos.z);
    // Strafe roll from lateral velocity (right vector is (cos yaw, -sin yaw)).
    const vel = body.velocity();
    const lat = vel.x * Math.cos(phys.yaw) - vel.z * Math.sin(phys.yaw);
    const rollTarget = Math.max(-0.05, Math.min(0.05, -lat * 0.012));
    camRoll += (rollTarget - camRoll) * 0.2;
    camera.rotation.set(phys.pitch + phys.recoilPitch, phys.yaw + phys.recoilYaw, camRoll, 'YXZ');
    const targetFov = keys.aiming && phys.alive ? 55 : 74;
    fovNow += (targetFov - fovNow) * 0.2;
  }
  if (Math.abs(camera.fov - fovNow) > 0.05) {
    camera.fov = fovNow;
    camera.updateProjectionMatrix();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = keys.takeLook();
    if (!spectating) body.look(look.x, look.y);
    const clicks = keys.takeClicks();
    const presses = keys.takePresses();
    if (spectating) {
      if ((clicks.length > 0 || presses.includes('Space')) && keys.locked) cycleSpectate();
    } else if (game.phase === 'live' && phys.alive && keys.locked) {
      const def = GUNS[arms.state.current];
      const spread = arms.spreadFor(body.groundSpeed(), phys.crouched, keys.aiming, !phys.onGround);
      if (def.auto) {
        if (keys.firing && arms.canFire()) shoot(spread);
      } else if (clicks.includes(0) && arms.canFire()) {
        shoot(spread);
      }
      if (presses.includes('KeyR')) {
        if (arms.reload()) face.setAmmo(arms.ammo[arms.state.current].mag, arms.ammo[arms.state.current].reserve, def.name, game.grenades);
      }
      if (presses.includes('KeyG')) throwGrenade();
    }
    // Weapon switching (live) and buy keys (buy phase) share the digit keys.
    const digitIdx = [0, 1, 2, 3, 4].find((i) => presses.includes(`Digit${i + 1}`));
    if (digitIdx !== undefined) {
      if (game.phase === 'buy') {
        buyItem(['P9', 'VK7', 'H9', 'DMR', 'FRAG'][digitIdx]);
      } else if (game.phase === 'live' && digitIdx < 4) {
        const id = ['P9', 'VK7', 'H9', 'DMR'][digitIdx];
        if (arms.switchTo(id)) {
          sfx.swap();
          face.setAmmo(arms.ammo[id].mag, arms.ammo[id].reserve, GUNS[id].name, game.grenades);
        }
      }
    }
    if (game.phase === 'buy' && presses.includes('Enter')) deploy();
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      step(STEP);
      accumulator -= STEP;
      steps += 1;
    }
    if (accumulator > STEP * 5) accumulator = 0;
    syncCamera();
    // Per-frame HUD.
    face.setClock(game.timer, game.planted, game.chargeLeft);
    if (game.phase === 'buy') face.setBuyTimer(game.timer);
    face.setCrosshair(3 + arms.spreadFor(body.groundSpeed(), phys.crouched, keys.aiming, !phys.onGround) * 900);
    if (!shot && started && game.phase === 'live' && phys.alive && !keys.locked) {
      face.hint('Click to aim');
    } else {
      face.hideHint();
    }
  }
  renderer.render(scene, camera);
}

function settle(n) {
  // Shot mode steps without rendering, so refresh the matrices the bots'
  // line-of-sight raycasts rely on (the renderer does this every frame in
  // normal play).
  scene.updateMatrixWorld(true);
  for (let i = 0; i < n; i += 1) step(STEP);
}

function aimAt(point) {
  const dx = point.x - phys.pos.x;
  const dy = point.y - (phys.pos.y + phys.eye);
  const dz = point.z - phys.pos.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  phys.yaw = Math.atan2(-dx, -dz);
  phys.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  syncCamera();
}

function freezeAfterTwoFrames() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

function placeBot(name, x, z, yaw) {
  const bot = crew.list.find((b) => b.name === name);
  bot.pos.set(x, 0, z);
  bot.yaw = yaw;
  bot.path = [];
  // Sync the group directly: dead bots are never synced by stepBot, so a
  // staged fallen body would otherwise stay at its spawn.
  bot.group.position.set(x, bot.alive ? 0 : 0.25, z);
  bot.group.rotation.set(bot.alive ? 0 : -Math.PI / 2, yaw, 0);
  return bot;
}

function runShot(name) {
  face.hideOverlay();
  started = true;
  if (name === 'start') {
    match.resetMatch();
    game.timer = 90;
    resetRound();
    body.reset(0, 14, 0);
    settle(20);
    aimAt(new Vector3(0, 1.4, -10));
    face.showOverlay('start');
  } else if (name === 'play') {
    match.resetMatch();
    game.round = 2;
    game.scores.azure = 1;
    game.scores.crimson = 1;
    game.money = 900;
    resetRound();
    game.phase = 'live';
    game.timer = 60;
    match.state.owned.add('VK7');
    arms.give('VK7');
    arms.switchTo('VK7');
    body.reset(-4, 8, 0);
    placeBot('Rook', -4.5, -4.5, Math.PI);
    placeBot('Kade', 7, -4, Math.PI);
    placeBot('Vex', -7, 5, 0);
    placeBot('Mira', 5, 5, 0);
    const juno = placeBot('Juno', -7, -1, Math.PI);
    crew.damage(juno, 500, 'torso');
    // Burn the weapon-switch gap (0.15 s) so the staged shot can actually
    // fire, then re-place the bots — they drifted toward their objectives
    // during the settle.
    settle(12);
    placeBot('Rook', -4.5, -4.5, Math.PI);
    placeBot('Kade', 7, -4, Math.PI);
    placeBot('Vex', -7, 5, 0);
    placeBot('Mira', 5, 5, 0);
    placeBot('Juno', -7, -1, Math.PI);
    settle(1);
    aimAt(new Vector3(-4.5, 1.2, -4.5));
    shoot(0);
    settle(1);
    face.setScore(1, 1, 2, 'crimson');
    face.setPips(3, 2);
  } else if (name === 'buy') {
    match.resetMatch();
    game.round = 2;
    game.scores.azure = 1;
    game.money = 2400;
    resetRound();
    game.phase = 'buy';
    game.timer = 11;
    body.reset(-2, 15, 0);
    settle(10);
    // Reset the timer after settling so the clock and the panel agree on 11s.
    game.timer = 11;
    // Look slightly down toward mid-yard: more containers, less flat sky.
    aimAt(new Vector3(0, 1, 0));
    face.showBuy(2400, match.state.owned, arms.state.current);
    face.setBuyTimer(11);
  } else {
    match.resetMatch();
    game.round = 4;
    game.scores.azure = 3;
    game.scores.crimson = 1;
    game.phase = 'matchEnd';
    game.timer = 0;
    game.winner = 'azure';
    resetRound();
    body.reset(0, -6, 0);
    settle(20);
    aimAt(new Vector3(0, 1.4, -10));
    face.showOverlay('matchEnd', { win: true, a: 3, c: 1 });
  }
  face.setAmmo(arms.ammo[arms.state.current].mag, arms.ammo[arms.state.current].reserve, GUNS[arms.state.current].name, game.grenades);
  face.setClock(game.timer, game.planted, game.chargeLeft);
  freezeAfterTwoFrames();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();

// Debug hook for automated tests (read-only): round state, player vitals and
// position, bot counts. Harmless in normal play.
window.__yardline = {
  get phase() {
    return game.phase;
  },
  get round() {
    return game.round;
  },
  get scores() {
    return { ...game.scores };
  },
  get money() {
    return game.money;
  },
  get health() {
    return phys.health;
  },
  get alive() {
    return phys.alive;
  },
  get pos() {
    return { x: phys.pos.x, y: phys.pos.y, z: phys.pos.z };
  },
  get yaw() {
    return phys.yaw;
  },
  get ammo() {
    return { ...arms.ammo[arms.state.current] };
  },
  get gun() {
    return arms.state.current;
  },
  get grenades() {
    return game.grenades;
  },
  get botsAlive() {
    return { azure: crew.aliveCount('azure'), crimson: crew.aliveCount('crimson') };
  },
  get spectating() {
    return spectating;
  },
  get feedCount() {
    return document.querySelectorAll('#feed .feed-line').length;
  },
};

if (shot) runShot(shot);
else requestAnimationFrame(frame);
