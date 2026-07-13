// ═══ 應用程式入口：畫面流程、session 生命週期、統一 rAF 迴圈 ═══
import { GameSession, starsFor } from './core/Game.js';
import { LEVELS, LEVEL_BY_ID } from './data/levels.js';
import { RELICS, RELIC_OFFER_AFTER_LEVELS, RELIC_BY_ID } from './data/relics.js';
import { SPELL_BY_ID } from './data/spells.js';
import { REACTION_BY_ID } from './data/reactions.js';
import { SaveSystem } from './systems/SaveSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { InputSystem } from './systems/InputSystem.js';
import { AchievementSystem } from './systems/AchievementSystem.js';
import { BoardRenderer } from './ui/BoardRenderer.js';
import { HUD } from './ui/HUD.js';
import { Screens } from './ui/Screens.js';
import { TutorialSystem } from './ui/TutorialSystem.js';
import { shuffle } from './core/Random.js';

class App {
  constructor() {
    this.save = new SaveSystem();
    this.audio = new AudioSystem(this.save.data.settings);
    this.input = new InputSystem();
    this.renderer = new BoardRenderer(document.getElementById('board-canvas'), this.save.data.settings);
    this.hud = new HUD((id) => this.onSpellClick(id), () => this.session?.reroll());
    this.screens = new Screens(this);
    this.tutorial = new TutorialSystem(this.save);
    this.achievements = new AchievementSystem(this.save, (a) => {
      this.screens.toast(`🏆 成就解鎖：${a.icon} ${a.name}`, a.description);
      this.audio.play('discover');
    });

    this.session = null;
    this.paused = false;
    this.sessionEnded = false;
    this.lastTs = 0;

    this.input.setHandler((action) => {
      if (action === 'pause') { this.togglePause(); return; }
      if (this.session && !this.paused && !this.sessionEnded) this.session.handleAction(action);
    });

    // 法術目標選擇：點擊棋盤
    const canvas = document.getElementById('board-canvas');
    canvas.addEventListener('pointerdown', (e) => {
      const sess = this.session;
      if (!sess || this.paused || !sess.spells.pending) return;
      const cell = this.renderer.cellFromEvent(e);
      if (cell) sess.spells.onCellPicked(cell.r, cell.c);
    });

    // 首次互動解鎖 AudioContext
    const unlock = () => {
      this.audio.ensure();
      this.audio.resume();
      if (this.save.data.settings.music) this.audio.setMusic(true);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    // 關頁前保底存一次中途進度（平時每次生成新拼塊已自動存）
    window.addEventListener('beforeunload', () => {
      if (this.session && !this.sessionEnded) this.saveMidGame(this.session);
    });

    this.screens.show('menu');
    requestAnimationFrame((ts) => this.loop(ts));
  }

  loop(ts) {
    const dt = Math.min(ts - this.lastTs || 16, 100);
    this.lastTs = ts;
    const sess = this.session;
    if (sess) {
      if (!this.paused && !this.sessionEnded) {
        this.input.update(dt);
        sess.update(dt);
      }
      this.renderer.render(sess, this.paused ? 0 : dt);
      this.hud.update(sess);
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  // ── session 生命週期 ──
  beginSession(mode, levelDef, resume = null) {
    this.endSessionObject();
    this.paused = false;
    this.sessionEnded = false;
    this.renderer.clearFx();
    this.input.reset();
    this.session = new GameSession(this, mode, levelDef, null, resume);
    this.hud.bindSession(this.session);
    this.tutorial.attach(this.session, resume?.tutorialStep ?? 0);
    this.bindSessionEvents(this.session);
    this.achievements.bindSession(this.session);
    this.screens.show('game');
    this.renderer.resize();
    if (levelDef) {
      for (const el of levelDef.availableElements) this.save.discoverElement(el);
    }
    this.sessionStart = performance.now();
  }

  // GameSession 於每次生成新拼塊時呼叫（穩定檢查點）
  saveMidGame(sess) {
    const snapshot = sess.serialize();
    if (!snapshot) return; // 非穩定狀態 → 保留上一個檢查點
    snapshot.tutorialStep = this.tutorial.active ? this.tutorial.step : null;
    this.save.setMidGame(snapshot);
  }

  bindSessionEvents(sess) {
    sess.bus.on('reaction', ({ def, score }) => {
      const isNew = this.save.discoverReaction(def.id, score);
      if (isNew) {
        this.screens.toast('✦ 新煉金反應發現 ✦', `${def.name} — 已加入圖鑑`);
        this.audio.play('discover');
      }
    });
    sess.bus.on('spellTargeting', ({ spell }) => this.screens.showTargetHint(spell, sess.spells));
    sess.bus.on('spellTargetingEnd', () => this.screens.hideTargetHint());
  }

  endSessionObject() {
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
    this.tutorial.detach();
    this.screens.hideTargetHint();
    this.screens.hideModal('result');
    this.screens.hideModal('pause');
  }

  startLevel(id) {
    const lv = LEVEL_BY_ID[id];
    if (!lv || id > this.save.data.unlockedLevels) return;
    this.beginSession('level', lv);
  }

  continueGame() {
    const mg = this.save.data.midGame;
    if (mg) {
      const lv = mg.levelId ? LEVEL_BY_ID[mg.levelId] : null;
      if (mg.mode === 'endless' || lv) {
        this.beginSession(mg.mode, lv, mg);
        return;
      }
    }
    const id = Math.min(this.save.data.currentLevel, this.save.data.unlockedLevels, 12);
    this.startLevel(id);
  }

  startEndless() {
    this.beginSession('endless', null);
  }

  restart() {
    if (!this.session) return;
    const { mode, levelDef } = this.session;
    this.beginSession(mode, levelDef);
  }

  nextLevel() {
    const cur = this.session?.levelDef;
    const nextId = cur ? cur.id + 1 : this.save.data.currentLevel;
    if (nextId <= 12 && nextId <= this.save.data.unlockedLevels) this.startLevel(nextId);
    else this.quitToMenu();
  }

  quitToMenu() {
    this.recordPlaytime();
    this.endSessionObject();
    this.paused = false;
    this.screens.show('menu');
  }

  togglePause() {
    const sess = this.session;
    if (!sess || this.sessionEnded) return;
    if (sess.state === 'over' || sess.state === 'won') return;
    this.paused = !this.paused;
    this.input.reset();
    if (this.paused) {
      this.screens.syncPauseSettings();
      this.screens.showModal('pause');
    } else {
      this.screens.hideModal('pause');
    }
  }

  recordPlaytime() {
    if (this.sessionStart) {
      this.save.data.totalPlayTime += Math.round((performance.now() - this.sessionStart) / 1000);
      this.save.save();
      this.sessionStart = null;
    }
  }

  // ── 結算 ──
  onSessionEnd(sess, won) {
    this.sessionEnded = true;
    this.input.reset();
    this.screens.hideTargetHint();
    this.recordPlaytime();
    this.save.clearMidGame(); // 結算後不可續玩該局

    if (sess.mode === 'level') {
      const lv = sess.levelDef;
      if (won) {
        const stars = starsFor(lv, sess.score.score);
        this.save.completeLevel(lv.id, stars, sess.score.score);
        this.achievements.onLevelComplete();
        const offerDue = RELIC_OFFER_AFTER_LEVELS.includes(lv.id) &&
          !this.save.data.relicOffersDone.includes(lv.id);
        const unowned = RELICS.map(r => r.id).filter(id => !this.save.data.ownedRelics.includes(id));
        if (offerDue && unowned.length) {
          this.save.data.relicOffersDone.push(lv.id);
          this.save.save();
          const candidates = shuffle(Math.random, unowned).slice(0, 3);
          this.screens.offerRelics(candidates, (id) => {
            this.save.data.ownedRelics.push(id);
            this.save.save();
            this.screens.toast(`獲得遺物：${RELIC_BY_ID[id].icon} ${RELIC_BY_ID[id].name}`);
            this.showLevelResult(sess, true, stars);
          });
          return;
        }
        this.showLevelResult(sess, true, stars);
      } else {
        this.showLevelResult(sess, false, 0);
      }
    } else {
      this.save.updateEndless({
        score: sess.score.score, maxChain: sess.maxChain,
        timeSec: sess.elapsed / 1000, reactions: sess.stats.reactions, quads: sess.stats.quads,
      });
      this.achievements.onEndlessEnd(sess.score.score);
      this.showEndlessResult(sess);
    }
  }

  reactionStatsRows(sess) {
    const entries = Object.entries(sess.stats.byType)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, n]) => `${REACTION_BY_ID[id]?.name ?? id} ×${n}`);
    return entries.length ? entries.join('、') : '無';
  }

