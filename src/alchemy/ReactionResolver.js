// ═══ 反應解析器：優先序掃描 → 格子保留 → 執行 → 共鳴 → 消行 → 重力 ═══
// 一次 runPass = 一個連鎖階段；Game 反覆呼叫直到穩定或達 MAX_CHAIN
import { ALL_REACTIONS } from '../data/reactions.js';
import { makeCell } from '../board/Board.js';
import { hitCell, EFFECTS, tickLavaPhase } from './ReactionEffects.js';
import { chainMultiplier, LINE_SCORES, ENERGY_RESONANCE, ENERGY_CORE, ENERGY_LINE } from '../config.js';

const SORTED = [...ALL_REACTIONS].sort((a, b) => b.priority - a.priority);
const REACTIVE = new Set(['normal', 'gold']);

function isReagent(cell) {
  return cell && (REACTIVE.has(cell.kind) && cell.el || cell.kind === 'ether');
}

// 同一拼塊的元素彼此穩定：全部來自同一次鎖定 → 不反應、不共鳴。
// 效果生成的格子（無 lockId）視為新化合物，不受限。
function allSameLock(cells) {
  const first = cells[0]?.lockId;
  if (first == null) return false;
  return cells.every(c => c.lockId === first);
}

// cells 是否能組成 recipe（萬能元素至多 1 個）
function matchesRecipe(cells, recipe) {
  let ethers = 0;
  const els = [];
  for (const cell of cells) {
    if (!cell) return false;
    if (cell.kind === 'ether') { ethers++; }
    else if (REACTIVE.has(cell.kind) && cell.el) { els.push(cell.el); }
    else return false;
  }
  if (ethers > 1) return false;
  const remaining = [...recipe];
  for (const el of els) {
    const i = remaining.indexOf(el);
    if (i === -1) return false;
    remaining.splice(i, 1);
  }
  return remaining.length === ethers;
}

const key = (r, c) => r * 100 + c;

function scanPairs(board, def, reserved, queued) {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const a = board.get(r, c);
      if (!isReagent(a) || reserved.has(key(r, c))) continue;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const rr = r + dr, cc = c + dc;
        if (reserved.has(key(rr, cc))) continue;
        const b = board.get(rr, cc);
        if (!isReagent(b)) continue;
        if (allSameLock([a, b])) continue;
        if (matchesRecipe([a, b], def.elements)) {
          reserved.add(key(r, c)); reserved.add(key(rr, cc));
          queued.push({ def, cells: [{ r, c }, { r: rr, c: cc }] });
          break; // 這格已被保留，換下一格
        }
      }
    }
  }
}

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIR_PAIRS = [];
for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) DIR_PAIRS.push([DIRS[i], DIRS[j]]);

function scanTriples(board, def, reserved, queued) {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const center = board.get(r, c);
      if (!isReagent(center) || reserved.has(key(r, c))) continue;
      for (const [[d1r, d1c], [d2r, d2c]] of DIR_PAIRS) {
        const p1 = { r: r + d1r, c: c + d1c };
        const p2 = { r: r + d2r, c: c + d2c };
        if (reserved.has(key(p1.r, p1.c)) || reserved.has(key(p2.r, p2.c))) continue;
        const c1 = board.get(p1.r, p1.c);
        const c2 = board.get(p2.r, p2.c);
        if (!isReagent(c1) || !isReagent(c2)) continue;
        if (allSameLock([center, c1, c2])) continue;
        if (matchesRecipe([center, c1, c2], def.elements)) {
          reserved.add(key(r, c)); reserved.add(key(p1.r, p1.c)); reserved.add(key(p2.r, p2.c));
          queued.push({ def, cells: [{ r, c }, p1, p2] });
          break;
        }
      }
    }
  }
}

// 相同元素共鳴：BFS 找 4+ 相連群組
export function findResonanceGroups(board, reserved) {
  const visited = new Set();
  const groups = [];
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const k = key(r, c);
      if (visited.has(k) || reserved.has(k)) continue;
      const cell = board.get(r, c);
      if (!cell || !REACTIVE.has(cell.kind) || !cell.el) continue;
      const el = cell.el;
      const group = [];
      const groupCells = [];
      const stack = [[r, c, cell]];
      visited.add(k);
      while (stack.length) {
        const [cr, cc, ccell] = stack.pop();
        group.push({ r: cr, c: cc });
        groupCells.push(ccell);
        for (const [dr, dc] of DIRS) {
          const nr = cr + dr, nc = cc + dc;
          const nk = key(nr, nc);
          if (visited.has(nk) || reserved.has(nk)) continue;
          const ncell = board.get(nr, nc);
          if (ncell && REACTIVE.has(ncell.kind) && ncell.el === el) {
            visited.add(nk);
            stack.push([nr, nc, ncell]);
          }
        }
      }
      // 單一拼塊自體 4 連不共鳴（純元素拼塊落地不自爆）
      if (group.length >= 4 && !allSameLock(groupCells)) groups.push({ el, cells: group });
    }
  }
  return groups;
}

