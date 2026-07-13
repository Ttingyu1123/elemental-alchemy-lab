// ═══ 反應效果實作＋通用命中邏輯（hitCell 是所有「清除」的唯一入口）═══
import { makeCell } from '../board/Board.js';
import { ELEMENTS } from '../data/elements.js';
import { ENERGY_CRYSTAL } from '../config.js';
import { choice, shuffle } from '../core/Random.js';

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const ROCK_BREAKERS = new Set(['explosion', 'lava', 'hammer', 'eclipse', 'philostone']);
const CORRUPT_BREAKERS = new Set(['holy', 'eclipse', 'explosion', 'lava', 'hammer', 'philostone', 'lightning']);

// ── 通用命中：回傳 true 表示該格被移除或受到有效傷害 ──
export function hitCell(sess, r, c, ctx, source = 'reaction') {
  const b = sess.board;
  const cell = b.get(r, c);
  if (!cell) return false;
  if (ctx.hitGuard.has(cell.id)) return false; // 同一階段每格只吃一次命中
  const mods = sess.relicMods;

  switch (cell.kind) {
    case 'rock': {
      if (ROCK_BREAKERS.has(source) || mods.rockSoftener) {
        ctx.hitGuard.add(cell.id);
        b.set(r, c, null);
        sess.score.addRaw(Math.round(40 * ctx.mult));
        sess.bus.emit('rockDestroyed', { r, c });
        sess.fx?.burst(r, c, '#9a8a70', 10);
        return true;
      }
      return false;
    }
    case 'rock_hard':
      return false;
    case 'chain': {
      ctx.hitGuard.add(cell.id);
      cell.hp -= 1;
      if (cell.hp <= 0) {
        b.set(r, c, null);
        sess.score.addRaw(Math.round(30 * ctx.mult));
        sess.bus.emit('cellCleared', { el: null, kind: 'chain', source });
        sess.fx?.burst(r, c, '#c0c0d8', 10);
      } else {
        sess.fx?.flash(r, c, '#ffffff');
      }
      return true;
    }
    case 'ice': {
      ctx.hitGuard.add(cell.id);
      cell.hp -= 1;
      if (cell.hp <= 0) {
        b.set(r, c, null);
        emitClear(sess, cell, source);
        sess.fx?.burst(r, c, '#a8e0ff', 12);
      } else {
        cell.kind = 'normal'; // 破冰：露出內含元素
        sess.score.addRaw(Math.round(20 * ctx.mult));
        sess.fx?.burst(r, c, '#d8f4ff', 8);
      }
      return true;
    }
    case 'icecrystal': {
      ctx.hitGuard.add(cell.id);
      b.set(r, c, null);
      sess.score.addRaw(Math.round(45 * ctx.mult)); // 冰晶粉碎額外分數
      emitClear(sess, cell, source);
      sess.fx?.burst(r, c, '#cdefff', 14);
      return true;
    }
    case 'rune': {
      ctx.hitGuard.add(cell.id);
      b.set(r, c, null);
      sess.score.addRaw(Math.round(50 * ctx.mult));
      emitClear(sess, cell, source);
      sess.fx?.burst(r, c, '#ff9a3c', 18);
      explode(sess, r, c, 1, ctx);
      return true;
    }
    case 'potion': {
      ctx.hitGuard.add(cell.id);
      b.set(r, c, null);
      const safe = (cell.timer ?? 0) > 0;
      if (safe) sess.score.addRaw(Math.round(120 * ctx.mult)); // 提前安全引爆獎勵
      emitClear(sess, cell, source);
      sess.fx?.burst(r, c, '#8fe06a', 16);
      explode(sess, r, c, 1, ctx);
      return true;
    }
    case 'core': {
      ctx.hitGuard.add(cell.id);
      b.set(r, c, null);
      triggerCore(sess, r, c, cell, ctx);
      return true;
    }
    case 'crystal': {
      ctx.hitGuard.add(cell.id);
      b.set(r, c, null);
      sess.addEnergy(ENERGY_CRYSTAL);
      sess.score.addRaw(Math.round(60 * ctx.mult));
      emitClear(sess, cell, source);
      sess.fx?.burst(r, c, '#b8f0c0', 14);
      sess.fx?.floatText(r, c, `+${ENERGY_CRYSTAL}⚡`, '#7fe0ff');
      return true;
    }
    case 'sand': {
      ctx.hitGuard.add(cell.id);
      b.set(r, c, null);
      if (cell.timer != null && cell.timer > 0) {
        sess.score.addRaw(Math.round(120 * ctx.mult)); // 荒蕪反向淨化
        sess.fx?.floatText(r, c, '淨化！', '#ffe97a');
      }
      emitClear(sess, cell, source);
      sess.fx?.burst(r, c, '#d9c07a', 8);
      return true;
    }
    case 'corrupt': {
      if (!CORRUPT_BREAKERS.has(source)) return false;
      ctx.hitGuard.add(cell.id);
      b.set(r, c, null);
      sess.score.addRaw(Math.round(80 * ctx.mult));
      sess.bus.emit('corruptCleared', { r, c });
      emitClear(sess, cell, source);
      sess.fx?.burst(r, c, '#8a5fc0', 14);
      return true;
    }
    case 'gold': {
      ctx.hitGuard.add(cell.id);
      b.set(r, c, null);
      sess.score.addRaw(Math.round(60 * ctx.mult));
      sess.addEnergy(3);
      sess.bus.emit('goldCollected', {});
      emitClear(sess, cell, source);
      sess.fx?.burst(r, c, '#ffd75e', 14);
      return true;
    }
    default: { // normal / ether / plant / lava / tree
      ctx.hitGuard.add(cell.id);
      b.set(r, c, null);
      if (cell.el) sess.score.addRaw(Math.round((ELEMENTS[cell.el]?.baseScore ?? 10) * ctx.mult));
      emitClear(sess, cell, source);
      sess.fx?.burst(r, c, cell.el ? ELEMENTS[cell.el].color : '#b0a8d0', 8);
      return true;
    }
  }
}

