// ═══ 成就系統：事件驅動解鎖、累計進度、不重複通知 ═══
import { describe, it, expect } from 'vitest';
import { AchievementSystem } from '../../src/systems/AchievementSystem.js';
import { EventBus } from '../../src/core/EventBus.js';
import { PAIR_REACTIONS } from '../../src/data/reactions.js';

function setup() {
  const save = {
    data: {
      achievements: {},
      achievementProgress: { corrupt: 0, spells: 0 },
      levelStars: {},
      discoveredReactions: {},
    },
    save() {},
  };
  const notified = [];
  const ach = new AchievementSystem(save, (a) => notified.push(a.id));
  const sess = { bus: new EventBus() };
  ach.bindSession(sess);
  return { save, ach, sess, notified };
}

describe('成就', () => {
  it('首次反應／虛空淨化／三元素', () => {
    const { save, sess, notified } = setup();
    sess.bus.emit('reaction', { def: { id: 'steam', elements: ['fire', 'water'] } });
    expect(save.data.achievements.first_reaction).toBeTruthy();
    sess.bus.emit('reaction', { def: { id: 'eclipse', elements: ['light', 'shadow'] } });
    expect(save.data.achievements.eclipse_seen).toBeTruthy();
    sess.bus.emit('reaction', { def: { id: 'superheat', elements: ['fire', 'water', 'air'] } });
    expect(save.data.achievements.triple_alchemist).toBeTruthy();
    expect(notified).toContain('first_reaction');
  });

  it('同一成就不重複通知', () => {
    const { sess, notified } = setup();
    sess.bus.emit('reaction', { def: { id: 'steam', elements: ['fire', 'water'] } });
    sess.bus.emit('reaction', { def: { id: 'steam', elements: ['fire', 'water'] } });
    expect(notified.filter(id => id === 'first_reaction').length).toBe(1);
  });

  it('連鎖 5／四行消除／強化核心／Boss', () => {
    const { save, sess } = setup();
    sess.bus.emit('chainReached', { chain: 4 });
    expect(save.data.achievements.chain5).toBeUndefined();
    sess.bus.emit('chainReached', { chain: 5 });
    expect(save.data.achievements.chain5).toBeTruthy();
    sess.bus.emit('lines', { count: 4 });
    expect(save.data.achievements.quad).toBeTruthy();
    sess.bus.emit('coreCreated', { strong: false });
    expect(save.data.achievements.core_maker).toBeUndefined();
    sess.bus.emit('coreCreated', { strong: true });
    expect(save.data.achievements.core_maker).toBeTruthy();
    sess.bus.emit('bossDefeated', {});
    expect(save.data.achievements.boss_slayer).toBeTruthy();
  });

  it('累計型：淨化 20／施法 15', () => {
    const { save, sess } = setup();
    for (let i = 0; i < 20; i++) sess.bus.emit('corruptCleared', {});
    expect(save.data.achievements.purifier).toBeTruthy();
    for (let i = 0; i < 15; i++) sess.bus.emit('spellCast', { id: 'hammer' });
    expect(save.data.achievements.spell_master).toBeTruthy();
  });

  it('反應大全：12 種雙元素全發現後觸發', () => {
    const { save, sess } = setup();
    for (const r of PAIR_REACTIONS) save.data.discoveredReactions[r.id] = { count: 1 };
    sess.bus.emit('reaction', { def: { id: 'steam', elements: ['fire', 'water'] } });
    expect(save.data.achievements.all_pairs).toBeTruthy();
  });

  it('摘星者：星星總數 15；無限模式 10,000 分', () => {
    const { save, ach } = setup();
    save.data.levelStars = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 };
    ach.onLevelComplete();
    expect(save.data.achievements.star_collector).toBeTruthy();
    ach.onEndlessEnd(9999);
    expect(save.data.achievements.endless_10k).toBeUndefined();
    ach.onEndlessEnd(10000);
    expect(save.data.achievements.endless_10k).toBeTruthy();
  });
});
