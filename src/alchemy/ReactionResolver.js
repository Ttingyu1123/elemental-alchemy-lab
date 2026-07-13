// ═══ 反應解析器：優先序掃描 → 格子保留 → 執行 → 共鳴 → 消行 → 重力 ═══
// 一次 runPass = 一個連鎖階段；Game 反覆呼叫直到穩定或達 MAX_CHAIN
import { ALL_REACTIONS } from '../data/reactions.js';
import { makeCell } from '../board/Board.js';
import { hitCell, EFFECTS, tickLavaPhase } from './ReactionEffects.js';
import { chainMultiplier, LINE_SCORES, ENERGY_RESONANCE, ENERGY_CORE } from '../config.js';

const SORTED = [...ALL_REACTIONS].sort((a, b) => b.priority - a.priority);
const REACTIVE = new Set(['normal', 'gold']);

function isReagent(cell) {
  return cell && (REACTIVE.has(cell.kind) && cell.el || cell.kind === 'ether');
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
      const stack = [[r, c]];
      visited.add(k);
      while (stack.length) {
        const [cr, cc] = stack.pop();
        group.push({ r: cr, c: cc });
        for (const [dr, dc] of DIRS) {
          const nr = cr + dr, nc = cc + dc;
          const nk = key(nr, nc);
          if (visited.has(nk) || reserved.has(nk)) continue;
          const ncell = board.get(nr, nc);
          if (ncell && REACTIVE.has(ncell.kind) && ncell.el === el) {
            visited.add(nk);
            stack.push([nr, nc]);
          }
        }
      }
      if (group.length >= 4) groups.push({ el, cells: group });
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
      if (!cell || cell.kind !== 'plant') continue;
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
          if (ncell && ncell.kind === 'plant') { visited.add(nk); stack.push([nr, nc]); }
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

// ═══ 執行一個連鎖階段；回傳 { acted, reactions } ═══
export function runPass(sess, chain) {
  const board = sess.board;
  const mult = chainMultiplier(chain);
  const ctx = { chain, mult, hitGuard: new Set(), sess };
  let acted = false;
  const firedReactions = [];

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
    for (const r of fullRows) {
      for (let c = 0; c < board.cols; c++) hitCell(sess, r, c, ctx, 'line');
    }
    const lineScore = Math.round((LINE_SCORES[Math.min(fullRows.length, 4)] +
      Math.max(0, fullRows.length - 4) * 400) * mult);
    sess.score.addRaw(lineScore);
    sess.bus.emit('lines', { count: fullRows.length, rows: fullRows, chain, score: lineScore });
    sess.fx?.lineFx(fullRows, lineScore);
    acted = true;
  }

  // 9) 重力
  board.applyGravity();

  return { acted, reactions: firedReactions };
}
