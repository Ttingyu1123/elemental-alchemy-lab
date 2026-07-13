// ═══ HUD：讀取 session 狀態更新 DOM（單向：UI 不改遊戲資料）═══
import { drawPiecePreview } from './BoardRenderer.js';
import { ENERGY_MAX } from '../config.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(onSpellClick, onReroll) {
    this.onSpellClick = onSpellClick;
    this.onReroll = onReroll;
    this.els = {
      score: $('score-display'), chain: $('chain-display'), maxchain: $('maxchain-display'),
      energyBar: $('energy-bar'), energyText: $('energy-text'),
      levelName: $('level-name'), objectives: $('objective-list'), limit: $('limit-display'),
      spellPanel: $('spell-panel'), log: $('reaction-log'),
      next: $('next-canvas'), hold: $('hold-canvas'),
      bossPanel: $('boss-panel'), bossName: $('boss-name'), bossHp: $('boss-hp'),
      bossPhase: $('boss-phase'), bossNext: $('boss-next'),
      speedLabel: $('speed-label'), speed: $('speed-display'),
      reroll: $('btn-reroll'),
    };
    this.spellButtons = {};
    this.unsubs = [];
    this.els.reroll.addEventListener('click', () => this.onReroll());
  }

  bindSession(sess) {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.els.log.innerHTML = '';
    this.buildSpellPanel(sess);
    this.rebuildObjectives(sess);
    this.els.levelName.textContent = sess.mode === 'endless'
      ? '無限模式' : `第 ${sess.levelDef.id} 關：${sess.levelDef.name}`;

    // Boss 面板
    if (sess.boss) {
      this.els.bossPanel.classList.remove('hidden');
      this.els.bossName.textContent = sess.boss.def.name;
    } else {
      this.els.bossPanel.classList.add('hidden');
    }

    // 無限模式顯示等級
    this.els.speedLabel.classList.toggle('hidden', sess.mode !== 'endless');
    this.els.speed.classList.toggle('hidden', sess.mode !== 'endless');

    // 風之羽重抽
    this.updateReroll(sess);

    const bus = sess.bus;
    this.unsubs.push(bus.on('reaction', ({ def, chain, score, twin }) => {
      this.addLog(`<b>${def.name}</b> +${score}${twin ? ' ×2' : ''}${chain > 1 ? `（Chain ${chain}）` : ''}`);
    }));
    this.unsubs.push(bus.on('resonance', ({ el, size }) => {
      this.addLog(`元素共鳴 ×${size}`);
    }));
    this.unsubs.push(bus.on('lines', ({ count, score }) => {
      this.addLog(`消除 ${count} 行 +${score}`);
    }));
    this.unsubs.push(bus.on('coreCreated', ({ el, strong }) => {
      this.addLog(`${strong ? '強化' : ''}元素核心生成`);
    }));
    this.unsubs.push(bus.on('objectivesChanged', () => this.rebuildObjectives(sess)));
  }

  buildSpellPanel(sess) {
    const panel = this.els.spellPanel;
    panel.innerHTML = '<h3>法術</h3>';
    this.spellButtons = {};
    for (const spell of sess.spells.spells) {
      const btn = document.createElement('button');
      btn.className = 'spell-btn';
      btn.setAttribute('aria-label', `${spell.name}，消耗 ${spell.cost} 能量`);
      btn.title = spell.description;
      btn.innerHTML = `<span>${spell.icon}</span><span>${spell.name}</span><span class="spell-cost">${spell.cost}⚡</span>`;
      btn.addEventListener('click', () => this.onSpellClick(spell.id));
      panel.appendChild(btn);
      this.spellButtons[spell.id] = btn;
    }
  }

  rebuildObjectives(sess) {
    const ul = this.els.objectives;
    ul.innerHTML = '';
    if (!sess.objectives) {
      const li = document.createElement('li');
      li.textContent = '存活越久、分數越高越好！';
      ul.appendChild(li);
      return;
    }
    for (const item of sess.objectives.items) {
      const li = document.createElement('li');
      li.className = item.done ? 'done' : '';
      const prog = item.type === 'boss' ? '' :
        `（${Math.floor(item.progress).toLocaleString()}/${item.target.toLocaleString()}）`;
      li.textContent = `${item.text}${item.done ? '' : prog}`;
      ul.appendChild(li);
    }
  }

  updateReroll(sess) {
    const show = sess.relicMods.rerollPerLevel > 0;
    this.els.reroll.classList.toggle('hidden', !show);
    if (show) this.els.reroll.disabled = sess.rerollsUsed >= sess.relicMods.rerollPerLevel;
  }

  addLog(html) {
    const li = document.createElement('li');
    li.innerHTML = html;
    this.els.log.prepend(li);
    while (this.els.log.children.length > 8) this.els.log.lastChild.remove();
  }

  // 每幀輪詢的輕量更新
  update(sess) {
    const e = this.els;
    e.score.textContent = sess.score.score.toLocaleString();
    e.chain.textContent = sess.state === 'resolving' && sess.chain > 0 ? `×${sess.chain}` : '—';
    e.maxchain.textContent = String(sess.maxChain);
    const pct = Math.round(sess.energy / ENERGY_MAX * 100);
    e.energyBar.style.width = pct + '%';
    e.energyText.textContent = `${Math.floor(sess.energy)}/${ENERGY_MAX}`;

    // 步數／時間限制
    if (sess.mode === 'level' && sess.levelDef.moveLimit) {
      const left = sess.levelDef.moveLimit - sess.lockCount;
      e.limit.textContent = `剩餘步數：${left}`;
      e.limit.classList.toggle('warning', left <= 8);
    } else if (sess.timeLeft != null) {
      const t = Math.max(0, Math.ceil(sess.timeLeft / 1000));
      e.limit.textContent = `剩餘時間：${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      e.limit.classList.toggle('warning', t <= 15);
    } else {
      e.limit.textContent = '';
      e.limit.classList.remove('warning');
    }

    // 法術按鈕狀態
    for (const spell of sess.spells.spells) {
      const btn = this.spellButtons[spell.id];
      if (!btn) continue;
      btn.disabled = !sess.spells.canCast(spell.id) && !(sess.spells.pending?.spell.id === spell.id);
      btn.classList.toggle('active-target', sess.spells.pending?.spell.id === spell.id);
    }

    // Boss
    if (sess.boss) {
      const b = sess.boss;
      e.bossHp.style.width = (b.hp / b.def.maxHp * 100) + '%';
      e.bossPhase.textContent = `${b.phase.label} — ${b.phase.desc}`;
      e.bossNext.textContent = b.dead ? '已擊敗！' : `下次技能：${b.locksUntilAttack} 次落塊後`;
    }

    if (sess.mode === 'endless') e.speed.textContent = String(sess.endlessLevel);

    // 預覽
    const nexts = sess.queue.peek(3);
    const nc = this.els.next;
    nc.getContext('2d').clearRect(0, 0, nc.width, nc.height);
    nexts.forEach((p, i) => drawPiecePreview(nc, p, i, 3));
    const hc = this.els.hold;
    hc.getContext('2d').clearRect(0, 0, hc.width, hc.height);
    if (sess.holdPiece) drawPiecePreview(hc, sess.holdPiece, 0, 1);

    this.updateReroll(sess);
  }
}