function emitClear(sess, cell, source) {
  sess.bus.emit('cellCleared', { el: cell.el, kind: cell.kind, source });
}

export function explode(sess, r, c, radius, ctx) {
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      hitCell(sess, r + dr, c + dc, ctx, 'explosion');
    }
  }
  sess.fx?.ring(r, c, '#ff9a3c', radius);
}

// ── 元素核心觸發 ──
export function triggerCore(sess, r, c, cell, ctx) {
  const b = sess.board;
  const strong = !!cell.strong;
  const el = cell.coreEl;
  switch (el) {
    case 'fire':
      explode(sess, r, c, strong ? 2 : 1, ctx);
      break;
    case 'water':
      for (let rr = 0; rr < b.rows; rr++) hitCell(sess, rr, c, ctx, 'core');
      if (strong) for (let cc = 0; cc < b.cols; cc++) hitCell(sess, r, cc, ctx, 'core');
      break;
    case 'earth':
      for (let cc = 0; cc < b.cols; cc++) hitCell(sess, r, cc, ctx, 'core');
      if (strong) for (let rr = 0; rr < b.rows; rr++) hitCell(sess, rr, c, ctx, 'core');
      break;
    case 'air': {
      const occupied = [];
      b.forEach((rr, cc) => occupied.push([rr, cc]));
      const targets = shuffle(sess.rng, occupied).slice(0, strong ? 10 : 6);
      for (const [rr, cc] of targets) hitCell(sess, rr, cc, ctx, 'core');
      break;
    }
    case 'light': {
      const targets = [];
      b.forEach((rr, cc, cel) => {
        if (cel.kind === 'corrupt' || cel.el === 'shadow') targets.push([rr, cc]);
      });
      for (const [rr, cc] of targets) hitCell(sess, rr, cc, ctx, 'holy');
      break;
    }
    case 'shadow': {
      const present = new Set();
      b.forEach((rr, cc, cel) => { if (cel.kind === 'normal' && cel.el) present.add(cel.el); });
      const pool = shuffle(sess.rng, [...present]);
      const eaten = pool.slice(0, strong ? 2 : 1);
      const targets = [];
      b.forEach((rr, cc, cel) => {
        if (cel.kind === 'normal' && eaten.includes(cel.el)) targets.push([rr, cc]);
      });
      for (const [rr, cc] of targets) hitCell(sess, rr, cc, ctx, 'core');
      break;
    }
  }
  sess.score.addRaw(Math.round(150 * ctx.mult));
  sess.bus.emit('coreTriggered', { el, strong });
  sess.fx?.ring(r, c, ELEMENTS[el]?.color ?? '#fff', 2);
}

