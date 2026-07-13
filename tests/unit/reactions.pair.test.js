// ═══ 12 種雙元素反應逐一驗證 ═══
import { describe, it, expect } from 'vitest';
import { makeSession, put, capture, resolveAll, countKind, countEl } from './helpers.js';
import { runPass } from '../../src/alchemy/ReactionResolver.js';

describe('雙元素反應', () => {
  it('火＋水 → 蒸氣：清反應格＋各自上方最多 2 格', () => {
    const s = makeSession();
    put(s, 23, 4, 'fire');
    put(s, 23, 5, 'water');
    put(s, 22, 4, null, 'sand'); // 上方雜物
    const log = capture(s, ['reaction']);
    runPass(s, 1);
    expect(log.reaction.map(e => e.def.id)).toContain('steam');
    expect(s.board.get(23, 4)).toBeNull();
    expect(s.board.get(23, 5)).toBeNull();
    expect(countKind(s, 'sand')).toBe(0); // 蒸氣上衝清除
  });

  it('蒸氣不穿透岩石', () => {
    const s = makeSession();
    put(s, 23, 4, 'fire');
    put(s, 23, 5, 'water');
    put(s, 22, 4, null, 'rock', { hp: 1 });
    put(s, 21, 4, null, 'sand'); // 岩石上方，應被擋住
    runPass(s, 1);
    expect(countKind(s, 'sand')).toBe(1);
  });

  it('水＋土 → 生長：植物生成、下一階段成熟、3+ 相連綻放', () => {
    const s = makeSession();
    put(s, 23, 4, 'water');
    put(s, 23, 5, 'earth');
    const log = capture(s, ['reaction', 'bloom']);
    const p1 = runPass(s, 1);
    expect(p1.acted).toBe(true);
    expect(countKind(s, 'plant')).toBeGreaterThanOrEqual(2); // 本階段還不綻放
    resolveAll(s);
    expect(log.reaction.map(e => e.def.id)).toContain('growth');
    expect(log.bloom.length).toBeGreaterThanOrEqual(1); // 成熟後整群綻放
    expect(countKind(s, 'plant')).toBe(0);
  });

  it('火＋風 → 火焰風暴：十字延伸 2 格、遇岩石停止', () => {
    const s = makeSession();
    put(s, 23, 4, 'fire');
    put(s, 23, 5, 'air');
    put(s, 23, 2, null, 'rock', { hp: 1 }); // 左 2 格：岩石擋路
    put(s, 23, 6, null, 'sand');            // 右 2 格（穿過已消耗的試劑格）
    runPass(s, 1);
    expect(countKind(s, 'rock')).toBe(1);   // 火焰不破岩
    expect(countKind(s, 'sand')).toBe(0);
  });

  it('土＋風 → 沙暴：推動同行方塊一格', () => {
    const s = makeSession();
    put(s, 23, 4, 'earth');
    put(s, 23, 5, 'air');
    put(s, 23, 0, 'water');
    runPass(s, 1);
    expect(s.board.get(23, 0)).toBeNull();
    expect(s.board.get(23, 1)?.el).toBe('water'); // 右側空位較多 → 向右推
  });

  it('光＋暗 → 虛空淨化：清整行＋整列', () => {
    const s = makeSession();
    put(s, 20, 4, 'light');
    put(s, 20, 5, 'shadow');
    put(s, 20, 0, null, 'sand'); // 同行
    put(s, 16, 4, null, 'sand'); // 同列
    put(s, 23, 9, null, 'sand'); // 不相干
    const log = capture(s, ['reaction']);
    runPass(s, 1);
    expect(log.reaction.map(e => e.def.id)).toContain('eclipse');
    expect(countKind(s, 'sand')).toBe(1); // 只剩不相干那顆
  });

  it('火＋土 → 熔岩：生成熔岩並在後續階段熔化下方', () => {
    const s = makeSession();
    put(s, 22, 4, 'fire');
    put(s, 22, 5, 'earth');
    put(s, 23, 4, null, 'sand');
    put(s, 23, 5, null, 'sand');
    resolveAll(s);
    expect(countKind(s, 'sand')).toBe(0);           // 被熔化
    expect(countKind(s, 'lava')).toBeGreaterThan(0); // 熔岩還有殘餘次數
  });

  it('水＋風 → 冰霜：周圍最多 4 格化為冰晶', () => {
    const s = makeSession();
    put(s, 23, 4, 'water');
    put(s, 23, 5, 'air');
    // 用暗元素當鄰居（不與水/風成對反應）
    put(s, 22, 4, 'shadow');
    put(s, 22, 5, 'shadow');
    put(s, 23, 3, 'shadow');
    put(s, 23, 6, 'shadow');
    runPass(s, 1);
    expect(countKind(s, 'icecrystal')).toBe(4);
  });

  it('土＋光 → 生命晶石；晶石被消除時回能量', () => {
    const s = makeSession();
    put(s, 23, 4, 'earth');
    put(s, 23, 5, 'light');
    runPass(s, 1);
    expect(countKind(s, 'crystal')).toBe(1);
    // 晶石被命中 → 能量
    const before = s.energy;
    const { hitCell } = requireEffects();
    hitCell(s, 23, 4, { chain: 1, mult: 1, hitGuard: new Set(), sess: s }, 'explosion');
    expect(s.energy).toBeGreaterThan(before);
  });

  it('水＋光 → 聖泉：淨化半徑 3 內暗元素與腐蝕', () => {
    const s = makeSession();
    put(s, 23, 4, 'water');
    put(s, 23, 5, 'light');
    put(s, 21, 6, 'shadow');
    put(s, 22, 2, null, 'corrupt');
    const log = capture(s, ['corruptCleared']);
    runPass(s, 1);
    expect(countEl(s, 'shadow')).toBe(0);
    expect(countKind(s, 'corrupt')).toBe(0);
    expect(log.corruptCleared.length).toBe(1);
  });

  it('風＋光 → 雷電：劈碎最高堆疊至多 3 格', () => {
    const s = makeSession();
    put(s, 23, 4, 'air');
    put(s, 23, 5, 'light');
    for (let r = 20; r <= 23; r++) put(s, r, 0, null, 'sand'); // 最高塔 col0
    put(s, 22, 7, null, 'sand'); put(s, 23, 7, null, 'sand');
    put(s, 23, 9, null, 'sand');
    runPass(s, 1);
    // 三座塔頂各被劈一次
    expect(countKind(s, 'sand')).toBe(4 + 2 + 1 - 3);
  });

  it('火＋暗 → 詛咒火焰：大範圍清除但殘留 1-2 腐蝕', () => {
    const s = makeSession();
    put(s, 20, 4, 'fire');
    put(s, 20, 5, 'shadow');
    put(s, 23, 0, 'water');
    put(s, 23, 9, 'water');
    put(s, 23, 2, 'water');
    runPass(s, 1);
    const corrupts = countKind(s, 'corrupt');
    expect(corrupts).toBeGreaterThanOrEqual(1);
    expect(corrupts).toBeLessThanOrEqual(2);
  });

  it('土＋暗 → 腐蝕：附近普通元素轉為暗元素', () => {
    const s = makeSession();
    put(s, 23, 4, 'earth');
    put(s, 23, 5, 'shadow');
    put(s, 22, 5, 'water'); // 只鄰接暗（避免與土成對反應）
    put(s, 23, 6, 'water');
    runPass(s, 1);
    expect(countEl(s, 'shadow')).toBe(2); // 兩顆水被轉化
    expect(countEl(s, 'water')).toBe(0);
  });
});

// 延後載入避免循環（Vitest ESM 下直接 import 亦可）
import * as Effects from '../../src/alchemy/ReactionEffects.js';
function requireEffects() { return Effects; }