function relicScoreMult(sess, def) {
  const m = sess.relicMods.scoreMultByElement || {};
  let mult = 1;
  for (const el of def.elements) if (m[el]) mult *= m[el];
  return mult;
}

function relicEnergyBonus(sess, def) {
  const m = sess.relicMods.energyBonusByElement || {};
  let bonus = 0;
  for (const el of def.elements) if (m[el]) bonus += m[el];
  return bonus;
}

function bloomPlants(sess, ctx) {
  const b = sess.board;
  const visited = new Set();
  let acted = false;
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      const k = key(r, c);
      if (visited.has(k)) continue;
      const cell = b.get(r, c);
      if (!cell || cell.kind !== 'plant' || cell.fresh) continue; // 新生植物下個階段才成熟
      const group = [];
      const stack = [[r, c]];
      visited.add(k);
      while (stack.length) {
        const [cr, cc] = stack.pop();
        group.push([cr, cc]);
        for (const [dr, dc] of DIRS) {
          const nr = cr + dr, nc = cc + dc, nk = key(nr, nc);
          if (visited.has(nk)) continue;
          const ncell = b.get(nr, nc);
          if (ncell && ncell.kind === 'plant' && !ncell.fresh) { visited.add(nk); stack.push([nr, nc]); }
        }
      }
      if (group.length >= 3) {
        for (const [gr, gc] of group) hitCell(sess, gr, gc, ctx, 'bloom');
        const score = Math.round(60 * group.length * ctx.mult);
        sess.score.addRaw(score);
        sess.addEnergy(8);
        sess.fx?.floatText(group[0][0], group[0][1], `綻放！+${score}`, '#69c56a');
        sess.bus.emit('bloom', { size: group.length });
        acted = true;
      }
    }
  }
  return acted;
}

// ═══ 反應預覽：幽靈落點若鎖定，會觸發哪些反應／共鳴（供渲染高亮）═══
// ghostBlocks: [{ r, c, cell }]（彼此視為同一未來 lockId，不互相反應）
export function previewReactions(board, ghostBlocks) {
  const overlay = new Map();
  for (const b of ghostBlocks) overlay.set(key(b.r, b.c), b.cell);
  const get = (r, c) => board.inBounds(r, c) ? (overlay.get(key(r, c)) ?? board.get(r, c)) : null;
  const isGhost = (r, c) => overlay.has(key(r, c));
  const reserved = new Set();
  const out = [];

  // 候選中心：幽靈格與其鄰格
  const centers = new Map();
  for (const b of ghostBlocks) {
    centers.set(key(b.r, b.c), [b.r, b.c]);
    for (const [dr, dc] of DIRS) centers.set(key(b.r + dr, b.c + dc), [b.r + dr, b.c + dc]);
  }

  for (const def of SORTED) {
    if (def.elements.length === 3) {
      for (const [r, c] of centers.values()) {
        if (reserved.has(key(r, c))) continue;
        const center = get(r, c);
        if (!isReagent(center)) continue;
        for (const [[d1r, d1c], [d2r, d2c]] of DIR_PAIRS) {
          const p1 = [r + d1r, c + d1c], p2 = [r + d2r, c + d2c];
          if (reserved.has(key(...p1)) || reserved.has(key(...p2))) continue;
          const c1 = get(...p1), c2 = get(...p2);
          if (!isReagent(c1) || !isReagent(c2)) continue;
          const trio = [[r, c], p1, p2];
          const ghosts = trio.filter(([rr, cc]) => isGhost(rr, cc)).length;
          if (ghosts === 0 || ghosts === 3) continue; // 必須是拼塊×場上的組合
          if (!matchesRecipe([center, c1, c2], def.elements)) continue;
          trio.forEach(p => reserved.add(key(...p)));
          out.push({ cells: trio.map(([rr, cc]) => ({ r: rr, c: cc })), color: def.color });
          break;
        }
      }
    } else {
      for (const b of ghostBlocks) {
        if (reserved.has(key(b.r, b.c))) continue;
        if (!isReagent(b.cell)) continue;
        for (const [dr, dc] of DIRS) {
          const rr = b.r + dr, cc = b.c + dc;
          if (isGhost(rr, cc) || reserved.has(key(rr, cc))) continue;
          const other = get(rr, cc);
          if (!isReagent(other)) continue;
          if (!matchesRecipe([b.cell, other], def.elements)) continue;
          reserved.add(key(b.r, b.c)); reserved.add(key(rr, cc));
          out.push({ cells: [{ r: b.r, c: b.c }, { r: rr, c: cc }], color: def.color });
          break;
        }
      }
    }
  }

  // 共鳴預覽：合併視圖 flood fill ≥4 且含至少一個場上格
  const visited = new Set();
  for (const b of ghostBlocks) {
    const cell = b.cell;
    if (!cell || !REACTIVE.has(cell.kind) || !cell.el) continue;
    const k0 = key(b.r, b.c);
    if (visited.has(k0) || reserved.has(k0)) continue;
    const group = [];
    let hasBoard = false;
    const stack = [[b.r, b.c]];
    visited.add(k0);
    while (stack.length) {
      const [cr, cc] = stack.pop();
      group.push([cr, cc]);
      if (!isGhost(cr, cc)) hasBoard = true;
      for (const [dr, dc] of DIRS) {
        const nr = cr + dr, nc = cc + dc, nk = key(nr, nc);
        if (visited.has(nk) || reserved.has(nk)) continue;
        const ncell = get(nr, nc);
        if (ncell && REACTIVE.has(ncell.kind) && ncell.el === cell.el) {
          visited.add(nk);
          stack.push([nr, nc]);
        }
      }
    }
    if (group.length >= 4 && hasBoard) {
      out.push({ cells: group.map(([rr, cc]) => ({ r: rr, c: cc })), color: '#ffffff', resonance: true });
    }
  }
  return out;
}

