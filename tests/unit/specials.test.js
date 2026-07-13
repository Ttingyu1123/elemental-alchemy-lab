// ═══ 特殊方塊 hit 語意＋六種元素核心 ═══
import { describe, it, expect } from 'vitest';
import { makeSession, put, ctx, countKind, countEl } from './helpers.js';
import { hitCell, tickLockTimers } from '../../src/alchemy/ReactionEffects.js';

describe('特殊方塊', () => {
  it('鎖鏈：需兩次命中；同一階段只吃一次', () => {
    const s = makeSession();
    put(s, 23, 0, null, 'chain', { hp: 2 });
    const c1 = ctx(s);
    hitCell(s, 23, 0, c1, 'reaction');
    hitCell(s, 23, 0, c1, 'reaction'); // 同 ctx：被 hitGuard 擋下
    expect(s.board.get(23, 0)?.hp).toBe(1);
    hitCell(s, 23, 0, ctx(s), 'reaction'); // 新階段：第二擊
    expect(s.board.get(23, 0)).toBeNull();
  });

  it('冰封：第一次破冰露出元素，第二次移除', () => {
    const s = makeSession();
    put(s, 23, 0, 'water', 'ice', { hp: 2 });
    hitCell(s, 23, 0, ctx(s), 'reaction');
    expect(s.board.get(23, 0)?.kind).toBe('normal');
    expect(s.board.get(23, 0)?.el).toBe('water');
    hitCell(s, 23, 0, ctx(s), 'reaction');
    expect(s.board.get(23, 0)).toBeNull();
  });

  it('炸裂符文：命中時 3×3 爆炸', () => {
    const s = makeSession();
    put(s, 22, 4, null, 'rune');
    put(s, 22, 5, null, 'sand');
    put(s, 23, 3, null, 'sand');
    hitCell(s, 22, 4, ctx(s), 'reaction');
    expect(countKind(s, 'sand')).toBe(0);
    expect(countKind(s, 'rune')).toBe(0);
  });

  it('不穩定藥劑：倒數歸零自動爆炸；提前引爆有獎勵分', () => {
    const s = makeSession();
    put(s, 23, 4, null, 'potion', { timer: 1 });
    put(s, 23, 5, null, 'sand');
    tickLockTimers(s); // timer 1→0 → 爆炸
    expect(countKind(s, 'potion')).toBe(0);
    expect(countKind(s, 'sand')).toBe(0);
    // 提前引爆
    put(s, 20, 4, null, 'potion', { timer: 5 });
    const before = s.score.score;
    hitCell(s, 20, 4, ctx(s), 'reaction');
    expect(s.score.score).toBeGreaterThan(before);
  });

  it('金色元素：清除時給能量', () => {
    const s = makeSession();
    put(s, 23, 0, 'fire', 'gold');
    hitCell(s, 23, 0, ctx(s), 'reaction');
    expect(s.energy).toBeGreaterThanOrEqual(3);
  });

  it('腐蝕：普通反應打不掉，聖光可以', () => {
    const s = makeSession();
    put(s, 23, 0, null, 'corrupt');
    expect(hitCell(s, 23, 0, ctx(s), 'reaction')).toBe(false);
    expect(countKind(s, 'corrupt')).toBe(1);
    expect(hitCell(s, 23, 0, ctx(s), 'holy')).toBe(true);
    expect(countKind(s, 'corrupt')).toBe(0);
  });

  it('腐蝕擴散：每 5 次落塊向鄰近普通格擴散（上限 3）', () => {
    const s = makeSession();
    put(s, 23, 0, null, 'corrupt');
    put(s, 23, 1, 'water');
    s.lockCount = 5;
    tickLockTimers(s);
    expect(countKind(s, 'corrupt')).toBe(2);
  });

  it('岩石：一般來源打不動，爆炸可摧毀；硬岩免疫爆炸', () => {
    const s = makeSession();
    put(s, 23, 0, null, 'rock', { hp: 1 });
    put(s, 23, 9, null, 'rock_hard');
    expect(hitCell(s, 23, 0, ctx(s), 'reaction')).toBe(false);
    expect(hitCell(s, 23, 0, ctx(s), 'explosion')).toBe(true);
    expect(hitCell(s, 23, 9, ctx(s), 'explosion')).toBe(false);
    expect(countKind(s, 'rock_hard')).toBe(1);
  });

  it('大地護符遺物：岩石可被任何反應摧毀', () => {
    const s = makeSession(42, ['earth_amulet']);
    put(s, 23, 0, null, 'rock', { hp: 1 });
    expect(hitCell(s, 23, 0, ctx(s), 'reaction')).toBe(true);
  });
});

describe('元素核心', () => {
  function core(s, r, c, el, strong = false) {
    return put(s, r, c, null, 'core', { coreEl: el, strong });
  }

  it('火焰核心：3×3 爆炸', () => {
    const s = makeSession();
    core(s, 22, 4, 'fire');
    put(s, 22, 5, null, 'sand');
    put(s, 21, 3, null, 'sand');
    put(s, 19, 4, null, 'sand'); // 範圍外
    hitCell(s, 22, 4, ctx(s), 'line');
    expect(countKind(s, 'sand')).toBe(1);
  });

  it('水流核心：清除同一直列', () => {
    const s = makeSession();
    core(s, 23, 4, 'water');
    put(s, 20, 4, null, 'sand');
    put(s, 10, 4, null, 'sand');
    put(s, 20, 5, null, 'sand'); // 別的直列
    hitCell(s, 23, 4, ctx(s), 'line');
    expect(countKind(s, 'sand')).toBe(1);
  });

  it('大地核心：清除同一橫行', () => {
    const s = makeSession();
    core(s, 23, 4, 'earth');
    put(s, 23, 0, null, 'sand');
    put(s, 23, 9, null, 'sand');
    put(s, 22, 4, null, 'sand'); // 別的橫行
    hitCell(s, 23, 4, ctx(s), 'line');
    expect(countKind(s, 'sand')).toBe(1);
  });

  it('風暴核心：隨機清除 6 格', () => {
    const s = makeSession();
    core(s, 23, 4, 'air');
    for (let c = 0; c < 8; c++) put(s, 22, c, null, 'sand');
    hitCell(s, 23, 4, ctx(s), 'line');
    expect(countKind(s, 'sand')).toBe(2); // 8 - 6
  });

  it('光明核心：清除所有暗元素與腐蝕', () => {
    const s = makeSession();
    core(s, 23, 4, 'light');
    put(s, 20, 1, 'shadow');
    put(s, 18, 8, null, 'corrupt');
    put(s, 20, 3, 'fire');
    hitCell(s, 23, 4, ctx(s), 'line');
    expect(countEl(s, 'shadow')).toBe(0);
    expect(countKind(s, 'corrupt')).toBe(0);
    expect(countEl(s, 'fire')).toBe(1);
  });

  it('暗影核心：吞噬一種隨機元素的所有普通方塊', () => {
    const s = makeSession();
    core(s, 23, 4, 'shadow');
    put(s, 20, 0, 'water'); put(s, 20, 2, 'water'); put(s, 20, 4, 'water');
    put(s, 18, 0, 'fire'); put(s, 18, 2, 'fire');
    hitCell(s, 23, 4, ctx(s), 'line');
    const waters = countEl(s, 'water'), fires = countEl(s, 'fire');
    // 恰好一種元素被吃光
    expect((waters === 0 && fires === 2) || (waters === 3 && fires === 0)).toBe(true);
  });
});
