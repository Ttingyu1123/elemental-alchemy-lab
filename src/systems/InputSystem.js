// ═══ 鍵盤＋觸控輸入；DAS/ARR 由 update(dt) 驅動（暫停時不呼叫 update 即完全停止）═══
import { DAS_MS, ARR_MS, COLS } from '../config.js';

// 棋盤手勢參數
const TAP_SLOP_PX = 12;      // 位移小於此值視為點擊
const TAP_MAX_MS = 300;
const SOFT_ENGAGE_MS = 200;  // 下滑超過此時間才進入軟降（更快的甩動走硬降）
const HARD_FLICK_CELLS = 1.8; // 快甩觸發硬降的最小下滑距離（格）
const HARD_FLICK_VY = 0.015;  // 硬降的放開瞬間速度門檻（格/ms；取放開前 120ms 窗口）
const FLICK_WINDOW_MS = 120;
const HOLD_SWIPE_CELLS = 1.2; // 上滑觸發暫存的最小距離（格）
const HOLD_SWIPE_MAX_MS = 350;

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

  // ═══ 棋盤手勢：拖曳跟隨移動、點擊旋轉、慢拖軟降、快甩硬降、上滑暫存 ═══
  // isBlocked() 為 true 時（無 session／暫停／法術選格中）整個手勢層停用
  bindGestures(canvas, { isBlocked } = {}) {
    const g = { id: null, x0: 0, y0: 0, t0: 0, axis: null, cells: 0, soft: false, samples: [] };
    const cellPx = () => canvas.getBoundingClientRect().width / COLS;

    // 放開瞬間的垂直速度（px/ms）：只看最後 FLICK_WINDOW_MS 內的取樣
    const releaseVy = (now) => {
      const win = g.samples.filter((s) => now - s.t <= FLICK_WINDOW_MS);
      if (win.length < 2) return 0;
      const dt = win[win.length - 1].t - win[0].t;
      return dt > 0 ? (win[win.length - 1].y - win[0].y) / dt : 0;
    };

    const abort = () => {
      if (g.soft) this.fire('softOff');
      g.id = null;
      g.axis = null;
      g.soft = false;
    };

    canvas.addEventListener('pointerdown', (e) => {
      if (g.id !== null || isBlocked?.()) return;
      g.id = e.pointerId;
      g.x0 = e.clientX;
      g.y0 = e.clientY;
      g.t0 = performance.now();
      g.axis = null;
      g.cells = 0;
      g.soft = false;
      g.samples = [{ t: g.t0, y: e.clientY }];
      canvas.setPointerCapture?.(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== g.id) return;
      if (isBlocked?.()) { abort(); return; }
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      g.samples.push({ t: performance.now(), y: e.clientY });
      if (g.samples.length > 12) g.samples.shift();
      if (!g.axis) {
        if (Math.hypot(dx, dy) < TAP_SLOP_PX) return;
        g.axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
      }
      if (g.axis === 'h') {
        // 拼塊跟隨手指：每跨過一格寬觸發一次移動
        const target = Math.round(dx / cellPx());
        while (g.cells < target) { g.cells++; this.fire('right'); }
        while (g.cells > target) { g.cells--; this.fire('left'); }
      } else if (dy > 0 && !g.soft) {
        if (performance.now() - g.t0 >= SOFT_ENGAGE_MS && dy > cellPx() * 0.6) {
          g.soft = true;
          this.fire('softOn');
        }
      }
    });

    const finish = (e) => {
      if (e.pointerId !== g.id) return;
      const { axis, t0 } = g;
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      const now = performance.now();
      g.samples.push({ t: now, y: e.clientY });
      const vy = releaseVy(now);
      abort(); // 先收掉軟降，再判定放開手勢
      if (e.type === 'pointercancel' || isBlocked?.()) return;
      const elapsed = now - t0;
      const cell = cellPx();
      if (!axis && elapsed <= TAP_MAX_MS) {
        // 點擊旋轉：棋盤右半順時針、左半逆時針
        const rect = canvas.getBoundingClientRect();
        this.fire(e.clientX - rect.left >= rect.width / 2 ? 'cw' : 'ccw');
      } else if (axis === 'v' && dy > cell * HARD_FLICK_CELLS && vy >= cell * HARD_FLICK_VY) {
        // 放開瞬間仍在快速下甩 → 硬降（慢拖軟降後最後一甩也成立）
        this.fire('hard');
      } else if (axis === 'v' && dy < -cell * HOLD_SWIPE_CELLS && elapsed <= HOLD_SWIPE_MAX_MS) {
        this.fire('hold');
      }
    };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
  }

  // 清空按住狀態（切畫面 / 暫停恢復時防幽靈輸入）
  reset() {
    this.held.left = false;
    this.held.right = false;
    this.activeDir = null;
    this.softHeld = false;
  }
}