// ═══ 執行一個連鎖階段；回傳 { acted, reactions } ═══
export function runPass(sess, chain) {
  const board = sess.board;
  const mult = chainMultiplier(chain);
  const ctx = { chain, mult, hitGuard: new Set(), sess };
  let acted = false;
  const firedReactions = [];

  // 0) 上一階段新生的植物成熟（本階段結尾即可參與綻放判定）
  board.forEach((r, c, cell) => { if (cell.kind === 'plant' && cell.fresh) cell.fresh = false; });

  // 1) 熔岩熔化
  if (tickLavaPhase(sess, ctx)) acted = true;

  // 2) 完整行快照（先反應、後移除殘存格）
  const fullRows = board.findFullRows();

  // 3) 依優先序掃描並保留格子
  const reserved = new Set();
  const queued = [];
  for (const def of SORTED) {
    if (!sess.canReact) break;
    if (def.elements.length === 3) scanTriples(board, def, reserved, queued);
    else scanPairs(board, def, reserved, queued);
  }

  // 4) 共鳴群組（不使用已保留格）
  const groups = sess.canReact ? findResonanceGroups(board, reserved) : [];

  // 5) 執行反應（若試劑已被先前效果波及消耗則作廢）
  for (const q of queued) {
    if (q.cells.some(({ r, c }) => !isReagent(board.get(r, c)))) continue;
    EFFECTS[q.def.effect](sess, q.cells, q.def, ctx);
    let score = Math.round(q.def.score * mult * relicScoreMult(sess, q.def));
    let energy = q.def.energy + relicEnergyBonus(sess, q.def);
    let twin = false;
    if (q.def.elements.length === 2 && sess.rng() < (sess.relicMods.twinChance || 0)) {
      score *= 2; energy *= 2; twin = true;
    }
    sess.score.addRaw(score);
    sess.addEnergy(energy);
    firedReactions.push(q.def);
    sess.bus.emit('reaction', { def: q.def, cells: q.cells, chain, score, twin });
    sess.fx?.reactionFx(q.def, q.cells, score, twin);
    acted = true;
  }

  // 6) 共鳴執行
  for (const g of groups) {
    for (const { r, c } of g.cells) hitCell(sess, r, c, ctx, 'resonance');
    const bonus = Math.round(35 * g.cells.length * mult);
    sess.score.addRaw(bonus);
    sess.addEnergy(ENERGY_RESONANCE);
    if (g.cells.length >= 5) {
      const spot = g.cells[Math.floor(g.cells.length / 2)];
      if (!board.get(spot.r, spot.c)) {
        board.set(spot.r, spot.c, makeCell(null, 'core', { coreEl: g.el, strong: g.cells.length >= 7 }));
        sess.addEnergy(ENERGY_CORE);
        sess.bus.emit('coreCreated', { el: g.el, strong: g.cells.length >= 7 });
      }
    }
    sess.bus.emit('resonance', { el: g.el, size: g.cells.length, chain });
    sess.fx?.resonanceFx(g, bonus);
    acted = true;
  }

  // 7) 植物綻放
  if (bloomPlants(sess, ctx)) acted = true;

  // 8) 完整行消除（移除行內殘存格；岩石等不可消格會留下）
  if (fullRows.length) {
    // 消除前快照，供溶解動畫使用（只溶解真的被移除的格）
    const snapshot = [];
    for (const r of fullRows) {
      for (let c = 0; c < board.cols; c++) {
        const cell = board.get(r, c);
        if (cell) snapshot.push({ r, c, cell });
      }
    }
    for (const r of fullRows) {
      for (let c = 0; c < board.cols; c++) hitCell(sess, r, c, ctx, 'line');
    }
    const removed = snapshot.filter(({ r, c, cell }) => board.get(r, c) !== cell);
    const lineScore = Math.round((LINE_SCORES[Math.min(fullRows.length, 4)] +
      Math.max(0, fullRows.length - 4) * 400) * mult);
    sess.score.addRaw(lineScore);
    sess.addEnergy(ENERGY_LINE * fullRows.length);
    sess.bus.emit('lines', { count: fullRows.length, rows: fullRows, chain, score: lineScore });
    sess.fx?.lineFx(fullRows, lineScore, removed);
    acted = true;
  }

  // 9) 重力
  board.applyGravity();

  return { acted, reactions: firedReactions };
}
