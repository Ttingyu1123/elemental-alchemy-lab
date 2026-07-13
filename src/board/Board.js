// ═══ 棋盤資料層（純資料，不碰 Canvas）═══
import { COLS, TOTAL_ROWS, HIDDEN_ROWS } from '../config.js';

let cellUid = 0;

// 中途存檔還原後呼叫：確保新格 id 不與還原格衝突（hitGuard 以 id 去重）
export function ensureCellUidAbove(n) {
  if (Number.isFinite(n) && n > cellUid) cellUid = Math.ceil(n);
}

// kind: normal | ether | gold | rune | chain | rock | rock_hard | corrupt |
//       ice(冰封,兩次) | icecrystal(冰霜產物,一擊碎) | potion | core | crystal |
//       plant | lava | sand | tree
export function makeCell(el, kind = 'normal', extra = {}) {
  return { id: ++cellUid, el, kind, ...extra };
}

export class Board {
  constructor(cols = COLS, rows = TOTAL_ROWS, hidden = HIDDEN_ROWS) {
    this.cols = cols;
    this.rows = rows;
    this.hidden = hidden;
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    this.lockSeq = 0;   // 每次鎖定遞增；同 lockId 的格子彼此「穩定」不反應
    this.version = 0;   // 內容變動計數（反應預覽快取失效用）
  }

  inBounds(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }
  get(r, c) { return this.inBounds(r, c) ? this.grid[r][c] : null; }
  set(r, c, cell) { if (this.inBounds(r, c)) { this.grid[r][c] = cell; this.version++; } }
  isEmpty(r, c) { return this.inBounds(r, c) && this.grid[r][c] === null; }

  // blocks: [{ r, c }]；超出左右下邊界或與既有方塊重疊即碰撞（上方超界不算）
  collides(blocks) {
    for (const b of blocks) {
      if (b.c < 0 || b.c >= this.cols || b.r >= this.rows) return true;
      if (b.r >= 0 && this.grid[b.r][b.c] !== null) return true;
    }
    return false;
  }

  lock(blocks) {
    this.lockSeq += 1;
    for (const b of blocks) {
      b.cell.lockId = this.lockSeq; // 同拼塊元素彼此穩定：不互相反應、不自體共鳴
      if (b.r >= 0 && b.r < this.rows) this.grid[b.r][b.c] = b.cell;
    }
    this.version++;
  }

  findFullRows() {
    const rows = [];
    for (let r = this.hidden; r < this.rows; r++) {
      if (this.grid[r].every(cell => cell !== null)) rows.push(r);
    }
    return rows;
  }

  // 直行壓實重力；回傳是否有移動（消除任何懸空資料）
  applyGravity() {
    let moved = false;
    for (let c = 0; c < this.cols; c++) {
      let write = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        const cell = this.grid[r][c];
        if (cell !== null) {
          if (write !== r) {
            this.grid[write][c] = cell;
            this.grid[r][c] = null;
            moved = true;
          }
          write--;
        }
      }
    }
    if (moved) this.version++;
    return moved;
  }

  // 生成區（隱藏列）被占用 → 失敗
  stackReachedTop() {
    for (let r = 0; r < this.hidden; r++) {
      if (this.grid[r].some(cell => cell !== null)) return true;
    }
    return false;
  }

  forEach(fn) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c]) fn(r, c, this.grid[r][c]);
      }
    }
  }

  count(pred) {
    let n = 0;
    this.forEach((r, c, cell) => { if (pred(cell)) n++; });
    return n;
  }

  columnHeightTop(c) { // 該直行最上方非空格的 row；空行回傳 rows
    for (let r = 0; r < this.rows; r++) {
      if (this.grid[r][c]) return r;
    }
    return this.rows;
  }
}

// 由圖例字串在棋盤底部鋪設初始方塊
// 圖例：F火 W水 E土 A風 L光 S暗 R岩 X硬岩 C腐蝕 K鎖鏈 I冰封 G金 .空
const LETTER_MAP = {
  F: () => makeCell('fire'),
  W: () => makeCell('water'),
  E: () => makeCell('earth'),
  A: () => makeCell('air'),
  L: () => makeCell('light'),
  S: () => makeCell('shadow'),
  R: () => makeCell(null, 'rock', { hp: 1 }),
  X: () => makeCell(null, 'rock_hard'),
  C: () => makeCell(null, 'corrupt'),
  K: () => makeCell(null, 'chain', { hp: 2 }),
  G: () => makeCell('fire', 'gold'),
};

export function applyStartingBlocks(board, patternRows, rng, availableElements) {
  const n = patternRows.length;
  for (let i = 0; i < n; i++) {
    const rowStr = patternRows[i];
    const r = board.rows - n + i;
    for (let c = 0; c < Math.min(rowStr.length, board.cols); c++) {
      const ch = rowStr[c];
      if (ch === '.' || ch === ' ') continue;
      if (ch === 'I') {
        const el = availableElements[Math.floor(rng() * availableElements.length)];
        board.set(r, c, makeCell(el, 'ice', { hp: 2 }));
      } else if (LETTER_MAP[ch]) {
        const cell = LETTER_MAP[ch]();
        if (cell.kind === 'gold') cell.el = availableElements[Math.floor(rng() * availableElements.length)];
        board.set(r, c, cell);
      }
    }
  }
}
