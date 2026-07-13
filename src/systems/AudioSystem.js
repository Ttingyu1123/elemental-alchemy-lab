// ═══ Web Audio 合成音效（無外部素材；首次互動後才建立 AudioContext）═══
export class AudioSystem {
  constructor(settings) {
    this.settings = settings; // 直接引用 save.data.settings
    this.ctx = null;
    this.master = null;
    this.musicNodes = null;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      return true;
    } catch {
      return false;
    }
  }

  applyVolume() {
    if (this.master) this.master.gain.value = (this.settings.volume ?? 70) / 100 * 0.5;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone({ freq = 440, type = 'sine', dur = 0.12, gain = 0.25, sweep = 0, delay = 0 }) {
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(freq + sweep, 30), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.15, gain = 0.2, freq = 800, delay = 0 }) {
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  play(name, opt = {}) {
    if (!this.settings.sfx) return;
    if (!this.ensure()) return;
    this.resume();
    switch (name) {
      case 'move': this.tone({ freq: 220, type: 'square', dur: 0.04, gain: 0.08 }); break;
      case 'rotate': this.tone({ freq: 330, type: 'triangle', dur: 0.06, gain: 0.12 }); break;
      case 'lock': this.tone({ freq: 95, type: 'sine', dur: 0.1, gain: 0.3 }); this.noise({ dur: 0.06, gain: 0.1, freq: 300 }); break;
      case 'hard': this.noise({ dur: 0.12, gain: 0.25, freq: 500 }); this.tone({ freq: 80, dur: 0.12, gain: 0.3 }); break;
      case 'hold': this.tone({ freq: 500, type: 'triangle', dur: 0.08, gain: 0.12 }); break;
      case 'line': this.tone({ freq: 440, dur: 0.2, gain: 0.2, sweep: 440 }); break;
      case 'reaction': this.tone({ freq: 520 + (opt.pitch ?? 0) * 60, type: 'triangle', dur: 0.18, gain: 0.2, sweep: 200 }); break;
      case 'triple':
        this.tone({ freq: 523, dur: 0.25, gain: 0.2 });
        this.tone({ freq: 659, dur: 0.25, gain: 0.2, delay: 0.06 });
        this.tone({ freq: 784, dur: 0.3, gain: 0.2, delay: 0.12 });
        break;
      case 'chain': this.tone({ freq: 400 + Math.min(opt.chain ?? 1, 10) * 80, type: 'triangle', dur: 0.15, gain: 0.22, sweep: 150 }); break;
      case 'core': this.tone({ freq: 300, dur: 0.3, gain: 0.25, sweep: 500 }); this.noise({ dur: 0.2, gain: 0.12, freq: 1200 }); break;
      case 'spell': this.tone({ freq: 700, type: 'sine', dur: 0.25, gain: 0.2, sweep: -300 }); break;
      case 'bossHit': this.noise({ dur: 0.15, gain: 0.2, freq: 250 }); break;
      case 'bossAttack': this.tone({ freq: 150, type: 'sawtooth', dur: 0.3, gain: 0.2, sweep: -60 }); break;
      case 'victory':
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.3, gain: 0.2, delay: i * 0.12 }));
        break;
      case 'fail':
        [400, 350, 300, 200].forEach((f, i) => this.tone({ freq: f, type: 'sawtooth', dur: 0.3, gain: 0.15, delay: i * 0.15 }));
        break;
      case 'denied': this.tone({ freq: 160, type: 'square', dur: 0.1, gain: 0.15 }); break;
      case 'discover': [660, 880].forEach((f, i) => this.tone({ freq: f, dur: 0.2, gain: 0.2, delay: i * 0.1 })); break;
    }
  }

  setMusic(on) {
    if (on) {
      if (!this.ensure()) return;
      this.resume();
      if (this.musicNodes) return;
      // 簡單雙振盪器 pad 循環
      const g = this.ctx.createGain();
      g.gain.value = 0.05;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'sawtooth';
      o1.frequency.value = 110; o2.frequency.value = 110.7;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.08;
      lfoGain.gain.value = 200;
      lfo.connect(lfoGain).connect(filter.frequency);
      o1.connect(filter); o2.connect(filter);
      filter.connect(g).connect(this.master);
      o1.start(); o2.start(); lfo.start();
      this.musicNodes = [o1, o2, lfo];
    } else if (this.musicNodes) {
      for (const n of this.musicNodes) { try { n.stop(); } catch { /* noop */ } }
      this.musicNodes = null;
    }
  }
}
