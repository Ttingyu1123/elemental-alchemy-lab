// ═══ Boss 系統：血量、階段、依落塊回合施放技能、傷害結算 ═══
import { BOSSES } from '../data/bosses.js';
import { makeCell } from '../board/Board.js';
import { shuffle } from '../core/Random.js';
import { chainMultiplier } from '../config.js';

export class BossSystem {
  constructor(sess, bossId) {
    this.sess = sess;
    this.def = BOSSES[bossId];
    this.hp = this.def.maxHp;
    this.dead = false;
    this.locksSinceAttack = 0;
    this.unsubs = [];

    const bus = sess.bus;
    const dmg = this.def.damage;
    this.unsubs.push(bus.on('reaction', ({ def, chain }) => {
      const mult = chainMultiplier(chain);
      if (def.id === 'eclipse') this.damage(dmg.eclipse * mult, def.name);
      else if (def.elements.length === 3) this.damage(dmg.tripleReaction * mult, def.name);
      else this.damage(dmg.pairReaction * mult, def.name);
    }));
    this.unsubs.push(bus.on('resonance', ({ chain }) => this.damage(dmg.resonance * chainMultiplier(chain), '共鳴')));
    this.unsubs.push(bus.on('coreTriggered', () => this.damage(dmg.core, '元素核心')));
    this.unsubs.push(bus.on('lines', ({ count, chain }) => this.damage(dmg.linePer * count * chainMultiplier(chain), '消行')));
  }

  destroy() { for (const off of this.unsubs) off(); }

  get phase() {
    const ratio = this.hp / this.def.maxHp;
    for (const p of this.def.phases) {
      if (ratio > p.hpAbove) return p;
    }
    return this.def.phases[this.def.phases.length - 1];
  }

  get speedMult() { return this.phase.speedMult ?? 1; }

  get locksUntilAttack() {
    return Math.max(0, this.def.attackEveryLocks - this.locksSinceAttack);
  }

  damage(amount, sourceName) {
    if (this.dead || this.sess.state === 'over' || this.sess.state === 'won') return;
    this.hp = Math.max(0, this.hp - Math.round(amount));
    this.sess.audio.play('bossHit');
    this.sess.fx?.bossHitFx(Math.round(amount), sourceName);
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.sess.bus.emit('bossDefeated', {});
    }
  }

  // 每次落塊呼叫；Boss 死亡或遊戲結束後不再施放
  onLock() {
    if (this.dead || this.sess.state === 'over' || this.sess.state === 'won') return;
    this.locksSinceAttack += 1;
    if (this.locksSinceAttack < this.def.attackEveryLocks) return;
    this.locksSinceAttack = 0;
    this.attack(this.phase.attack);
  }

  attack(type) {
    const sess = this.sess;
    const b = sess.board;
    sess.audio.play('bossAttack');
    switch (type) {
      case 'corrupt2': {
        const spots = [];
        b.forEach((r, c, cell) => { if (cell.kind === 'normal') spots.push([r, c]); });
        for (const [r, c] of shuffle(sess.rng, spots).slice(0, 2)) {
          b.set(r, c, makeCell(null, 'corrupt'));
          sess.fx?.burst(r, c, '#5a3a80', 12);
        }
        sess.fx?.bigText('魔像散布腐蝕！');
        break;
      }
      case 'chains': {
        const spots = [];
        b.forEach((r, c, cell) => { if (cell.kind === 'normal') spots.push([r, c]); });
        for (const [r, c] of shuffle(sess.rng, spots).slice(0, 2)) {
          b.set(r, c, makeCell(null, 'chain', { hp: 2 }));
          sess.fx?.burst(r, c, '#c0c0d8', 12);
        }
        sess.fx?.bigText('魔像鎖鏈纏縛！');
        break;
      }
      case 'potion': {
        // 丟到隨機直行的堆疊頂
        const cols = shuffle(sess.rng, Array.from({ length: b.cols }, (_, i) => i));
        for (const c of cols) {
          const top = b.columnHeightTop(c);
          if (top - 1 >= b.hidden) {
            b.set(top - 1, c, makeCell(null, 'potion', { timer: 5 }));
            sess.fx?.burst(top - 1, c, '#8fe06a', 12);
            break;
          }
        }
        sess.fx?.bigText('不穩定藥劑來襲！');
        break;
      }
    }
  }
}
