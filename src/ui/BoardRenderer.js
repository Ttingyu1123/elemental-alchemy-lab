// ═══ Canvas 渲染器＋粒子／浮動文字（純顯示，不改遊戲資料）═══
import { COLS, VISIBLE_ROWS, HIDDEN_ROWS, MAX_PARTICLES } from '../config.js';
import { ELEMENTS } from '../data/elements.js';

// ── 元素圖示（向量繪製，不依賴顏色辨識）──
export function drawElementIcon(g, el, cx, cy, s) {
  g.save();
  g.translate(cx, cy);
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = Math.max(1.5, s * 0.09);
  g.lineJoin = 'round';
  const r = s * 0.28;
  switch (el) {
    case 'fire': // 三角火焰
      g.beginPath();
      g.moveTo(0, -r); g.lineTo(r * 0.9, r * 0.75); g.lineTo(-r * 0.9, r * 0.75);
      g.closePath(); g.fill();
      break;
    case 'water': // 水滴
      g.beginPath();
      g.moveTo(0, -r);
      g.bezierCurveTo(r, 0, r * 0.85, r * 0.9, 0, r * 0.9);
      g.bezierCurveTo(-r * 0.85, r * 0.9, -r, 0, 0, -r);
      g.fill();
      break;
    case 'earth': // 菱形晶體
      g.beginPath();
      g.moveTo(0, -r); g.lineTo(r, 0); g.lineTo(0, r); g.lineTo(-r, 0);
      g.closePath(); g.fill();
      break;
    case 'air': // 三道氣流
      g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(-r, i * r * 0.62);
        g.quadraticCurveTo(0, i * r * 0.62 - r * 0.3, r, i * r * 0.62);
        g.stroke();
      }
      break;
    case 'light': { // 四芒星
      g.beginPath();
      const q = r * 0.32;
      g.moveTo(0, -r); g.lineTo(q, -q); g.lineTo(r, 0); g.lineTo(q, q);
      g.lineTo(0, r); g.lineTo(-q, q); g.lineTo(-r, 0); g.lineTo(-q, -q);
      g.closePath(); g.fill();
      break;
    }
    case 'shadow': // 新月
      g.beginPath();
      g.arc(0, 0, r, Math.PI * 0.25, Math.PI * 1.75);
      g.arc(r * 0.5, 0, r * 0.72, Math.PI * 1.6, Math.PI * 0.4, true);
      g.closePath(); g.fill();
      break;
  }
  g.restore();
}

