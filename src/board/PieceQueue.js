// ═══ 拼塊佇列：7-bag 形狀 + 可控權重元素配置（防同元素洪流）═══
import { SHAPES } from '../data/pieces.js';
import { makeCell } from './Board.js';
import { Piece } from './Piece.js';
import { shuffle, weighted } from '../core/Random.js';

const PREVIEW_COUNT = 3;
const ANTI_STREAK_PENALTY = 0.45; // 上一塊用過的元素權重打折

export class PieceQueue {
  constructor(rng, cfg) {
    this.rng = rng;
    this.elements = [...cfg.availableElements];
    this.weights = { ...(cfg.elementWeights || {}) };
    this.specialRates = { ...(cfg.specialRates || {}) };
    this.bag = [];
    this.queue = [];
    this.recentElements = [];
    while (this.queue.length < PREVIEW_COUNT) this.queue.push(this.generate());
  }

  addElement(el, weight = 1) {
    if (!this.elements.includes(el)) {
      this.elements.push(el);
      this.weights[el] = weight;
    }
  }

  nextShape() {
    if (this.bag.length === 0) this.bag = shuffle(this.rng, SHAPES.slice());
    return this.bag.pop();
  }

  weightOf(el) {
    let w = this.weights[el] ?? 1;
    if (this.recentElements.includes(el)) w *= ANTI_STREAK_PENALTY;
    return Math.max(w, 0.05);
  }

  pickElements(count) {
    const pool = this.elements.slice();
    const picked = [];
    for (let i = 0; i < count && pool.length; i++) {
      const el = weighted(this.rng, pool.map(e => ({ v: e, w: this.weightOf(e) })));
      picked.push(el);
      pool.splice(pool.indexOf(el), 1);
    }
    return picked;
  }

  generate() {
    const shape = this.nextShape();
    const blockCount = shape.states[0].length;

    // 元素種類數：單一 32% / 兩種 58% / 三種 10%（元素不足時退階）
    const roll = this.rng();
    let distinct = roll < 0.32 ? 1 : roll < 0.9 ? 2 : 3;
    distinct = Math.min(distinct, this.elements.length, blockCount);
    const chosen = this.pickElements(distinct);

    // 每個選中元素至少出現一次，其餘隨機
    const assignment = [];
    for (let i = 0; i < blockCount; i++) {
      assignment.push(i < chosen.length ? chosen[i] : chosen[Math.floor(this.rng() * chosen.length)]);
    }
    const order = shuffle(this.rng, assignment);

    const cells = order.map(el => {
      const s = this.rng();
      const { ether = 0, gold = 0, rune = 0 } = this.specialRates;
      if (s < ether) return makeCell(null, 'ether');
      if (s < ether + gold) return makeCell(el, 'gold');
      if (s < ether + gold + rune) return makeCell(null, 'rune');
      return makeCell(el);
    });

    this.recentElements = chosen;
    return new Piece(shape, cells);
  }

  shift() {
    const p = this.queue.shift();
    this.queue.push(this.generate());
    return p;
  }

  peek(n = PREVIEW_COUNT) { return this.queue.slice(0, n); }

  rerollNext() { this.queue[0] = this.generate(); }
}
