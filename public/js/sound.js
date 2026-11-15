// Sound effects manager — uses Web Audio API for generated sounds
const SFX = {
  enabled: true,
  ctx: null,
  
  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
    }
  },
  
  play(type) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    switch (type) {
      case 'dice':
        osc.frequency.value = 400;
        gain.gain.value = 0.1;
        osc.start();
        osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
        osc.stop(this.ctx.currentTime + 0.2);
        break;
      case 'buy':
        osc.frequency.value = 523;
        gain.gain.value = 0.1;
        osc.start();
        osc.frequency.linearRampToValueAtTime(659, this.ctx.currentTime + 0.1);
        osc.frequency.linearRampToValueAtTime(784, this.ctx.currentTime + 0.2);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
        osc.stop(this.ctx.currentTime + 0.3);
        break;
      case 'rent':
        osc.frequency.value = 300;
        gain.gain.value = 0.1;
        osc.frequency.linearRampToValueAtTime(200, this.ctx.currentTime + 0.2);
        osc.start();
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
        osc.stop(this.ctx.currentTime + 0.3);
        break;
      case 'win':
        osc.type = 'square';
        osc.frequency.value = 523;
        gain.gain.value = 0.08;
        osc.start();
        osc.frequency.setValueAtTime(659, this.ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(784, this.ctx.currentTime + 0.3);
        osc.frequency.setValueAtTime(1047, this.ctx.currentTime + 0.45);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.7);
        osc.stop(this.ctx.currentTime + 0.7);
        break;
      case 'jail':
        osc.frequency.value = 600;
        gain.gain.value = 0.1;
        osc.frequency.linearRampToValueAtTime(200, this.ctx.currentTime + 0.3);
        osc.start();
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4);
        osc.stop(this.ctx.currentTime + 0.4);
        break;
    }
  }
};

document.addEventListener('click', () => SFX.init(), { once: true });
