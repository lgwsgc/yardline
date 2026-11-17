// face.js — every DOM element the player sees: score bar, timer, kill feed,
// vitals, ammo, crosshair, hitmarker, channel bar, banners, the buy menu and
// the overlays. The buy menu re-renders only on buy events; the timer ticks
// through a separate cheap update.
import { GUNS, GRENADE, ORDER } from './arms.js';

function el(id) {
  return document.getElementById(id);
}

export function createFace() {
  const top = {
    score: el('score-line'),
    round: el('round-label'),
    clock: el('clock'),
  };
  const feedBox = el('feed');
  const hpBar = el('hp-bar');
  const hpNum = el('hp-num');
  const cashEl = el('cash');
  const pipsA = el('pips-azure');
  const pipsC = el('pips-crimson');
  const ammoMag = el('ammo-mag');
  const ammoRes = el('ammo-reserve');
  const gunName = el('gun-name');
  const nadeCount = el('nade-count');
  const cross = el('crosshair');
  const marker = el('hitmarker');
  const vignette = el('vignette');
  const channel = el('channel');
  const channelLabel = el('channel-label');
  const channelFill = el('channel-fill');
  const banner = el('banner');
  const bannerText = el('banner-text');
  const bannerSub = el('banner-sub');
  const buyBox = el('buy');
  const buyRows = el('buy-rows');
  const buyCash = el('buy-cash');
  const buyTimer = el('buy-timer');
  const overlay = el('overlay');
  const overlayTitle = el('overlay-title');
  const overlayCopy = el('overlay-copy');
  const playBtn = el('play');
  const restartBtn = el('restart');
  const spectateLabel = el('spectate-label');
  const hintEl = el('hint');

  let markerTimer = 0;
  let bannerTimer = 0;
  let playCb = null;
  let restartCb = null;
  let deployCb = null;
  let buyCb = null;

  playBtn.addEventListener('click', () => playCb && playCb());
  restartBtn.addEventListener('click', () => restartCb && restartCb());
  el('deploy-btn').addEventListener('click', () => deployCb && deployCb());

  function pips(box, n) {
    box.innerHTML = '';
    for (let i = 0; i < 3; i += 1) {
      const s = document.createElement('i');
      if (i < n) s.className = 'on';
      box.appendChild(s);
    }
  }

  return {
    onPlay(cb) {
      playCb = cb;
    },
    onRestart(cb) {
      restartCb = cb;
    },
    onDeploy(cb) {
      deployCb = cb;
    },
    onBuy(cb) {
      buyCb = cb;
    },
    setScore(a, c, round, attacking) {
      top.score.textContent = `AZURE ${a} — ${c} CRIMSON`;
      top.round.textContent = `ROUND ${round} · ${attacking === 'azure' ? 'AZURE ATTACKS' : 'CRIMSON ATTACKS'}`;
    },
    setClock(sec, planted, chargeLeft) {
      if (planted) {
        top.clock.textContent = `CHARGE ${Math.max(0, Math.ceil(chargeLeft))}s`;
        top.clock.classList.add('hot');
      } else {
        const m = Math.floor(Math.max(0, sec) / 60);
        const s = Math.floor(Math.max(0, sec) % 60);
        top.clock.textContent = `${m}:${String(s).padStart(2, '0')}`;
        top.clock.classList.remove('hot');
      }
    },
    setCash(n) {
      cashEl.textContent = `$${n}`;
    },
    setHealth(hp) {
      hpBar.style.width = `${Math.max(0, hp)}%`;
      hpNum.textContent = String(Math.max(0, Math.ceil(hp)));
      hpNum.classList.toggle('low', hp > 0 && hp <= 30);
    },
    setPips(a, c) {
      pips(pipsA, a);
      pips(pipsC, c);
    },
    setAmmo(mag, reserve, name, nades) {
      ammoMag.textContent = String(mag);
      ammoRes.textContent = `/ ${reserve}`;
      gunName.textContent = name;
      nadeCount.textContent = nades > 0 ? `◉ ${nades}` : '';
      ammoMag.parentElement.classList.toggle('empty', mag === 0);
    },
    setCrosshair(px) {
      cross.style.setProperty('--gap', `${px.toFixed(1)}px`);
    },
    hitMarker(kill, holdMs) {
      marker.classList.toggle('kill', kill);
      marker.classList.add('on');
      window.clearTimeout(markerTimer);
      markerTimer = window.setTimeout(() => marker.classList.remove('on'), holdMs);
    },
    flashHurt() {
      vignette.classList.remove('show');
      void vignette.offsetWidth;
      vignette.classList.add('show');
    },
    banner(text, sub, ms = 2400) {
      bannerText.textContent = text;
      bannerSub.textContent = sub || '';
      banner.classList.remove('show');
      void banner.offsetWidth;
      banner.classList.add('show');
      window.clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => banner.classList.remove('show'), ms);
    },
    feed(killer, weapon, victim, headshot) {
      const line = document.createElement('div');
      line.className = 'feed-line';
      const k = document.createElement('b');
      k.textContent = killer;
      const w = document.createElement('span');
      w.textContent = ` ${headshot ? '◎ ' : ''}${weapon} `;
      const v = document.createElement('b');
      v.textContent = victim;
      line.append(k, w, v);
      feedBox.prepend(line);
      while (feedBox.children.length > 5) feedBox.lastChild.remove();
      window.setTimeout(() => line.remove(), 6000);
    },
    setChannel(label, frac) {
      channel.hidden = false;
      channelLabel.textContent = label;
      channelFill.style.width = `${Math.round(frac * 100)}%`;
    },
    hideChannel() {
      channel.hidden = true;
    },
    showBuy(money, owned, current) {
      document.body.classList.add('buying');
      buyBox.hidden = false;
      this.updateBuy(money, owned, current);
    },
    hideBuy() {
      document.body.classList.remove('buying');
      buyBox.hidden = true;
    },
    setBuyTimer(sec) {
      buyTimer.textContent = `Deploy in ${Math.max(0, Math.ceil(sec))}s — Enter to deploy`;
    },
    updateBuy(money, owned, current) {
      buyCash.textContent = `$${money}`;
      buyRows.innerHTML = '';
      const rows = ORDER.map((id) => ({ id, ...GUNS[id] }));
      rows.push({ id: 'FRAG', name: 'Frag grenade', price: GRENADE.price, dmg: 110, gap: 1 });
      rows.forEach((w, i) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'buy-row';
        if (owned.has(w.id)) row.classList.add('owned');
        if (w.id === current) row.classList.add('current');
        const dmgPct = Math.round((w.dmg / 65) * 100);
        const ratePct = Math.round(Math.min(1, 0.07 / w.gap) * 100);
        row.innerHTML = `<span class="buy-key">${i + 1}</span><span class="buy-name">${w.name}</span>`
          + `<span class="buy-bars"><i style="width:${dmgPct}%"></i><i style="width:${ratePct}%"></i></span>`
          + `<span class="buy-price">${owned.has(w.id) ? 'OWNED' : `$${w.price}`}</span>`;
        row.addEventListener('click', () => buyCb && buyCb(w.id));
        buyRows.appendChild(row);
      });
    },
    showOverlay(kind, data = {}) {
      overlay.hidden = false;
      document.body.classList.add('overlay-open');
      overlay.classList.toggle('no-keys', kind === 'matchEnd');
      restartBtn.hidden = kind === 'start';
      if (kind === 'start') {
        overlayTitle.textContent = 'YARDLINE';
        overlayCopy.textContent = 'A 3v3 tactical FPS in a dusk container yard. Plant the relay or wipe the other team — first to 3 rounds.';
        playBtn.textContent = 'Click to play';
      } else if (kind === 'paused') {
        overlayTitle.textContent = 'Paused';
        overlayCopy.textContent = 'The round keeps going without you. Jump back in.';
        playBtn.textContent = 'Resume';
      } else if (kind === 'dead') {
        overlayTitle.textContent = 'You are down';
        overlayCopy.textContent = 'Your team is still in the round. Spectate a teammate — click or press Space to switch between them.';
        playBtn.textContent = 'Keep watching';
      } else if (kind === 'matchEnd') {
        overlayTitle.textContent = data.win ? 'VICTORY' : 'DEFEAT';
        overlayCopy.textContent = `Final score AZURE ${data.a} — ${data.c} CRIMSON.`;
        playBtn.textContent = 'Play again';
      }
    },
    hideOverlay() {
      overlay.hidden = true;
      document.body.classList.remove('overlay-open');
    },
    setSpectating(name) {
      spectateLabel.hidden = false;
      spectateLabel.textContent = `SPECTATING ${name} · click or Space to switch`;
    },
    hideSpectating() {
      spectateLabel.hidden = true;
    },
    hint(text) {
      hintEl.hidden = false;
      hintEl.textContent = text;
    },
    hideHint() {
      hintEl.hidden = true;
    },
  };
}
