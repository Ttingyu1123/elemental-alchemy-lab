// ═══ 分數（UI 只讀，不可直接改）═══
export class ScoreSystem {
  constructor() {
    this.score = 0;
  }
  addRaw(n) {
    if (!Number.isFinite(n) || n <= 0) return;
    this.score += Math.round(n);
  }
}