  showLevelResult(sess, won, stars) {
    const lv = sess.levelDef;
    const failReasons = {
      topout: '方塊堆到了生成區', moves: '步數用盡', time: '時間到', blocked: '無法生成新拼塊',
    };
    const objRows = sess.objectives.items.map(i =>
      `${i.done ? '✔' : '✘'} ${i.text}`).join('<br/>');
    this.screens.showResult({
      won,
      title: won ? `第 ${lv.id} 關通過！` : `第 ${lv.id} 關失敗（${failReasons[sess.overReason] ?? ''}）`,
      stars,
      rows: [
        { html: `最終分數：<b>${sess.score.score.toLocaleString()}</b>` },
        { html: `最高連鎖：<b>×${sess.maxChain}</b> · 消行：<b>${sess.stats.lines}</b>` },
        { html: `目標：<br/>${objRows}`, section: true },
        { html: `觸發反應：${this.reactionStatsRows(sess)}`, section: true },
        won ? { html: `獎勵：${'★'.repeat(stars)}${lv.id < 12 ? ' · 解鎖下一關' : ' · 第一章完成！'}`, section: true } : null,
      ].filter(Boolean),
      canNext: won && lv.id < 12,
    });
  }

  showEndlessResult(sess) {
    const e = this.save.data.endless;
    this.screens.showResult({
      won: false,
      title: '無限模式結束',
      stars: 0,
      rows: [
        { html: `本局分數：<b>${sess.score.score.toLocaleString()}</b>（最高 ${e.highScore.toLocaleString()}）` },
        { html: `等級：<b>${sess.endlessLevel}</b> · 存活 <b>${Math.floor(sess.elapsed / 1000)}</b> 秒（最長 ${Math.floor(e.longestTimeSec)} 秒）` },
        { html: `最高連鎖：<b>×${sess.maxChain}</b>（紀錄 ×${e.maxChain}）` },
        { html: `反應次數：<b>${sess.stats.reactions}</b>（紀錄 ${e.mostReactions}）· 四行消除：<b>${sess.stats.quads}</b>（紀錄 ${e.mostQuads}）` },
        { html: `觸發反應：${this.reactionStatsRows(sess)}`, section: true },
      ],
      canNext: false,
    });
  }

