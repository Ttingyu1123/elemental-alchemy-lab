// ═══ 5 種三元素反應＋優先序驗證 ═══
import { describe, it, expect } from 'vitest';
import { makeSession, put, capture, resolveAll, countKind, countEl } from './helpers.js';
import { runPass } from '../../src/alchemy/ReactionResolver.js';
import { tickLockTimers, hitCell } from '../../src/alchemy/ReactionEffects.js';

describe('三元素反應', () => {
  it('火＋水＋風 → 超熱蒸氣：清除中心上方 5 列寬區域', () => {
    const s = makeSession();
    put(s, 23, 4, 'fire');   // 中心
    put(s, 22, 4, 'water');
    put(s, 23, 5, 'air');
    put(s, 20, 3, null, 'sand');
    put(s, 18, 6, null, 'sand');
    put(s, 20, 8, null, 'sand'); // 範圍外
    const log = capture(s, ['reaction']);
    runPass(s, 1);
    expect(log.reaction.map(e => e.def.id)).toContain('superheat');
    expect(countKind(s, 'sand')).toBe(1);
  });

  it('水＋土＋光 → 世界樹：三次落塊後 5×5 清除；且優先於聖泉/生命晶石', () => {
    const s = makeSession();
    put(s, 23, 4, 'water');  // 中心
    put(s, 22, 4, 'earth');
    put(s, 23, 5, 'light');
    put(s, 21, 3, null, 'sand'); // 樹爆範圍內
    const log = capture(s, ['reaction', 'worldtreeBloom']);
    runPass(s, 1);
    const ids = log.reaction.map(e => e.def.id);
    expect(ids).toContain('worldtree');
    expect(ids).not.toContain('holyspring'); // 三元素優先保留格子
    expect(countKind(s, 'tree')).toBe(1);
    tickLockTimers(s); tickLockTimers(s); tickLockTimers(s);
    expect(countKind(s, 'tree')).toBe(0);
    expect(log.worldtreeBloom.length).toBe(1);
    expect(countKind(s, 'sand')).toBe(0);
  });

  it('火＋土＋暗 → 火山災變：清最下兩行、殘留岩石', () => {
    const s = makeSession();
    put(s, 23, 4, 'fire');
    put(s, 22, 4, 'earth');
    put(s, 23, 5, 'shadow');
    put(s, 23, 0, null, 'sand');
    put(s, 22, 9, null, 'sand');
    runPass(s, 1);
    expect(countKind(s, 'sand')).toBe(0);
    expect(countKind(s, 'rock')).toBe(2);
  });

  it('水＋風＋光 → 極光風暴：清除中心附近最多元素的所有普通方塊', () => {
    const s = makeSession();
    put(s, 23, 4, 'water');
    put(s, 22, 4, 'air');
    put(s, 23, 5, 'light');
    put(s, 21, 2, 'fire');
    put(s, 22, 6, 'fire');
    put(s, 20, 4, 'fire');
    put(s, 22, 2, 'earth');
    put(s, 15, 0, 'fire'); // 遠處火：也應被全域清除
    runPass(s, 1);
    expect(countEl(s, 'fire')).toBe(0);
    expect(countEl(s, 'earth')).toBe(1);
  });

  it('土＋風＋暗 → 荒蕪：4 格化為帶倒數的沙塵', () => {
    const s = makeSession();
    put(s, 23, 4, 'earth');
    put(s, 22, 4, 'air');
    put(s, 23, 5, 'shadow');
    put(s, 23, 0, 'water'); put(s, 23, 9, 'water');
    put(s, 20, 2, 'water'); put(s, 18, 7, 'water'); put(s, 15, 5, 'water');
    runPass(s, 1);
    expect(s.board.count(c => c.kind === 'sand' && c.timer > 0)).toBe(4);
    expect(countEl(s, 'water')).toBe(1);
  });

  it('荒蕪沙塵逾期成岩石；提前清除得淨化分', () => {
    const s = makeSession();
    put(s, 23, 0, null, 'sand', { timer: 1 });
    tickLockTimers(s);
    expect(s.board.get(23, 0)?.kind).toBe('rock');
    // 另一顆提前打掉 → 淨化分數
    put(s, 23, 5, null, 'sand', { timer: 3 });
    const before = s.score.score;
    hitCell(s, 23, 5, { chain: 1, mult: 1, hitGuard: new Set(), sess: s }, 'explosion');
    expect(s.score.score).toBeGreaterThan(before);
    expect(s.board.get(23, 5)).toBeNull();
  });
});
