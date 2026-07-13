// ═══ 互動式教學：完成指定動作才前進；可略過；狀態存檔 ═══
const STEPS = [
  { text: '歡迎來到<b>元素煉金工坊</b>！先用 <b>← →</b>（或 A／D）左右移動拼塊。', event: 'playerAction', match: p => p === 'left' || p === 'right' },
  { text: '很好！按 <b>↑</b> 或 <b>W</b> 順時針旋轉，<b>Z</b> 逆時針旋轉。', event: 'playerAction', match: p => p === 'cw' || p === 'ccw' },
  { text: '按住 <b>↓</b>（或 S）可以加速下落。', event: 'playerAction', match: p => p === 'softOn' },
  { text: '按 <b>Space</b> 瞬間落下並立即鎖定，底部半透明的是<b>幽靈落點</b>。', event: 'playerAction', match: p => p === 'hard' },
  { text: '把一整行填滿就能消除。試著<b>完成一次消行</b>！', event: 'lines' },
  { text: '每個方塊格都含有<b>煉金元素</b>。火與水相鄰會產生「蒸氣」反應，清除方塊並得分！', button: true },
  { text: '讓一個<b>火元素</b>格與<b>水元素</b>格上下或左右相鄰，觸發蒸氣反應。', event: 'reaction', match: p => p.def.id === 'steam' },
  { text: '漂亮！右側面板會顯示<b>接下來 3 個拼塊</b>的形狀與元素，用它來規劃反應。', button: true },
  { text: '按 <b>C</b> 可以<b>暫存</b>目前拼塊、稍後換回。每次落塊只能用一次。試試看！', event: 'playerAction', match: p => p === 'hold' },
  { text: '左側的<b>煉金能量</b>會隨反應累積，集滿可施放強力法術。', button: true },
  { text: '能量達 25 時，可用「<b>元素轉化</b>」法術把棋盤任一格變成想要的元素。', button: true },
  { text: '教學完成！完成左側的<b>關卡目標</b>即可過關。祝煉金順利！✦', button: true },
];

const $ = (id) => document.getElementById(id);

export class TutorialSystem {
  constructor(save) {
    this.save = save;
    this.active = false;
    this.step = 0;
    this.unsubs = [];
    this.overlay = $('tutorial-overlay');
    this.textEl = $('tutorial-text');
    this.nextBtn = $('btn-tut-next');
    this.skipBtn = $('btn-tut-skip');
    this.nextBtn.addEventListener('click', () => { if (this.active) this.advance(); });
    this.skipBtn.addEventListener('click', () => this.finish());
  }

  shouldRun(sess) {
    return sess.mode === 'level' && sess.levelDef.tutorial && !this.save.data.tutorialCompleted;
  }

  attach(sess) {
    this.detach();
    if (!this.shouldRun(sess)) return;
    this.active = true;
    this.step = 0;
    this.unsubs.push(sess.bus.on('playerAction', (a) => this.onEvent('playerAction', a)));
    this.unsubs.push(sess.bus.on('lines', (p) => this.onEvent('lines', p)));
    this.unsubs.push(sess.bus.on('reaction', (p) => this.onEvent('reaction', p)));
    this.render();
  }

  detach() {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.active = false;
    this.overlay.classList.add('hidden');
  }

  onEvent(type, payload) {
    if (!this.active) return;
    const step = STEPS[this.step];
    if (!step || step.button) return;
    if (step.event === type && (!step.match || step.match(payload))) this.advance();
  }

  advance() {
    this.step += 1;
    if (this.step >= STEPS.length) { this.finish(); return; }
    this.render();
  }

  render() {
    const step = STEPS[this.step];
    this.overlay.classList.remove('hidden');
    this.textEl.innerHTML = `<small style="color:var(--text-dim)">教學 ${this.step + 1}/${STEPS.length}</small><br/>${step.text}`;
    this.nextBtn.classList.toggle('hidden', !step.button);
    if (this.step === STEPS.length - 1) this.nextBtn.textContent = '完成';
    else this.nextBtn.textContent = '繼續';
  }

  finish() {
    this.save.data.tutorialCompleted = true;
    this.save.save();
    this.detach();
  }
}