  // ── 法術 UI 流程 ──
  onSpellClick(id) {
    const sess = this.session;
    if (!sess || this.paused || this.sessionEnded) return;
    const spell = SPELL_BY_ID[id];
    if (sess.spells.pending?.spell.id === id) { sess.spells.cancel(); return; }
    if (!sess.spells.canCast(id)) { this.audio.play('denied'); return; }
    if (spell.needElementPick) {
      this.screens.pickElement(sess.queue.elements, (el) => {
        sess.spells.beginCast(id, el);
      });
    } else {
      sess.spells.beginCast(id);
    }
  }

  // ── 設定 ──
  setSetting(k, v) {
    this.save.setSetting(k, v);
    if (k === 'volume') this.audio.applyVolume();
    if (k === 'music') this.audio.setMusic(v);
    // 同步兩處設定 UI
    this.screens.syncSettings();
    this.screens.syncPauseSettings();
  }

  wipeSave() {
    this.endSessionObject();
    this.save.wipe();
    // 重新綁定設定物件參照
    this.audio.settings = this.save.data.settings;
    this.renderer.settings = this.save.data.settings;
    this.audio.setMusic(false);
    this.screens.syncMenu();
    this.screens.toast('存檔已清除');
    this.screens.show('menu');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__eal = new App(); // 除錯用途
});