// ── 單格繪製（棋盤與預覽共用）──
export function drawCell(g, cell, x, y, s) {
  const pad = Math.max(1, s * 0.045);
  const rad = s * 0.16;
  const rr = (fill, stroke) => {
    g.beginPath();
    g.roundRect(x + pad, y + pad, s - pad * 2, s - pad * 2, rad);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = Math.max(1, s * 0.05); g.stroke(); }
  };
  const cx = x + s / 2, cy = y + s / 2;
  const elDef = cell.el ? ELEMENTS[cell.el] : null;

  switch (cell.kind) {
    case 'normal': {
      const grad = g.createLinearGradient(x, y, x, y + s);
      grad.addColorStop(0, elDef.secondaryColor);
      grad.addColorStop(0.35, elDef.color);
      grad.addColorStop(1, shade(elDef.color, -0.35));
      rr(grad, 'rgba(255,255,255,0.22)');
      drawElementIcon(g, cell.el, cx, cy, s);
      break;
    }
    case 'gold': {
      const grad = g.createLinearGradient(x, y, x, y + s);
      grad.addColorStop(0, '#ffe9a0');
      grad.addColorStop(1, elDef ? elDef.color : '#c8a030');
      rr(grad, '#ffd75e');
      if (cell.el) drawElementIcon(g, cell.el, cx, cy, s);
      g.fillStyle = '#fff2b0';
      g.beginPath(); g.arc(x + s * 0.78, y + s * 0.22, s * 0.09, 0, 7); g.fill();
      break;
    }
    case 'ether': {
      const grad = g.createLinearGradient(x, y, x + s, y + s);
      grad.addColorStop(0, '#ff9ad5'); grad.addColorStop(0.5, '#9ad5ff'); grad.addColorStop(1, '#d5ff9a');
      rr(grad, '#ffffff');
      g.fillStyle = '#fff';
      g.font = `${s * 0.5}px serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('✳', cx, cy + s * 0.03);
      break;
    }
    case 'rune': {
      rr('#5a3010', '#ff9a3c');
      g.strokeStyle = '#ffcf70'; g.lineWidth = Math.max(1.5, s * 0.08); g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        g.beginPath(); g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * s * 0.3, cy + Math.sin(a) * s * 0.3); g.stroke();
      }
      g.beginPath(); g.arc(cx, cy, s * 0.12, 0, 7); g.stroke();
      break;
    }
    case 'chain': {
      rr('#4a4a5e', '#9a9ab8');
      g.strokeStyle = '#c8c8e0'; g.lineWidth = Math.max(2, s * 0.1);
      g.beginPath(); g.arc(cx - s * 0.12, cy, s * 0.14, 0, 7); g.stroke();
      g.beginPath(); g.arc(cx + s * 0.12, cy, s * 0.14, 0, 7); g.stroke();
      if (cell.hp <= 1) { // 裂痕
        g.strokeStyle = '#fff'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x + s * 0.2, y + s * 0.25); g.lineTo(x + s * 0.5, y + s * 0.55); g.lineTo(x + s * 0.35, y + s * 0.8); g.stroke();
      }
      break;
    }
    case 'rock': case 'rock_hard': {
      rr(cell.kind === 'rock' ? '#6a5c4c' : '#3c3844', cell.kind === 'rock' ? '#8a7a66' : '#20202c');
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.arc(cx - s * 0.15, cy - s * 0.1, s * 0.1, 0, 7); g.fill();
      g.beginPath(); g.arc(cx + s * 0.18, cy + s * 0.15, s * 0.08, 0, 7); g.fill();
      if (cell.kind === 'rock_hard') {
        g.strokeStyle = '#8a8aa0'; g.lineWidth = 2;
        g.strokeRect(x + pad * 2.5, y + pad * 2.5, s - pad * 5, s - pad * 5);
      }
      break;
    }
    case 'corrupt': {
      rr('#2a1638', '#6d4bb8');
      g.fillStyle = '#8a5fc0';
      for (const [dx, dy, rr2] of [[-0.18, -0.14, 0.1], [0.15, 0.05, 0.13], [-0.05, 0.22, 0.08]]) {
        g.beginPath(); g.arc(cx + dx * s, cy + dy * s, rr2 * s, 0, 7); g.fill();
      }
      break;
    }
    case 'ice': {
      if (cell.el) {
        const grad = g.createLinearGradient(x, y, x, y + s);
        grad.addColorStop(0, ELEMENTS[cell.el].secondaryColor);
        grad.addColorStop(1, ELEMENTS[cell.el].color);
        rr(grad, null);
        drawElementIcon(g, cell.el, cx, cy, s);
      }
      g.fillStyle = 'rgba(200,235,255,0.55)';
      g.beginPath(); g.roundRect(x + pad, y + pad, s - pad * 2, s - pad * 2, rad); g.fill();
      g.strokeStyle = '#d8f4ff'; g.lineWidth = Math.max(1.5, s * 0.07);
      g.beginPath(); g.roundRect(x + pad, y + pad, s - pad * 2, s - pad * 2, rad); g.stroke();
      break;
    }
    case 'icecrystal': {
      rr('rgba(180,225,255,0.85)', '#e8f8ff');
      g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx, cy - s * 0.25); g.lineTo(cx, cy + s * 0.25); g.stroke();
      g.beginPath(); g.moveTo(cx - s * 0.22, cy - s * 0.12); g.lineTo(cx + s * 0.22, cy + s * 0.12); g.stroke();
      g.beginPath(); g.moveTo(cx + s * 0.22, cy - s * 0.12); g.lineTo(cx - s * 0.22, cy + s * 0.12); g.stroke();
      break;
    }
    case 'potion': {
      rr('#1e3a1a', '#8fe06a');
      g.fillStyle = '#8fe06a';
      g.beginPath(); g.arc(cx, cy + s * 0.08, s * 0.2, 0, 7); g.fill();
      g.fillRect(cx - s * 0.05, cy - s * 0.3, s * 0.1, s * 0.22);
      g.fillStyle = '#fff'; g.font = `bold ${s * 0.34}px sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(cell.timer ?? ''), x + s * 0.72, y + s * 0.28);
      break;
    }
    case 'core': {
      const col = ELEMENTS[cell.coreEl]?.color ?? '#fff';
      const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 200);
      const grad = g.createRadialGradient(cx, cy, s * 0.05, cx, cy, s * 0.45);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, col);
      grad.addColorStop(1, shade(col, -0.5));
      rr(grad, cell.strong ? '#ffd75e' : 'rgba(255,255,255,0.6)');
      g.globalAlpha = pulse;
      drawElementIcon(g, cell.coreEl, cx, cy, s * (cell.strong ? 1.1 : 0.9));
      g.globalAlpha = 1;
      break;
    }
    case 'crystal': {
      rr('#2d5438', '#b8f0c0');
      g.fillStyle = '#d8ffde';
      g.beginPath();
      g.moveTo(cx, cy - s * 0.28); g.lineTo(cx + s * 0.2, cy); g.lineTo(cx, cy + s * 0.28); g.lineTo(cx - s * 0.2, cy);
      g.closePath(); g.fill();
      break;
    }
    case 'plant': {
      rr('#274a22', '#69c56a');
      g.fillStyle = '#8fe08a';
      g.beginPath(); g.ellipse(cx - s * 0.1, cy, s * 0.16, s * 0.26, -0.6, 0, 7); g.fill();
      g.beginPath(); g.ellipse(cx + s * 0.14, cy - s * 0.05, s * 0.13, s * 0.2, 0.6, 0, 7); g.fill();
      break;
    }
    case 'lava': {
      const grad = g.createLinearGradient(x, y, x, y + s);
      grad.addColorStop(0, '#ffb35c'); grad.addColorStop(1, '#c02800');
      rr(grad, '#ff7030');
      g.fillStyle = '#ffe0a0';
      for (let i = 0; i < (cell.timer ?? 0); i++) {
        g.beginPath(); g.arc(x + s * (0.28 + i * 0.22), y + s * 0.75, s * 0.06, 0, 7); g.fill();
      }
      break;
    }
    case 'sand': {
      rr('#b8a068', '#d9c07a');
      g.fillStyle = 'rgba(90,70,30,0.5)';
      for (const [dx, dy] of [[0.25, 0.3], [0.6, 0.5], [0.4, 0.72], [0.7, 0.25]]) {
        g.beginPath(); g.arc(x + s * dx, y + s * dy, s * 0.045, 0, 7); g.fill();
      }
      if (cell.timer != null) {
        g.fillStyle = '#4a3820'; g.font = `bold ${s * 0.36}px sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(cell.timer), cx, cy);
      }
      break;
    }
    case 'tree': {
      rr('#1c3a2a', '#8be29a');
      g.fillStyle = '#6a4a2a';
      g.fillRect(cx - s * 0.06, cy, s * 0.12, s * 0.3);
      g.fillStyle = '#5fce74';
      g.beginPath(); g.arc(cx, cy - s * 0.08, s * 0.24, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = `bold ${s * 0.3}px sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(cell.timer ?? ''), x + s * 0.74, y + s * 0.26);
      break;
    }
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ── 迷你預覽（下一個／暫存）──
export function drawPiecePreview(canvas, piece, slot = 0, slots = 1) {
  const g = canvas.getContext('2d');
  const cellSize = canvas.width / 5;
  if (slot === 0) g.clearRect(0, 0, canvas.width, canvas.height);
  if (!piece) return;
  const st = piece.shape.states[0];
  const w = Math.max(...st.map(p => p[0])) + 1;
  const h = Math.max(...st.map(p => p[1])) + 1;
  const areaH = canvas.height / slots;
  const ox = (canvas.width - w * cellSize) / 2;
  const oy = slot * areaH + (areaH - h * cellSize) / 2;
  st.forEach(([dx, dy], i) => {
    drawCell(g, piece.cells[i], ox + dx * cellSize, oy + dy * cellSize, cellSize);
  });
}

