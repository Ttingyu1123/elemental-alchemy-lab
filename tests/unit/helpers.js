// ═══ 單元測試共用：最小 session mock ＋棋盤佈置工具 ═══
import { Board, makeCell } from '../../src/board/Board.js';
import { EventBus } from '../../src/core/EventBus.js';
import { makeRng } from '../../src/core/Random.js';
import { ScoreSystem } from '../../src/systems/ScoreSystem.js';
import { aggregateRelicMods } from '../../src/systems/RelicSystem.js';
import { runPass } from '../../src/alchemy/ReactionResolver.js';

export function makeSession(seed = 42, relics = []) {
  return {
    board: new Board(),
    rng: makeRng(seed),
    bus: new EventBus(),
    score: new ScoreSystem(),
    energy: 0,
    addEnergy(n) { this.energy = Math.min(100, this.energy + n); },
    relicMods: aggregateRelicMods(relics),
    fx: null,
    canReact: true,
    lockCount: 0,
    corruptionCancelled: false,
  };
}

let lockCounter = 1000;
// 預設每格獨立 lockId（可自由反應）；同拼塊測試時傳入相同 lockId
export function put(sess, r, c, el, kind = 'normal', extra = {}) {
  const cell = makeCell(el, kind, extra);
  if (extra.lockId === undefined) cell.lockId = ++lockCounter;
  sess.board.set(r, c, cell);
  return cell;
}

export function ctx(sess, chain = 1) {
  return { chain, mult: 1, hitGuard: new Set(), sess };
}

// 收集事件
export function capture(sess, events) {
  const log = {};
  for (const ev of events) {
    log[ev] = [];
    sess.bus.on(ev, (p) => log[ev].push(p));
  }
  return log;
}

// 反覆 runPass 直到穩定；回傳實際執行的 pass 數
export function resolveAll(sess, maxPasses = 30) {
  let passes = 0;
  while (passes < maxPasses) {
    const { acted } = runPass(sess, passes + 1);
    if (!acted) break;
    passes++;
  }
  return passes;
}

export function countKind(sess, kind) {
  return sess.board.count(c => c.kind === kind);
}
export function countEl(sess, el) {
  return sess.board.count(c => c.el === el && (c.kind === 'normal' || c.kind === 'gold'));
}