// ── 效果小工具 ──
function consume(sess, cells, ctx, source = 'reaction') {
  for (const { r, c } of cells) hitCell(sess, r, c, ctx, source);
}
function centerOf(cells) {
  return cells[0];
}
const MOVABLE = new Set(['normal', 'gold', 'ether', 'icecrystal']);

// ═══ 反應效果表（key = reactions.js 的 effect 欄位）═══
export const EFFECTS = {
  // 火＋水：蒸氣 — 清除反應格＋各自正上方最多 2 格（岩石阻擋）
  steam(sess, cells, def, ctx) {
    const b = sess.board;
    for (const { r, c } of cells) {
      let bonus = true;
      for (let k = 1; k <= 2; k++) {
        const cell = b.get(r - k, c);
        if (cell && (cell.kind === 'rock' || cell.kind === 'rock_hard')) break;
        if (cell) { hitCell(sess, r - k, c, ctx, 'reaction'); bonus = false; }
      }
      if (bonus) sess.score.addRaw(Math.round(30 * ctx.mult)); // 上方為空的額外分數
      sess.fx?.steamPlume(r, c);
    }
    consume(sess, cells, ctx);
  },

  // 水＋土：生長 — 反應格化為植物並各蔓延一次
  growth(sess, cells, def, ctx) {
    const b = sess.board;
    const planted = [];
    for (const { r, c } of cells) {
      const old = b.get(r, c);
      if (old) ctx.hitGuard.add(old.id);
      b.set(r, c, makeCell(null, 'plant'));
      planted.push([r, c]);
    }
    for (const [r, c] of planted) {
      const empties = DIRS.map(([dr, dc]) => [r + dr, c + dc])
        .filter(([rr, cc]) => b.isEmpty(rr, cc) && rr >= 0);
      if (empties.length) {
        const [rr, cc] = choice(sess.rng, empties);
        b.set(rr, cc, makeCell(null, 'plant'));
      }
    }
    sess.fx?.burst(cells[0].r, cells[0].c, '#69c56a', 16);
  },

  // 火＋風：火焰風暴 — 十字延伸 2 格，遇岩石停止
  firestorm(sess, cells, def, ctx) {
    const b = sess.board;
    const { r, c } = centerOf(cells);
    consume(sess, cells, ctx);
    for (const [dr, dc] of DIRS) {
      for (let k = 1; k <= 2; k++) {
        const rr = r + dr * k, cc = c + dc * k;
        const cell = b.get(rr, cc);
        if (cell && (cell.kind === 'rock' || cell.kind === 'rock_hard')) break;
        if (cell) hitCell(sess, rr, cc, ctx, 'firestorm');
      }
    }
    sess.fx?.cross(r, c, '#ff8b45', 2);
  },

  // 土＋風：沙暴 — 推動同橫行方塊一格；推不動則凝為沙塵
  sandstorm(sess, cells, def, ctx) {
    const b = sess.board;
    const rows = [...new Set(cells.map(p => p.r))];
    consume(sess, cells, ctx);
    let movedAny = false;
    for (const r of rows) {
      let left = 0, right = 0;
      for (let c = 0; c < b.cols; c++) {
        if (!b.get(r, c)) { if (c < b.cols / 2) left++; else right++; }
      }
      const dir = left === right ? (sess.rng() < 0.5 ? -1 : 1) : (left > right ? -1 : 1);
      const range = dir === -1
        ? Array.from({ length: b.cols }, (_, i) => i)
        : Array.from({ length: b.cols }, (_, i) => b.cols - 1 - i);
      for (const c of range) {
        const cell = b.get(r, c);
        if (cell && MOVABLE.has(cell.kind) && b.isEmpty(r, c + dir)) {
          b.set(r, c + dir, cell);
          b.set(r, c, null);
          movedAny = true;
        }
      }
    }
    if (!movedAny) {
      for (const { r, c } of cells) if (b.isEmpty(r, c)) b.set(r, c, makeCell(null, 'sand'));
    }
    sess.fx?.burst(cells[0].r, cells[0].c, '#d9c07a', 14);
  },

  // 光＋暗：虛空淨化 — 清除反應格所在整行與整列
  eclipse(sess, cells, def, ctx) {
    const b = sess.board;
    const rows = [...new Set(cells.map(p => p.r))];
    const colsSet = [...new Set(cells.map(p => p.c))];
    consume(sess, cells, ctx, 'eclipse');
    for (const r of rows) for (let c = 0; c < b.cols; c++) hitCell(sess, r, c, ctx, 'eclipse');
    for (const c of colsSet) for (let r = 0; r < b.rows; r++) hitCell(sess, r, c, ctx, 'eclipse');
    sess.fx?.eclipseWave(cells[0].r, cells[0].c);
  },

  // 火＋土：熔岩 — 反應格化為熔岩（每反應階段熔化下方一格，最多 3 次）
  lava(sess, cells, def, ctx) {
    const b = sess.board;
    for (const { r, c } of cells) {
      const old = b.get(r, c);
      if (old) ctx.hitGuard.add(old.id);
      b.set(r, c, makeCell(null, 'lava', { timer: 3 }));
    }
    sess.fx?.burst(cells[0].r, cells[0].c, '#e05620', 14);
  },

  // 水＋風：冰霜 — 周圍最多 4 個普通方塊化為冰晶
  frost(sess, cells, def, ctx) {
    const b = sess.board;
    const candidates = [];
    const seen = new Set();
    for (const { r, c } of cells) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        const key = rr + ',' + cc;
        if (seen.has(key)) continue;
        seen.add(key);
        const cell = b.get(rr, cc);
        if (cell && cell.kind === 'normal' && !cells.some(p => p.r === rr && p.c === cc)) {
          candidates.push([rr, cc]);
        }
      }
    }
    consume(sess, cells, ctx);
    for (const [rr, cc] of shuffle(sess.rng, candidates).slice(0, 4)) {
      const cell = b.get(rr, cc);
      if (cell) {
        ctx.hitGuard.add(cell.id);
        b.set(rr, cc, makeCell(cell.el, 'icecrystal'));
      }
    }
    sess.fx?.burst(cells[0].r, cells[0].c, '#a8e0ff', 14);
  },

  // 土＋光：生命晶石
  lifecrystal(sess, cells, def, ctx) {
    const b = sess.board;
    const [first, ...rest] = cells;
    consume(sess, rest, ctx);
    const old = b.get(first.r, first.c);
    if (old) ctx.hitGuard.add(old.id);
    b.set(first.r, first.c, makeCell(null, 'crystal'));
    sess.fx?.burst(first.r, first.c, '#b8f0c0', 14);
  },

  // 水＋光：聖泉 — 淨化附近（半徑 3）所有暗元素與腐蝕
  holyspring(sess, cells, def, ctx) {
    const b = sess.board;
    const { r, c } = centerOf(cells);
    consume(sess, cells, ctx);
    let purified = 0;
    for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
      const cell = b.get(r + dr, c + dc);
      if (cell && (cell.kind === 'corrupt' || (cell.el === 'shadow' && (cell.kind === 'normal' || cell.kind === 'gold')))) {
        if (hitCell(sess, r + dr, c + dc, ctx, 'holy')) purified++;
      }
    }
    if (purified === 0) {
      sess.addEnergy(15);
      sess.fx?.floatText(r, c, '+15⚡', '#7fe0ff');
    }
    sess.fx?.ring(r, c, '#fff2b0', 3);
  },

  // 風＋光：雷電 — 優先劈碎最高堆疊，最多 3 個
  lightning(sess, cells, def, ctx) {
    const b = sess.board;
    consume(sess, cells, ctx);
    const colTops = [];
    for (let c = 0; c < b.cols; c++) {
      const top = b.columnHeightTop(c);
      if (top < b.rows) colTops.push({ c, top });
    }
    colTops.sort((a, b2) => a.top - b2.top); // top 越小堆疊越高
    for (const { c, top } of colTops.slice(0, 3)) {
      hitCell(sess, top, c, ctx, 'lightning');
      sess.fx?.bolt(top, c);
    }
  },

  // 火＋暗：詛咒火焰 — 大範圍爆炸但殘留腐蝕
  cursedflame(sess, cells, def, ctx) {
    const b = sess.board;
    const { r, c } = centerOf(cells);
    consume(sess, cells, ctx);
    explode(sess, r, c, 2, ctx);
    const curses = 1 + (sess.rng() < 0.5 ? 1 : 0) + (sess.relicMods.extraCurse || 0);
    const spots = [];
    b.forEach((rr, cc, cell) => { if (cell.kind === 'normal') spots.push([rr, cc]); });
    for (const [rr, cc] of shuffle(sess.rng, spots).slice(0, curses)) {
      const old = b.get(rr, cc);
      if (old) ctx.hitGuard.add(old.id);
      b.set(rr, cc, makeCell(null, 'corrupt'));
    }
    sess.fx?.burst(r, c, '#b04ad0', 20);
  },

  // 土＋暗：腐蝕 — 附近最多 3 個普通元素轉為暗元素
  corruption(sess, cells, def, ctx) {
    const b = sess.board;
    const candidates = [];
    for (const { r, c } of cells) {
      for (const [dr, dc] of DIRS) {
        const cell = b.get(r + dr, c + dc);
        if (cell && cell.kind === 'normal' && cell.el && cell.el !== 'shadow') {
          candidates.push([r + dr, c + dc]);
        }
      }
    }
    consume(sess, cells, ctx);
    for (const [rr, cc] of shuffle(sess.rng, candidates).slice(0, 3)) {
      const cell = b.get(rr, cc);
      if (cell && cell.kind === 'normal') cell.el = 'shadow';
    }
    sess.fx?.burst(cells[0].r, cells[0].c, '#7a4fa0', 12);
  },

  // ═══ 三元素 ═══

  // 火＋水＋風：超熱蒸氣 — 清除中心上方 5 列寬的所有方塊
  superheat(sess, cells, def, ctx) {
    const b = sess.board;
    const { r, c } = centerOf(cells);
    consume(sess, cells, ctx);
    for (let cc = c - 2; cc <= c + 2; cc++) {
      for (let rr = 0; rr < r; rr++) hitCell(sess, rr, cc, ctx, 'reaction');
    }
    sess.fx?.steamPlume(r, c, true);
  },

  // 水＋土＋光：世界樹 — 種下樹芽，3 次落塊後大範圍清除
  worldtree(sess, cells, def, ctx) {
    const b = sess.board;
    const [first, ...rest] = cells;
    consume(sess, rest, ctx);
    const old = b.get(first.r, first.c);
    if (old) ctx.hitGuard.add(old.id);
    b.set(first.r, first.c, makeCell(null, 'tree', { timer: 3 }));
    sess.fx?.burst(first.r, first.c, '#8be29a', 18);
  },

  // 火＋土＋暗：火山災變 — 清除最下兩行並殘留岩石
  cataclysm(sess, cells, def, ctx) {
    const b = sess.board;
    consume(sess, cells, ctx);
    for (let r = b.rows - 2; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) hitCell(sess, r, c, ctx, 'explosion');
    }
    const cols = shuffle(sess.rng, Array.from({ length: b.cols }, (_, i) => i)).slice(0, 2);
    for (const c of cols) {
      if (b.isEmpty(b.rows - 1, c)) b.set(b.rows - 1, c, makeCell(null, 'rock', { hp: 1 }));
    }
    sess.fx?.burst(cells[0].r, cells[0].c, '#ff5030', 24);
  },

  // 水＋風＋光：極光風暴 — 清除中心附近最多元素的所有普通方塊
  aurora(sess, cells, def, ctx) {
    const b = sess.board;
    const { r, c } = centerOf(cells);
    consume(sess, cells, ctx);
    const counts = {};
    for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
      const cell = b.get(r + dr, c + dc);
      if (cell && (cell.kind === 'normal' || cell.kind === 'gold') && cell.el) {
        counts[cell.el] = (counts[cell.el] || 0) + 1;
      }
    }
    const entries = Object.entries(counts).sort((a, b2) => b2[1] - a[1]);
    if (entries.length) {
      const target = entries[0][0];
      const hits = [];
      b.forEach((rr, cc, cell) => {
        if ((cell.kind === 'normal' || cell.kind === 'gold') && cell.el === target) hits.push([rr, cc]);
      });
      for (const [rr, cc] of hits) hitCell(sess, rr, cc, ctx, 'aurora');
      sess.fx?.floatText(r, c, `極光：${ELEMENTS[target]?.name ?? target}`, '#a0ffe0');
    }
    sess.fx?.ring(r, c, '#a0ffe0', 3);
  },

  // 土＋風＋暗：荒蕪 — 4 格化為沙塵（限步數內淨化得高分，逾期成岩石）
  desolation(sess, cells, def, ctx) {
    const b = sess.board;
    consume(sess, cells, ctx);
    const spots = [];
    b.forEach((rr, cc, cell) => { if (cell.kind === 'normal') spots.push([rr, cc]); });
    for (const [rr, cc] of shuffle(sess.rng, spots).slice(0, 4)) {
      const old = b.get(rr, cc);
      if (old) ctx.hitGuard.add(old.id);
      b.set(rr, cc, makeCell(null, 'sand', { timer: 6 }));
    }
    sess.fx?.burst(cells[0].r, cells[0].c, '#9a8f70', 14);
  },
};

