// ═══ 關卡目標追蹤（資料驅動；訂閱 session 事件）═══
import { REACTION_BY_ID } from '../data/reactions.js';
import { ELEMENTS } from '../data/elements.js';

function objectiveText(o) {
  switch (o.type) {
    case 'score': return `達到 ${o.target.toLocaleString()} 分`;
    case 'lines': return `消除 ${o.target} 行`;
    case 'clearElement': return `清除 ${o.target} 個${ELEMENTS[o.element]?.name ?? o.element}`;
    case 'reaction': return `觸發 ${o.target} 次「${REACTION_BY_ID[o.reactionId]?.name ?? o.reactionId}」`;
    case 'anyPair': return `觸發 ${o.target} 次雙元素反應`;
    case 'tripleReaction': return `觸發 ${o.target} 次三元素反應`;
    case 'resonance': return `觸發 ${o.target} 次元素共鳴`;
    case 'createCore': return `生成 ${o.target} 顆元素核心`;
    case 'chain': return `達成 ${o.target} 連鎖`;
    case 'clearCorrupt': return `淨化 ${o.target} 個腐蝕方塊`;
    case 'destroyRocks': return `摧毀 ${o.target} 個岩石障礙`;
    case 'survive': return `存活 ${o.target} 秒`;
    case 'boss': return '擊敗 Boss';
    default: return '???';
  }
}

export class ObjectiveTracker {
  constructor(sess, levelDef) {
    this.sess = sess;
    this.unsubs = [];
    this.items = levelDef.objectives.map(o => ({
      ...o, progress: 0, done: false, text: objectiveText(o),
    }));

    const bus = sess.bus;
    const bump = (pred, amount = 1) => (payload) => {
      for (const item of this.items) {
        if (item.done) continue;
        if (pred(item, payload)) {
          item.progress += typeof amount === 'function' ? amount(payload) : amount;
          if (item.progress >= item.target) { item.done = true; item.progress = item.target; }
        }
      }
      bus.emit('objectivesChanged', {});
    };

    this.unsubs.push(bus.on('lines', bump((i) => i.type === 'lines', (p) => p.count)));
    this.unsubs.push(bus.on('cellCleared', bump(
      (i, p) => i.type === 'clearElement' && p.el === i.element,
    )));
    this.unsubs.push(bus.on('reaction', bump((i, p) =>
      (i.type === 'reaction' && p.def.id === i.reactionId) ||
      (i.type === 'anyPair' && p.def.elements.length === 2) ||
      (i.type === 'tripleReaction' && p.def.elements.length === 3),
    )));
    this.unsubs.push(bus.on('resonance', bump((i) => i.type === 'resonance')));
    this.unsubs.push(bus.on('coreCreated', bump((i) => i.type === 'createCore')));
    this.unsubs.push(bus.on('corruptCleared', bump((i) => i.type === 'clearCorrupt')));
    this.unsubs.push(bus.on('rockDestroyed', bump((i) => i.type === 'destroyRocks')));
    this.unsubs.push(bus.on('bossDefeated', bump((i) => i.type === 'boss')));
    this.unsubs.push(bus.on('chainReached', ({ chain }) => {
      for (const item of this.items) {
        if (item.type === 'chain' && !item.done) {
          item.progress = Math.max(item.progress, chain);
          if (item.progress >= item.target) { item.done = true; item.progress = item.target; }
        }
      }
      bus.emit('objectivesChanged', {});
    }));
  }

  // score / survive 是狀態型目標，由 Game 每幀對帳
  sync(score, surviveSec) {
    let changed = false;
    for (const item of this.items) {
      if (item.done) continue;
      if (item.type === 'score') {
        item.progress = Math.min(score, item.target);
        if (score >= item.target) { item.done = true; changed = true; }
      } else if (item.type === 'survive') {
        item.progress = Math.min(Math.floor(surviveSec), item.target);
        if (surviveSec >= item.target) { item.done = true; changed = true; }
      }
    }
    if (changed) this.sess.bus.emit('objectivesChanged', {});
  }

  isComplete() { return this.items.every(i => i.done); }

  destroy() { for (const off of this.unsubs) off(); }
}
