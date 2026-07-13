// ═══ 每局一個實例的事件匯流排；session 銷毀時 clear() 防監聽器累積 ═══
export class EventBus {
  constructor() { this.map = new Map(); }

  on(ev, fn) {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev).add(fn);
    return () => this.off(ev, fn);
  }

  off(ev, fn) { this.map.get(ev)?.delete(fn); }

  emit(ev, data) {
    const set = this.map.get(ev);
    if (!set) return;
    for (const fn of [...set]) fn(data);
  }

  clear() { this.map.clear(); }
}
