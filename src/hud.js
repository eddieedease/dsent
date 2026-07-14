// Thin wrapper around the HTML HUD overlay.

const el = (id) => document.getElementById(id);

let msgTimer = null;

export const hud = {
  setShield(v) {
    el('hudShield').textContent = Math.max(0, Math.round(v));
    el('shieldBar').firstElementChild.style.width = `${Math.max(0, Math.min(100, v))}%`;
  },
  setEnergy(v) {
    el('hudEnergy').textContent = Math.max(0, Math.round(v));
    el('energyBar').firstElementChild.style.width = `${Math.max(0, Math.min(100, v))}%`;
  },
  setScore(v) { el('hudScore').textContent = v; },
  setLives(v) { el('hudLives').innerHTML = `&#9650; x ${v}`; },
  setLevel(name) { el('hudLevel').textContent = name; },
  setMissiles(v) { el('hudMissiles').textContent = String(v).padStart(3, '0'); },
  setLaserLevel(v) { el('hudLaserLvl').textContent = v; },
  setWeapon(name) { el('hudWeapon').textContent = name; },
  message(text, seconds = 2.5) {
    const m = el('hudMsg');
    m.textContent = text;
    m.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => m.classList.remove('show'), seconds * 1000);
  },
  setGuide(angleDeg, label, opacity = 1) {
    const c = el('guideCompass');
    c.style.opacity = opacity;
    c.querySelector('.arrow-svg').style.transform = `rotate(${angleDeg}deg)`;
    el('guideLabel').textContent = label;
  },
  hideGuide() { el('guideCompass').style.opacity = 0; },
  overlay(title, text, subtitle = 'CLICK TO CONTINUE') {
    el('overlayTitle').textContent = title;
    el('overlayText').innerHTML = text;
    document.querySelector('#overlay .blink').textContent = subtitle;
    el('overlay').style.display = 'flex';
  },
  hideOverlay() { el('overlay').style.display = 'none'; },
};
