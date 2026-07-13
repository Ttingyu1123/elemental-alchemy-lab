// ═══ 存檔（localStorage；try/catch＋版本欄位＋損壞回退）═══
import { SAVE_KEY, SAVE_VERSION } from '../config.js';

function defaultSave() {
  return {
    saveVersion: SAVE_VERSION,
    currentLevel: 1,
    unlockedLevels: 1,
    levelStars: {},
    highScores: {},
    endless: { highScore: 0, maxChain: 0, longestTimeSec: 0, mostReactions: 0, mostQuads: 0 },
    discoveredElements: [],
    discoveredReactions: {},
    reactionStatistics: {},
    ownedRelics: [],
    relicOffersDone: [],
    tutorialCompleted: false,
    settings: { sfx: true, music: false, volume: 70, reduced: false },
    achievements: {},
    totalPlayTime: 0,
  };
}

function migrate(data) {
  // 未來版本遷移點；缺欄位以預設補齊
  const base = defaultSave();
  const merged = { ...base, ...data };
  merged.settings = { ...base.settings, ...(data.settings || {}) };
  merged.endless = { ...base.endless, ...(data.endless || {}) };
  merged.saveVersion = SAVE_VERSION;
  return merged;
}

export class SaveSystem {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('bad save');
      return migrate(parsed);
    } catch (err) {
      console.warn('[Save] 存檔損壞，使用預設值', err);
      return defaultSave();
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[Save] 寫入失敗', err);
    }
  }

  wipe() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
    this.data = defaultSave();
  }

  // ── 便捷操作（都會自動 save）──
  completeLevel(levelId, stars, score) {
    const d = this.data;
    const prev = d.levelStars[levelId] ?? 0;
    if (stars > prev) d.levelStars[levelId] = stars;
    if (score > (d.highScores[levelId] ?? 0)) d.highScores[levelId] = score;
    if (levelId >= d.unlockedLevels) d.unlockedLevels = levelId + 1;
    d.currentLevel = Math.min(levelId + 1, 12);
    this.save();
    return stars > prev; // 是否刷新
  }

  discoverElement(el) {
    if (!this.data.discoveredElements.includes(el)) {
      this.data.discoveredElements.push(el);
      this.save();
    }
  }

  // 回傳是否首次發現
  discoverReaction(id, score) {
    const d = this.data.discoveredReactions;
    const isNew = !d[id];
    if (isNew) d[id] = { firstAt: Date.now(), count: 0, bestScore: 0 };
    d[id].count += 1;
    if (score > d[id].bestScore) d[id].bestScore = Math.round(score);
    this.save();
    return isNew;
  }

  updateEndless(stats) {
    const e = this.data.endless;
    e.highScore = Math.max(e.highScore, stats.score);
    e.maxChain = Math.max(e.maxChain, stats.maxChain);
    e.longestTimeSec = Math.max(e.longestTimeSec, stats.timeSec);
    e.mostReactions = Math.max(e.mostReactions, stats.reactions);
    e.mostQuads = Math.max(e.mostQuads, stats.quads);
    this.save();
  }

  setSetting(k, v) {
    this.data.settings[k] = v;
    this.save();
  }
}
