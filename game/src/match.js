// match.js — the match state machine: buy phase, live rounds, plant/defuse,
// economy and round/match resolution. First to 3 round wins, at most 5 rounds;
// sides alternate every round (azure attacks rounds 1, 3, 5).
export const BUY_SECS = 12;
export const ROUND_SECS = 90;
export const PLANT_SECS = 4;
export const DEFUSE_SECS = 5;
export const CHARGE_SECS = 20;
export const BANNER_SECS = 3;
export const WIN_SCORE = 3;
export const MAX_ROUNDS = 5;

export function createMatch() {
  const events = [];
  const state = {
    phase: 'menu',
    round: 1,
    scores: { azure: 0, crimson: 0 },
    money: 800,
    timer: 0,
    planted: false,
    chargeLeft: 0,
    owned: new Set(['P9']),
    grenades: 0,
    winner: null,
  };

  function attacking() {
    return state.round % 2 === 1 ? 'azure' : 'crimson';
  }
  function defending() {
    return attacking() === 'azure' ? 'crimson' : 'azure';
  }

  return {
    state,
    events,
    attacking,
    defending,
    resetMatch() {
      state.phase = 'menu';
      state.round = 1;
      state.scores.azure = 0;
      state.scores.crimson = 0;
      state.money = 800;
      state.timer = 0;
      state.planted = false;
      state.chargeLeft = 0;
      state.owned = new Set(['P9']);
      state.grenades = 0;
      state.winner = null;
      events.length = 0;
    },
    startBuy() {
      state.phase = 'buy';
      state.timer = BUY_SECS;
      state.planted = false;
      state.chargeLeft = 0;
      state.grenades = 0;
      events.push({ type: 'buyPhase', round: state.round });
    },
    deploy() {
      if (state.phase !== 'buy') return;
      state.phase = 'live';
      state.timer = ROUND_SECS;
      events.push({ type: 'deploy', round: state.round });
    },
    plant() {
      if (state.phase !== 'live' || state.planted) return;
      state.planted = true;
      state.chargeLeft = CHARGE_SECS;
      events.push({ type: 'planted' });
    },
    defuse() {
      if (!state.planted) return;
      state.planted = false;
      events.push({ type: 'defused' });
      this.endRound(defending(), 'defused');
    },
    addKill(killer, victim, weapon, headshot) {
      events.push({ type: 'kill', killer, victim, weapon, headshot });
      if (killer === 'You') state.money += 300;
    },
    buyGun(id, price) {
      if (state.owned.has(id) || state.money < price) return false;
      state.owned.add(id);
      state.money -= price;
      events.push({ type: 'bought', id });
      return true;
    },
    buyGrenade(price) {
      if (state.grenades >= 2 || state.money < price) return false;
      state.grenades += 1;
      state.money -= price;
      events.push({ type: 'bought', id: 'FRAG' });
      return true;
    },
    endRound(winner, reason) {
      if (state.phase !== 'live') return;
      state.scores[winner] += 1;
      state.money += winner === 'azure' ? 1000 : 500;
      state.planted = false;
      state.phase = 'roundEnd';
      state.timer = BANNER_SECS;
      events.push({ type: 'roundEnd', winner, reason, round: state.round });
      const decided = state.scores[winner] >= WIN_SCORE || state.round >= MAX_ROUNDS;
      if (decided) state.winner = state.scores.azure > state.scores.crimson ? 'azure' : 'crimson';
    },
    tick(dt, alive) {
      if (state.phase === 'buy') {
        state.timer -= dt;
        if (state.timer <= 0) this.deploy();
      } else if (state.phase === 'live') {
        state.timer -= dt;
        if (state.planted) {
          state.chargeLeft -= dt;
          if (state.chargeLeft <= 0) {
            this.endRound(attacking(), 'charged');
            return;
          }
        }
        if (state.timer <= 0) {
          this.endRound(defending(), 'time');
          return;
        }
        // A simultaneous wipe (only a grenade can do it) goes to the
        // defenders, like a timeout: the attackers failed to hold anyone.
        if (alive.azure === 0 && alive.crimson === 0) this.endRound(defending(), 'eliminated');
        else if (alive.azure === 0 && alive.crimson > 0) this.endRound('crimson', 'eliminated');
        else if (alive.crimson === 0 && alive.azure > 0) this.endRound('azure', 'eliminated');
      } else if (state.phase === 'roundEnd') {
        state.timer -= dt;
        if (state.timer <= 0) {
          if (state.winner) {
            state.phase = 'matchEnd';
            events.push({ type: 'matchEnd', winner: state.winner });
          } else {
            state.round += 1;
            this.startBuy();
          }
        }
      }
    },
    drainEvents() {
      return events.splice(0, events.length);
    },
  };
}