// ═══ 落塊回合計時（鎖定時呼叫，於反應解析之前）═══
export function tickLockTimers(sess) {
  const b = sess.board;
  const ctx = { chain: 1, mult: 1, hitGuard: new Set(), sess };

  // 不穩定藥劑倒數
  const potions = [];
  b.forEach((r, c, cell) => { if (cell.kind === 'potion') potions.push([r, c, cell]); });
  for (const [r, c, cell] of potions) {
    cell.timer -= 1;
    if (cell.timer <= 0) {
      b.set(r, c, null);
      sess.fx?.burst(r, c, '#8fe06a', 20);
      explode(sess, r, c, 1, ctx);
    }
  }

  // 世界樹生長
  const trees = [];
  b.forEach((r, c, cell) => { if (cell.kind === 'tree') trees.push([r, c, cell]); });
  for (const [r, c, cell] of trees) {
    cell.timer -= 1;
    sess.score.addRaw(80);
    sess.fx?.floatText(r, c, '+80', '#8be29a');
    if (cell.timer <= 0) {
      b.set(r, c, null);
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        hitCell(sess, r + dr, c + dc, ctx, 'explosion');
      }
      sess.score.addRaw(600);
      sess.fx?.ring(r, c, '#8be29a', 2);
      sess.bus.emit('worldtreeBloom', {});
    }
  }

  // 荒蕪沙塵逾期 → 岩石
  const sands = [];
  b.forEach((r, c, cell) => { if (cell.kind === 'sand' && cell.timer != null) sands.push([r, c, cell]); });
  for (const [r, c, cell] of sands) {
    cell.timer -= 1;
    if (cell.timer <= 0) b.set(r, c, makeCell(null, 'rock', { hp: 1 }));
  }

  // 腐蝕擴散（每 5 次落塊，至多 3 處）
  if (sess.lockCount > 0 && sess.lockCount % 5 === 0) {
    const corrupts = [];
    b.forEach((r, c, cell) => { if (cell.kind === 'corrupt') corrupts.push([r, c]); });
    if (corrupts.length) {
      if (sess.relicMods.cancelFirstCorruption && !sess.corruptionCancelled) {
        sess.corruptionCancelled = true;
        sess.fx?.bigText('光明鏡：腐蝕擴散已取消');
      } else {
        let spreads = 0;
        for (const [r, c] of shuffle(sess.rng, corrupts)) {
          if (spreads >= 3) break;
          const targets = DIRS.map(([dr, dc]) => [r + dr, c + dc])
            .filter(([rr, cc]) => { const cell = b.get(rr, cc); return cell && cell.kind === 'normal'; });
          if (targets.length) {
            const [rr, cc] = choice(sess.rng, targets);
            b.set(rr, cc, makeCell(null, 'corrupt'));
            sess.fx?.burst(rr, cc, '#5a3a80', 8);
            spreads++;
          }
        }
        if (spreads > 0) sess.bus.emit('corruptSpread', { count: spreads });
      }
    }
  }
}

// ═══ 熔岩熔化（每個反應 pass 開始時呼叫）；回傳是否有實際變化 ═══
export function tickLavaPhase(sess, ctx) {
  const b = sess.board;
  let acted = false;
  const lavas = [];
  b.forEach((r, c, cell) => { if (cell.kind === 'lava') lavas.push([r, c, cell]); });
  for (const [r, c, cell] of lavas) {
    const below = b.get(r + 1, c);
    if (below && below.kind !== 'rock_hard') {
      if (hitCell(sess, r + 1, c, ctx, 'lava')) acted = true;
    }
    cell.timer -= 1;
    if (cell.timer <= 0) {
      b.set(r, c, null);
      acted = true;
    }
  }
  return acted;
}
