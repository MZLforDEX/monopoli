const SFX = {
  enabled: true,
  ctx: null,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
    }
  },

  toggleMute() {
    this.enabled = !this.enabled;
    const btn = document.getElementById('sound-toggle-btn');
    if (btn) {
      btn.textContent = this.enabled ? '🔊' : '🔇';
      btn.setAttribute('aria-label', this.enabled ? 'Matikan Suara' : 'Nyalakan Suara');
    }
    return this.enabled;
  },

  play(type) {
    if (!this.enabled) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    switch (type) {
      case 'dice':
        osc.frequency.setValueAtTime(380, now);
        gain.gain.setValueAtTime(0.08, now);
        osc.start(now);
        osc.frequency.linearRampToValueAtTime(760, now + 0.12);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
        osc.stop(now + 0.22);
        break;
      case 'buy':
        osc.frequency.setValueAtTime(523.25, now);
        gain.gain.setValueAtTime(0.08, now);
        osc.start(now);
        osc.frequency.linearRampToValueAtTime(659.25, now + 0.1);
        osc.frequency.linearRampToValueAtTime(783.99, now + 0.2);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.32);
        osc.stop(now + 0.32);
        break;
      case 'rent':
        osc.frequency.setValueAtTime(320, now);
        gain.gain.setValueAtTime(0.06, now);
        osc.frequency.linearRampToValueAtTime(220, now + 0.14);
        osc.start(now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
        osc.stop(now + 0.18);
        break;
      case 'win':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        gain.gain.setValueAtTime(0.1, now);
        osc.start(now);
        osc.frequency.setValueAtTime(659.25, now + 0.14);
        osc.frequency.setValueAtTime(783.99, now + 0.28);
        osc.frequency.setValueAtTime(1046.5, now + 0.42);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.7);
        osc.stop(now + 0.7);
        break;
      case 'jail':
        osc.frequency.setValueAtTime(540, now);
        gain.gain.setValueAtTime(0.09, now);
        osc.frequency.linearRampToValueAtTime(190, now + 0.3);
        osc.start(now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.38);
        osc.stop(now + 0.38);
        break;
    }
  }
};

document.addEventListener('pointerdown', () => SFX.init(), { once: true });
