// ═══ 成就系統：App 層常駐，逐 session 訂閱事件；解鎖狀態與累計進度存檔 ═══
import { ACHIEVEMENT_BY_ID } from '../data/achievements.js';
import { PAIR_REACTIONS } from '../data/reactions.js';

export class AchievementSystem {
  // save: SaveSystem；notify(achievement) 由 App 提供（toast＋音效）
  constructor(save, notify) {
    this.save = save;
    this.notify = notify;
    this.unsubs = [];
  }

  get progress() { return this.save.data.achievementProgress; }

  unlock(id) {
    const d = this.save.data;
    if (d.achievements[id]) return false;
    d.achievements[id] = Date.now();
    this.save.save();
    this.notify?.(ACHIEVEMENT_BY_ID[id]);
    return true;
  }

  bindSession(sess) {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    const bus = sess.bus;

    this.unsubs.push(bus.on('reaction', ({ def }) => {
      this.unlock('first_reaction');
      if (def.id === 'eclipse') this.unlock('eclipse_seen');
      if (def.elements.length === 3) this.unlock('triple_alchemist');
      // 依已發現圖鑑判定反應大全（App 的 discoverReaction 先於本系統訂閱）
      const found = this.save.data.discoveredReactions;
      if (PAIR_REACTIONS.every(r => found[r.id])) this.unlock('all_pairs');
    }));
    this.unsubs.push(bus.on('chainReached', ({ chain }) => {
      if (chain >= 5) this.unlock('chain5');
    }));
    this.unsubs.push(bus.on('lines', ({ count }) => {
      if (count >= 4) this.unlock('quad');
    }));
    this.unsubs.push(bus.on('coreCreated', ({ strong }) => {
      if (strong) this.unlock('core_maker');
    }));
    this.unsubs.push(bus.on('bossDefeated', () => this.unlock('boss_slayer')));
    this.unsubs.push(bus.on('corruptCleared', () => {
      this.progress.corrupt += 1;
      if (this.progress.corrupt >= 20) this.unlock('purifier');
      this.save.save();
    }));
    this.unsubs.push(bus.on('spellCast', () => {
      this.progress.spells += 1;
      if (this.progress.spells >= 15) this.unlock('spell_master');
      this.save.save();
    }));
  }

  // 關卡結算後呼叫（星星累計）
  onLevelComplete() {
    const total = Object.values(this.save.data.levelStars).reduce((a, b) => a + b, 0);
    if (total >= 15) this.unlock('star_collector');
  }

  // 無限模式結束後呼叫
  onEndlessEnd(score) {
    if (score >= 10000) this.unlock('endless_10k');
  }
}
