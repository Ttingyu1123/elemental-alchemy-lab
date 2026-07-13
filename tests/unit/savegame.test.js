// ═══ 中途存檔：序列化→還原後，後續行為必須與原局完全一致 ═══
import { describe, it, expect } from 'vitest';
import { GameSession } from '../../src/core/Game.js';
import { LEVEL_BY_ID } from '../../src/data/levels.js';

function mockApp() {
  return {
    audio: { play() {} },
    renderer: null,
    save: { data: { ownedRelics: [] } },
    saveMidGame() {},
    onSessionEnd() {},
  };
}

function dropAndSettle(s) {
  s.hardDrop();
  let guard = 0;
  while (s.state === 'resolving' && guard++ < 80) s.stepResolve();
}

function normalizeGrid(board) {
  return board.grid.map(row => row.map(cell => cell ? `${cell.el}/${cell.kind}` : '.'));
}

describe('中途存檔', () => {
  it('落下狀態可序列化；解析中回傳 null（只存穩定檢查點）', () => {
    const s = new GameSession(mockApp(), 'level', LEVEL_BY_ID[1], 123);
    expect(s.serialize()).not.toBeNull();
    s.hardDrop(); // 進入 resolving
    if (s.state === 'resolving') expect(s.serialize()).toBeNull();
  });

  it('還原後棋盤、分數、佇列、能量完全一致', () => {
    const app = mockApp();
    const s1 = new GameSession(app, 'level', LEVEL_BY_ID[1], 123);
    for (let i = 0; i < 4; i++) dropAndSettle(s1);
    const snap = JSON.parse(JSON.stringify(s1.serialize())); // 模擬 localStorage 序列化

    const s2 = new GameSession(app, 'level', LEVEL_BY_ID[1], 999, snap);
    expect(s2.score.score).toBe(s1.score.score);
    expect(s2.energy).toBe(s1.energy);
    expect(s2.lockCount).toBe(s1.lockCount);
    expect(normalizeGrid(s2.board)).toEqual(normalizeGrid(s1.board));
    expect(s2.queue.peek(3).map(p => p.shape.id)).toEqual(s1.queue.peek(3).map(p => p.shape.id));
    expect(s2.piece.shape.id).toBe(s1.piece.shape.id);
    expect(s2.piece.x).toBe(s1.piece.x);
  });

  it('還原後續玩結果與原局一致（RNG 狀態接續）', () => {
    const app = mockApp();
    const s1 = new GameSession(app, 'level', LEVEL_BY_ID[1], 777);
    for (let i = 0; i < 3; i++) dropAndSettle(s1);
    const snap = JSON.parse(JSON.stringify(s1.serialize()));

    const s2 = new GameSession(app, 'level', LEVEL_BY_ID[1], 555, snap);
    // 兩邊各自續玩三塊，結果必須逐格相同
    for (let i = 0; i < 3; i++) { dropAndSettle(s1); dropAndSettle(s2); }
    expect(s2.score.score).toBe(s1.score.score);
    expect(normalizeGrid(s2.board)).toEqual(normalizeGrid(s1.board));
    expect(s2.queue.peek(3).map(p => p.shape.id)).toEqual(s1.queue.peek(3).map(p => p.shape.id));
  });

  it('暫存拼塊與法術使用次數一併還原', () => {
    const app = mockApp();
    const s1 = new GameSession(app, 'level', LEVEL_BY_ID[1], 42);
    s1.doHold();
    s1.spells.usedCounts.philostone = 1;
    dropAndSettle(s1);
    const snap = JSON.parse(JSON.stringify(s1.serialize()));
    const s2 = new GameSession(app, 'level', LEVEL_BY_ID[1], 1, snap);
    expect(s2.holdPiece?.shape.id).toBe(s1.holdPiece?.shape.id);
    expect(s2.spells.usedCounts.philostone).toBe(1);
    expect(s2.spells.canCast('philostone')).toBe(false); // 每關一次限制仍生效
  });

  it('Boss 血量與攻擊計數還原', () => {
    const app = mockApp();
    const s1 = new GameSession(app, 'level', LEVEL_BY_ID[12], 42);
    s1.boss.hp = 800;
    s1.boss.locksSinceAttack = 2;
    const snap = JSON.parse(JSON.stringify(s1.serialize()));
    const s2 = new GameSession(app, 'level', LEVEL_BY_ID[12], 1, snap);
    expect(s2.boss.hp).toBe(800);
    expect(s2.boss.locksSinceAttack).toBe(2);
  });
});
