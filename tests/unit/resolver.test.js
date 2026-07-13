// ═══ 共鳴／消行／穩定化規則／連鎖／預覽 ═══
import { describe, it, expect } from 'vitest';
import { makeSession, put, capture, resolveAll, countKind, countEl } from './helpers.js';
import { runPass, previewReactions, findResonanceGroups } from '../../src/alchemy/ReactionResolver.js';
import { makeCell } from '../../src/board/Board.js';

describe('相同元素共鳴', () => {
  it('4 個相連 → 清除群組，不生成核心', () => {
    const s = makeSession();
    for (let c = 0; c < 4; c++) put(s, 23, c, 'fire');
    const log = capture(s, ['resonance', 'coreCreated']);
    runPass(s, 1);
    expect(log.resonance[0]?.size).toBe(4);
    expect(log.coreCreated.length).toBe(0);
    expect(countEl(s, 'fire')).toBe(0);
  });

  it('5-6 個 → 生成元素核心；7+ → 強化核心', () => {
    const s = makeSession();
    for (let c = 0; c < 5; c++) put(s, 23, c, 'water');
    runPass(s, 1);
    const core5 = s.board.count(c => c.kind === 'core' && !c.strong);
    expect(core5).toBe(1);

    const s2 = makeSession();
    for (let c = 0; c < 7; c++) put(s2, 23, c, 'water');
    runPass(s2, 1);
    expect(s2.board.count(c => c.kind === 'core' && c.strong)).toBe(1);
  });

  it('穩定化：單一拼塊自體 4 連不共鳴', () => {
    const s = makeSession();
    for (let c = 0; c < 4; c++) put(s, 23, c, 'fire', 'normal', { lockId: 777 });
    const { acted } = runPass(s, 1);
    expect(acted).toBe(false);
    expect(countEl(s, 'fire')).toBe(4);
  });

  it('穩定化：自體 4 連＋一顆外來同元素 → 5 連共鳴', () => {
    const s = makeSession();
    for (let c = 0; c < 4; c++) put(s, 23, c, 'fire', 'normal', { lockId: 777 });
    put(s, 23, 4, 'fire'); // 不同出身
    const log = capture(s, ['resonance']);
    runPass(s, 1);
    expect(log.resonance[0]?.size).toBe(5);
  });
});

describe('拼塊內部穩定（lockId）', () => {
  it('同拼塊的火＋水不反應', () => {
    const s = makeSession();
    put(s, 23, 4, 'fire', 'normal', { lockId: 9 });
    put(s, 23, 5, 'water', 'normal', { lockId: 9 });
    const { acted } = runPass(s, 1);
    expect(acted).toBe(false);
    expect(countEl(s, 'fire')).toBe(1);
  });

  it('不同拼塊的火＋水正常反應', () => {
    const s = makeSession();
    put(s, 23, 4, 'fire', 'normal', { lockId: 9 });
    put(s, 23, 5, 'water', 'normal', { lockId: 10 });
    const { acted } = runPass(s, 1);
    expect(acted).toBe(true);
  });

  it('效果生成的格子（無 lockId）不受限制', () => {
    const s = makeSession();
    const a = makeCell('fire');            // 無 lockId
    const b = makeCell('water');
    s.board.set(23, 4, a);
    s.board.set(23, 5, b);
    const { acted } = runPass(s, 1);
    expect(acted).toBe(true);
  });
});

