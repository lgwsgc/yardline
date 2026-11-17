// sfx.js — every sound is synthesised with WebAudio: no audio files.
// A short noise burst plus a shaped tone per weapon, and small UI stingers.
export function createSfx() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return true;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const SHOTS = {
    P9: { tone: 220, dur: 0.09, noise: 0.08, filter: 2400, vol: 0.5 },
    VK7: { tone: 160, dur: 0.11, noise: 0.1, filter: 1800, vol: 0.6 },
    H9: { tone: 300, dur: 0.07, noise: 0.06, filter: 3200, vol: 0.42 },
    DMR: { tone: 110, dur: 0.22, noise: 0.18, filter: 1200, vol: 0.75 },
  };

  return {
    unlock() {
      ensure();
    },
    // vol scales the shot down for distant shooters (bot firefights).
    shot(kind, vol = 1) {
      const s = SHOTS[kind] || SHOTS.VK7;
      tone(s.tone, s.dur, 'square', s.vol * 0.5 * vol, 0, s.tone * 0.4);
      noise(s.noise, s.vol * vol, s.filter);
    },
    dry() {
      tone(1400, 0.03, 'square', 0.12);
    },
    hit() {
      tone(1900, 0.05, 'sine', 0.22);
    },
    kill() {
      tone(1200, 0.07, 'sine', 0.25);
      tone(1800, 0.1, 'sine', 0.22, 0.07);
    },
    hurt() {
      tone(90, 0.16, 'sine', 0.5, 0, 50);
      noise(0.1, 0.2, 500);
    },
    reload() {
      tone(700, 0.04, 'square', 0.14);
      tone(950, 0.05, 'square', 0.14, 0.14);
    },
    boom() {
      noise(0.7, 0.9, 320);
      tone(60, 0.6, 'sine', 0.7, 0, 28);
    },
    beep() {
      tone(880, 0.09, 'sine', 0.3);
    },
    swap() {
      tone(900, 0.04, 'square', 0.12);
      tone(1300, 0.05, 'square', 0.12, 0.06);
    },
    sting(win) {
      if (win) {
        tone(523, 0.12, 'triangle', 0.25);
        tone(659, 0.12, 'triangle', 0.25, 0.11);
        tone(784, 0.22, 'triangle', 0.28, 0.22);
      } else {
        tone(392, 0.14, 'triangle', 0.22);
        tone(311, 0.24, 'triangle', 0.22, 0.13);
      }
    },
  };
}