// ═══ 主渲染器 ═══
export class BoardRenderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.settings = settings;
    this.cell = 30;
    this.particles = [];
    this.floats = [];
    this.flashes = [];
    this.shake = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const wrap = this.canvas.parentElement;
    if (!wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const availW = wrap.clientWidth || 300;
    const availH = wrap.clientHeight || 600;
    this.cell = Math.max(12, Math.floor(Math.min(availW / COLS, availH / VISIBLE_ROWS)));
    const w = this.cell * COLS;
    const h = this.cell * VISIBLE_ROWS;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
  }

  // 螢幕座標 → 邏輯格（含隱藏列偏移）；點在棋盤外回傳 null
  cellFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor(x / this.cell);
    const vr = Math.floor(y / this.cell);
    if (c < 0 || c >= COLS || vr < 0 || vr >= VISIBLE_ROWS) return null;
    return { r: vr + HIDDEN_ROWS, c };
  }

  // ── FX 介面（效果系統呼叫）──
  fxCount(n) { return this.settings.reduced ? Math.ceil(n / 3) : n; }

  burst(r, c, color, n = 10) {
    if (this.particles.length > MAX_PARTICLES) return;
    const { x, y } = this.center(r, c);
    for (let i = 0; i < this.fxCount(n); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.5 + Math.random() * 0.4, t: 0, color, size: 2 + Math.random() * 3,
      });
    }
  }

  flash(r, c, color) {
    this.flashes.push({ r, c, color, t: 0, dur: 0.25 });
  }

  floatText(r, c, text, color = '#fff') {
    const { x, y } = this.center(r, c);
    this.floats.push({ x, y, text, color, t: 0, dur: 1.1 });
  }

  ring(r, c, color, radius = 1) {
    const { x, y } = this.center(r, c);
    this.flashes.push({ ring: true, x, y, color, t: 0, dur: 0.5, maxR: (radius + 0.5) * this.cell * 2 });
    this.burst(r, c, color, 14);
  }

  cross(r, c, color, len = 2) {
    for (let k = -len; k <= len; k++) {
      this.flash(r + k, c, color);
      this.flash(r, c + k, color);
    }
    this.burst(r, c, color, 16);
  }

  bolt(r, c) {
    const { x } = this.center(r, c);
    this.flashes.push({ bolt: true, x, y0: 0, y1: this.center(r, c).y, t: 0, dur: 0.3 });
    this.burst(r, c, '#ffe97a', 12);
  }

  steamPlume(r, c, big = false) {
    if (this.particles.length > MAX_PARTICLES) return;
    const { x, y } = this.center(r, c);
    for (let i = 0; i < this.fxCount(big ? 26 : 12); i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * this.cell * (big ? 4 : 1),
        y, vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 100,
        life: 0.8 + Math.random() * 0.5, t: 0, color: 'rgba(230,242,250,0.85)',
        size: 4 + Math.random() * 5,
      });
    }
  }

  eclipseWave(r, c) {
    this.ring(r, c, '#c9a7ff', 4);
    this.shake = 0.35;
  }

  reactionFx(def, cells, score, twin) {
    for (const { r, c } of cells) this.burst(r, c, def.color, 10);
    const first = cells[0];
    this.floatText(first.r, first.c, `${def.name} +${score}${twin ? ' ×2!' : ''}`, def.color);
    if (def.elements.length === 3) this.shake = Math.max(this.shake, 0.3);
  }

  resonanceFx(group, bonus) {
    const el = ELEMENTS[group.el];
    for (const { r, c } of group.cells) this.burst(r, c, el.color, 8);
    const first = group.cells[0];
    this.floatText(first.r, first.c, `共鳴 ×${group.cells.length} +${bonus}`, el.color);
  }

  lineFx(rows, score) {
    for (const r of rows) {
      for (let c = 0; c < COLS; c++) this.flash(r, c, '#ffffff');
    }
    if (rows.length >= 2) this.floatText(rows[0], 4, `+${score}`, '#e8c26a');
  }

  bossHitFx(dmg, src) {
    this.floats.push({
      x: this.cell * COLS / 2, y: this.cell * 2,
      text: `${src} -${dmg}`, color: '#ff7a8a', t: 0, dur: 1.0,
    });
  }

  bigText(text) {
    const banner = document.getElementById('chain-banner');
    if (!banner) return;
    banner.textContent = text;
    banner.classList.remove('hidden');
    banner.style.animation = 'none';
    void banner.offsetWidth; // 重新觸發動畫
    banner.style.animation = '';
  }

  center(r, c) {
    return { x: (c + 0.5) * this.cell, y: (r - HIDDEN_ROWS + 0.5) * this.cell };
  }

  // ── 主繪製 ──
  render(sess, dt) {
    const g = this.g;
    const s = this.cell;
    const W = s * COLS, H = s * VISIBLE_ROWS;
    g.save();
    if (this.shake > 0 && !this.settings.reduced) {
      this.shake = Math.max(0, this.shake - dt / 1000);
      g.translate((Math.random() - 0.5) * this.shake * 14, (Math.random() - 0.5) * this.shake * 14);
    }
    g.clearRect(-10, -10, W + 20, H + 20);

    // 背景格線＋煉金圓陣
    g.strokeStyle = 'rgba(150,130,220,0.09)';
    g.lineWidth = 1;
    for (let c = 1; c < COLS; c++) { g.beginPath(); g.moveTo(c * s, 0); g.lineTo(c * s, H); g.stroke(); }
    for (let r = 1; r < VISIBLE_ROWS; r++) { g.beginPath(); g.moveTo(0, r * s); g.lineTo(W, r * s); g.stroke(); }
    g.strokeStyle = 'rgba(232,194,106,0.06)';
    g.beginPath(); g.arc(W / 2, H / 2, W * 0.42, 0, 7); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, W * 0.28, 0, 7); g.stroke();

    const board = sess.board;

    // 危險區提示（頂部 2 列淡紅）
    g.fillStyle = 'rgba(208,90,110,0.05)';
    g.fillRect(0, 0, W, s * 2);

    // 已鎖定方塊
    for (let r = HIDDEN_ROWS; r < board.rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board.grid[r][c];
        if (cell) drawCell(g, cell, c * s, (r - HIDDEN_ROWS) * s, s);
      }
    }

    // 幽靈落點（僅落下狀態）＋落下中拼塊（法術解析期間拼塊懸停也要畫）
    const piece = sess.piece;
    if (piece && (sess.state === 'falling' || sess.state === 'resolving')) {
      if (sess.state === 'falling') {
        const gy = piece.ghostY(board);
        if (gy !== piece.y) {
          g.globalAlpha = 0.25;
          for (const { r, c, cell } of piece.blocksAt(piece.x, gy)) {
            if (r >= HIDDEN_ROWS) drawCell(g, cell, c * s, (r - HIDDEN_ROWS) * s, s);
          }
          g.globalAlpha = 1;
        }
      }
      for (const { r, c, cell } of piece.blocks()) {
        if (r >= HIDDEN_ROWS - 1) drawCell(g, cell, c * s, (r - HIDDEN_ROWS) * s, s);
      }
    }

    // 閃光層
    for (const f of this.flashes) {
      f.t += dt / 1000;
      const a = Math.max(0, 1 - f.t / f.dur);
      if (f.ring) {
        g.strokeStyle = f.color;
        g.globalAlpha = a;
        g.lineWidth = 3;
        g.beginPath(); g.arc(f.x, f.y, (1 - a) * f.maxR, 0, 7); g.stroke();
        g.globalAlpha = 1;
      } else if (f.bolt) {
        g.strokeStyle = '#ffe97a';
        g.globalAlpha = a;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(f.x, 0);
        let yy = 0;
        while (yy < f.y1) { yy += s; g.lineTo(f.x + (Math.random() - 0.5) * s * 0.8, Math.min(yy, f.y1)); }
        g.stroke();
        g.globalAlpha = 1;
      } else if (f.r !== undefined) {
        g.fillStyle = f.color;
        g.globalAlpha = a * 0.5;
        g.fillRect(f.c * s, (f.r - HIDDEN_ROWS) * s, s, s);
        g.globalAlpha = 1;
      }
    }
    this.flashes = this.flashes.filter(f => f.t < f.dur);

    // 粒子
    for (const p of this.particles) {
      p.t += dt / 1000;
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.vy += 220 * dt / 1000;
      const a = Math.max(0, 1 - p.t / p.life);
      g.globalAlpha = a;
      g.fillStyle = p.color;
      g.beginPath(); g.arc(p.x, p.y, p.size, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    this.particles = this.particles.filter(p => p.t < p.life);

    // 浮動文字
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const f of this.floats) {
      f.t += dt / 1000;
      const a = Math.max(0, 1 - f.t / f.dur);
      g.globalAlpha = a;
      g.font = `bold ${Math.max(13, s * 0.5)}px "Segoe UI", sans-serif`;
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.lineWidth = 3;
      const yy = f.y - f.t * 40;
      g.strokeText(f.text, f.x, yy);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, yy);
    }
    g.globalAlpha = 1;
    this.floats = this.floats.filter(f => f.t < f.dur);

    g.restore();
  }

  clearFx() {
    this.particles = [];
    this.floats = [];
    this.flashes = [];
    this.shake = 0;
  }
}
