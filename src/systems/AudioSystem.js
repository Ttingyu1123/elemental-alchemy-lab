// ═══ Web Audio 合成音效（無外部素材；首次互動後才建立 AudioContext）═══
export class AudioSystem {
  constructor(settings) {
    this.settings = settings; // 直接引用 save.data.settings
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.musicTimer = null;
    this.musicState = null;
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

  // ═══ 生成式背景音樂：Am–F–C–G 循環，pad＋bass＋琶音＋星塵閃音 ═══
  // 單一 lookahead 排程器（Web Audio 標準模式）；關閉時計時器與節點全數清除
  setMusic(on) {
    if (!on) { this.stopMusic(); return; }
    if (!this.ensure()) return;
    this.resume();
    if (this.musicTimer) return;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.musicGain.gain.exponentialRampToValueAtTime(0.16, this.ctx.currentTime + 1.5);
    this.musicGain.connect(this.master);
    this.musicState = { step: 0, nextTime: this.ctx.currentTime + 0.1 };
    this.musicTimer = setInterval(() => this.scheduleMusic(), 120);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicGain) {
      const g = this.musicGain;
      this.musicGain = null;
      try {
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
        setTimeout(() => { try { g.disconnect(); } catch { /* noop */ } }, 600);
      } catch { /* noop */ }
    }
    this.musicState = null;
  }

  scheduleMusic() {
    if (!this.musicState || !this.musicGain) return;
    const STEP_DUR = 0.36; // ≈83 BPM 的八分音符
    const s = this.musicState;
    while (s.nextTime < this.ctx.currentTime + 0.5) {
      this.playMusicStep(s.step, s.nextTime, STEP_DUR);
      s.step = (s.step + 1) % 32; // 4 小節 × 8 步
      s.nextTime += STEP_DUR;
    }
  }

  static CHORDS = [
    { root: 110.00, tones: [220.00, 261.63, 329.63] }, // Am
    { root: 87.31, tones: [174.61, 220.00, 261.63] },  // F
    { root: 130.81, tones: [196.00, 261.63, 329.63] }, // C
    { root: 98.00, tones: [196.00, 246.94, 293.66] },  // G
  ];
  static ARP_PATTERN = [0, 1, 2, 1, 0, 2, 1, 2];

  musicNote({ freq, type = 'triangle', t, dur, gain, attack = 0.01 }) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  playMusicStep(step, t, stepDur) {
    const chord = AudioSystem.CHORDS[Math.floor(step / 8)];
    const sub = step % 8;
    if (sub === 0) {
      // 小節頭：bass＋和弦 pad
      this.musicNote({ freq: chord.root, type: 'sine', t, dur: stepDur * 7.5, gain: 0.5, attack: 0.05 });
      for (const tone of chord.tones) {
        this.musicNote({ freq: tone, type: 'sawtooth', t, dur: stepDur * 7.8, gain: 0.06, attack: 1.2 });
      }
    }
    // 琶音（高八度）
    const arpTone = chord.tones[AudioSystem.ARP_PATTERN[sub]] * 2;
    this.musicNote({ freq: arpTone, type: 'triangle', t, dur: 0.3, gain: 0.14 });
    // 星塵閃音
    if (Math.random() < 0.07) {
      this.musicNote({ freq: chord.tones[2] * 4, type: 'sine', t: t + stepDur / 2, dur: 0.5, gain: 0.05, attack: 0.02 });
    }
  }
}
