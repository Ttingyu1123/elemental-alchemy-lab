// ═══ 鍵盤＋觸控輸入；DAS/ARR 由 update(dt) 驅動（暫停時不呼叫 update 即完全停止）═══
import { DAS_MS, ARR_MS } from '../config.js';

const KEY_ACTIONS = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'cw', w: 'cw', W: 'cw',
  z: 'ccw', Z: 'ccw',
  ' ': 'hard',
  c: 'hold', C: 'hold',
  p: 'pause', P: 'pause', Escape: 'pause',
};

export class InputSystem {
  constructor() {
    this.handler = null;
    this.held = { left: false, right: false };
    this.dasTimer = 0;
    this.arrTimer = 0;
    this.activeDir = null;
    this.softHeld = false;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.bindTouch();
  }

  setHandler(fn) { this.handler = fn; }

  fire(action) { this.handler?.(action); }

  onKeyDown(e) {
    if (e.target instanceof HTMLInputElement) return;
    const isSoft = e.key === 'ArrowDown' || e.key === 's' || e.key === 'S';
    if (isSoft) {
      e.preventDefault();
      if (!this.softHeld) { this.softHeld = true; this.fire('softOn'); }
      return;
    }
    const action = KEY_ACTIONS[e.key];
    if (!action) return;
    if (['left', 'right', 'cw', 'hard'].includes(action) || e.key === ' ') e.preventDefault();
    if (e.repeat) return; // 自帶 DAS，忽略系統 repeat
    if (action === 'left' || action === 'right') {
      this.startDir(action);
    }
    this.fire(action);
  }

  onKeyUp(e) {
    const isSoft = e.key === 'ArrowDown' || e.key === 's' || e.key === 'S';
    if (isSoft) {
      this.softHeld = false;
      this.fire('softOff');
      return;
    }
    const action = KEY_ACTIONS[e.key];
    if (action === 'left' || action === 'right') this.stopDir(action);
  }

  startDir(dir) {
    this.held[dir] = true;
    this.activeDir = dir;
    this.dasTimer = 0;
    this.arrTimer = 0;
  }

  stopDir(dir) {
    this.held[dir] = false;
    if (this.activeDir === dir) {
      this.activeDir = this.held.left ? 'left' : this.held.right ? 'right' : null;
      this.dasTimer = 0;
      this.arrTimer = 0;
    }
  }

  // 遊戲進行中每幀呼叫；暫停/結算時不呼叫 → 連續移動即停
  update(dt) {
    if (!this.activeDir) return;
    this.dasTimer += dt;
    if (this.dasTimer >= DAS_MS) {
      this.arrTimer += dt;
      while (this.arrTimer >= ARR_MS) {
        this.arrTimer -= ARR_MS;
        this.fire(this.activeDir);
      }
    }
  }

  bindTouch() {
    const wrap = document.getElementById('touch-controls');
    if (!wrap) return;
    for (const btn of wrap.querySelectorAll('[data-act]')) {
      const act = btn.dataset.act;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture?.(e.pointerId);
        switch (act) {
          case 'left': case 'right': this.startDir(act); this.fire(act); break;
          case 'soft': this.fire('softOn'); break;
          case 'cw': this.fire('cw'); break;
          case 'ccw': this.fire('ccw'); break;
          case 'hard': this.fire('hard'); break;
          case 'hold': this.fire('hold'); break;
        }
      });
      const release = (e) => {
        e.preventDefault();
        if (act === 'left' || act === 'right') this.stopDir(act);
        if (act === 'soft') this.fire('softOff');
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  // 清空按住狀態（切畫面 / 暫停恢復時防幽靈輸入）
  reset() {
    this.held.left = false;
    this.held.right = false;
    this.activeDir = null;
    this.softHeld = false;
  }
}