describe('完整行消除', () => {
  it('滿行消除＋能量回饋', () => {
    const s = makeSession();
    for (let c = 0; c < 10; c++) put(s, 23, c, null, 'sand');
    const log = capture(s, ['lines']);
    runPass(s, 1);
    expect(log.lines[0]?.count).toBe(1);
    expect(s.board.grid[23].every(x => x === null)).toBe(true);
    expect(s.energy).toBeGreaterThan(0);
  });

  it('滿行中的岩石不被消行移除', () => {
    const s = makeSession();
    for (let c = 0; c < 9; c++) put(s, 23, c, null, 'sand');
    put(s, 23, 9, null, 'rock', { hp: 1 });
    const log = capture(s, ['lines']);
    runPass(s, 1);
    expect(log.lines[0]?.count).toBe(1);
    expect(countKind(s, 'rock')).toBe(1);
    expect(countKind(s, 'sand')).toBe(0);
  });

  it('消行後上方方塊正確下落（無懸空）', () => {
    const s = makeSession();
    for (let c = 0; c < 10; c++) put(s, 23, c, null, 'sand');
    put(s, 22, 3, null, 'chain', { hp: 2 }); // 消行波及一次：hp 2→1 仍在
    runPass(s, 1);
    // 鎖鏈應落到底
    expect(s.board.get(23, 3)?.kind).toBe('chain');
    expect(s.board.get(22, 3)).toBeNull();
  });

  it('連鎖：反應清出空間 → 重力落下 → 引發第二次反應（chain 2）', () => {
    const s = makeSession();
    // pass1：蒸氣 (23,3)+(23,4) 清掉上方兩顆沙 → 高處的火落到 (23,4)
    // pass2：落下的火與 (23,5) 的水相鄰 → 第二次蒸氣
    put(s, 23, 3, 'water');
    put(s, 23, 4, 'fire');
    put(s, 23, 5, 'water');
    put(s, 22, 4, null, 'sand');
    put(s, 21, 4, null, 'sand');
    put(s, 20, 4, 'fire');
    const log = capture(s, ['reaction']);
    const passes = resolveAll(s);
    expect(passes).toBeGreaterThanOrEqual(2);
    expect(log.reaction.filter(e => e.def.id === 'steam').length).toBe(2);
    expect(log.reaction.map(e => e.chain)).toContain(2);
    expect(countEl(s, 'fire')).toBe(0);
    expect(countEl(s, 'water')).toBe(0);
  });
});

describe('反應預覽', () => {
  it('幽靈火落在場上水旁 → 預覽一組蒸氣', () => {
    const s = makeSession();
    put(s, 23, 4, 'water');
    const ghost = [{ r: 23, c: 5, cell: makeCell('fire') }];
    const pv = previewReactions(s.board, ghost);
    expect(pv.length).toBe(1);
    expect(pv[0].cells.length).toBe(2);
  });

  it('幽靈拼塊內部不互相預覽；與場上同元素合併 ≥4 顯示共鳴', () => {
    const s = makeSession();
    // 場上一顆火
    put(s, 23, 4, 'fire');
    // 幽靈：三顆火（同拼塊）落在旁邊
    const mk = () => makeCell('fire');
    const ghost = [
      { r: 23, c: 5, cell: mk() }, { r: 23, c: 6, cell: mk() }, { r: 22, c: 5, cell: mk() },
    ];
    const pv = previewReactions(s.board, ghost);
    const res = pv.filter(p => p.resonance);
    expect(res.length).toBe(1);
    expect(res[0].cells.length).toBe(4);
  });

  it('純幽靈 4 連（無場上格）不顯示共鳴', () => {
    const s = makeSession();
    const mk = () => makeCell('fire');
    const ghost = [0, 1, 2, 3].map(c => ({ r: 23, c, cell: mk() }));
    const pv = previewReactions(s.board, ghost);
    expect(pv.filter(p => p.resonance).length).toBe(0);
  });
});

describe('安全上限', () => {
  it('resolveAll 在 30 pass 內必然穩定（無限連鎖保護）', () => {
    const s = makeSession(7);
    // 鋪一個高反應性的混合盤面
    const els = ['fire', 'water', 'earth', 'air'];
    for (let r = 18; r < 24; r++) {
      for (let c = 0; c < 10; c++) {
        put(s, r, c, els[(r * 7 + c * 3) % 4]);
      }
    }
    const passes = resolveAll(s, 30);
    expect(passes).toBeLessThanOrEqual(30);
  });
});
