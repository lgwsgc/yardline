// keys.js — keyboard, mouse and pointer lock. Look deltas and click edges are
// queued and drained once per frame, so a short click can never fall between
// frames at low frame rates or leak across a weapon switch.
export function createKeys(canvas, onLockChange) {
  const keys = new Set();
  const lookQueue = [];
  const clickQueue = [];
  const pressQueue = [];
  let firing = false;
  let aiming = false;
  let locked = false;

  function onKey(e, down) {
    if (e.code === 'Space') e.preventDefault();
    if (down) {
      keys.add(e.code);
      if (!e.repeat) pressQueue.push(e.code);
    } else {
      keys.delete(e.code);
    }
  }

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => {
    keys.clear();
    firing = false;
    aiming = false;
  });

  document.addEventListener('mousemove', (e) => {
    if (locked) lookQueue.push([e.movementX || 0, e.movementY || 0]);
  });
  document.addEventListener('mousedown', (e) => {
    if (!locked) return;
    clickQueue.push(e.button);
    if (e.button === 0) firing = true;
    if (e.button === 2) aiming = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) firing = false;
    if (e.button === 2) aiming = false;
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) {
      firing = false;
      aiming = false;
    }
    onLockChange(locked);
  });

  return {
    keys,
    get firing() {
      return firing;
    },
    get aiming() {
      return aiming;
    },
    get locked() {
      return locked;
    },
    down(code) {
      return keys.has(code);
    },
    takeLook() {
      let x = 0;
      let y = 0;
      while (lookQueue.length) {
        const [dx, dy] = lookQueue.shift();
        x += dx;
        y += dy;
      }
      return { x, y };
    },
    takeClicks() {
      return clickQueue.splice(0, clickQueue.length);
    },
    // One entry per physical key press (auto-repeat filtered out). Drain once
    // per frame; a quick tap between frames is still seen.
    takePresses() {
      return pressQueue.splice(0, pressQueue.length);
    },
    requestLock() {
      if (!locked) canvas.requestPointerLock();
    },
    exitLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
  };
}
