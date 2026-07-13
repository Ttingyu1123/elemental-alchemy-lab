// ═══ 法術系統：能量檢查、目標選擇模式、每關限制、防連點 ═══
import { SPELLS, SPELL_BY_ID } from '../data/spells.js';
import { hitCell } from '../alchemy/ReactionEffects.js';
import { makeCell } from '../board/Board.js';
import { shuffle } from '../core/Random.js';

export class SpellSystem {
  constructor(sess) {
    this.sess = sess;
    this.pending = null; // { spell, element?, rcMode?: 'row'|'col' }
    this.usedCounts = {};
    this.busy = false; // 執行中防重複施放
  }

  get spells() { return SPELLS; }

  canCast(id) {
    const spell = SPELL_BY_ID[id];
    if (!spell) return false;
    const sess = this.sess;
    if (sess.state !== 'falling') return false; // 動畫/結算/暫停期間不可施放
    if (this.busy || this.pending) return false;
    if (sess.energy < spell.cost) return false;
    if ((this.usedCounts[id] ?? 0) >= spell.perLevelLimit) return false;
    return true;
  }

  // 由 UI 呼叫；回傳 'targeting' | 'cast' | false
  beginCast(id, element = null) {
    if (!this.canCast(id)) {
      this.sess.audio.play('denied');
      return false;
    }
    const spell = SPELL_BY_ID[id];
    if (spell.needElementPick && !element) return 'needElement';
    if (spell.targeted) {
      this.pending = { spell, element, rcMode: spell.targeted === 'rowcol' ? 'row' : null };
      this.sess.bus.emit('spellTargeting', { spell });
      return 'targeting';
    }
    this.execute(spell, { element });
    return 'cast';
  }

  setRcMode(mode) { if (this.pending) this.pending.rcMode = mode; }

  cancel() {
    if (this.pending) {
      this.pending = null;
      this.sess.bus.emit('spellTargetingEnd', {});
    }
  }

  // 目標模式中點擊棋盤格
  onCellPicked(r, c) {
    if (!this.pending) return;
    const { spell, element, rcMode } = this.pending;
    const b = this.sess.board;
    if (spell.id === 'transmute' || spell.id === 'hammer') {
      if (!b.get(r, c)) { this.sess.audio.play('denied'); return; } // 空格無效，維持目標模式
    }
    this.pending = null;
    this.sess.bus.emit('spellTargetingEnd', {});
    this.execute(spell, { element, r, c, rcMode });
  }

  execute(spell, args) {
    const sess = this.sess;
    if (this.busy || sess.state !== 'falling') return;
    this.busy = true;
    const b = sess.board;
    const ctx = { chain: 1, mult: 1, hitGuard: new Set(), sess };
    let success = false;

    switch (spell.id) {
      case 'transmute': {
        const cell = b.get(args.r, args.c);
        if (cell && ['normal', 'ether', 'icecrystal', 'gold'].includes(cell.kind)) {
          b.set(args.r, args.c, makeCell(args.element));
          sess.fx?.burst(args.r, args.c, '#c779d0', 14);
          success = true;
        }
        break;
      }
      case 'hammer': {
        success = hitCell(sess, args.r, args.c, ctx, 'hammer');
        break;
      }
      case 'gravity': {
        b.applyGravity();
        sess.fx?.bigText('重力逆轉！');
        success = true;
        break;
      }
      case 'resonate': {
        const spots = [];
        b.forEach((r, c, cell) => { if (cell.kind === 'normal') spots.push([r, c]); });
        const picked = shuffle(sess.rng, spots).slice(0, 4);
        for (const [r, c] of picked) {
          b.set(r, c, makeCell(args.element));
          sess.fx?.burst(r, c, '#a88fff', 10);
        }
        success = picked.length > 0;
        break;
      }
      case 'philostone': {
        if (args.rcMode === 'col') {
          for (let r = 0; r < b.rows; r++) hitCell(sess, r, args.c, ctx, 'philostone');
        } else {
          for (let c = 0; c < b.cols; c++) hitCell(sess, args.r, c, ctx, 'philostone');
        }
        sess.fx?.bigText('賢者之石！');
        success = true;
        break;
      }
    }

    if (success) {
      sess.energy = Math.max(0, sess.energy - spell.cost);
      this.usedCounts[spell.id] = (this.usedCounts[spell.id] ?? 0) + 1;
      sess.audio.play('spell');
      sess.bus.emit('spellCast', { id: spell.id });
      sess.startResolution(); // 法術可能引發新反應
    } else {
      sess.audio.play('denied');
    }
    this.busy = false;
  }
}
