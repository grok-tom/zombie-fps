export class UI {
  constructor() {
    this.hpEl = document.getElementById('hud-hp');
    this.ammoEl = document.getElementById('hud-ammo');
    this.waveEl = document.getElementById('hud-wave');
    this.killsEl = document.getElementById('hud-kills');
    this.banner = document.getElementById('banner');
    this.vignette = document.getElementById('vignette');
    this.overlay = document.getElementById('overlay');
    this.overlayHint = document.getElementById('overlay-hint');
    this.overlaySummary = document.getElementById('overlay-summary');
    this.overlayTitle = this.overlay.querySelector('h1');
    this.bannerTimer = 0;
  }

  showMenu() {
    this.overlay.classList.remove('hidden');
    this.overlayTitle.textContent = '夜巷求生';
    this.overlayHint.textContent = '点击画面开始';
    this.overlayHint.hidden = false;
    this.overlaySummary.hidden = true;
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
  }

  showDeath(kills, wave) {
    this.overlay.classList.remove('hidden');
    this.overlayTitle.textContent = '你倒下了';
    this.overlaySummary.hidden = false;
    this.overlaySummary.textContent = `撑到第 ${wave} 波 · 击杀 ${kills}`;
    this.overlayHint.hidden = false;
    this.overlayHint.textContent = '点击重新开始';
  }

  update({ hp, ammo, wave, kills, damageFlash }) {
    this.hpEl.textContent = String(Math.max(0, Math.ceil(hp)));
    this.ammoEl.textContent = ammo;
    this.waveEl.textContent = String(wave);
    this.killsEl.textContent = String(kills);
    this.vignette.style.opacity = String(Math.min(1, damageFlash * 0.85));
  }

  flashBanner(text, duration = 2.2) {
    this.banner.textContent = text;
    this.banner.classList.add('show');
    this.bannerTimer = duration;
  }

  updateBanner(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove('show');
    }
  }
}
