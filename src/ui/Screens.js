// ═══ 畫面／modal 管理（選單、關卡選擇、圖鑑、設定、暫停、結算、遺物、確認）═══
import { LEVELS } from '../data/levels.js';
import { ELEMENTS } from '../data/elements.js';
import { ALL_REACTIONS, RESONANCE_INFO, CORE_INFO } from '../data/reactions.js';
import { RELICS, RELIC_BY_ID } from '../data/relics.js';
import { drawElementIcon } from './BoardRenderer.js';

const $ = (id) => document.getElementById(id);

export class Screens {
  constructor(app) {
    this.app = app;
    this.confirmCb = null;
    this.elementPickCb = null;

    // 主選單
    $('btn-start').addEventListener('click', () => app.startLevel(1));
    $('btn-continue').addEventListener('click', () => app.continueGame());
    $('btn-levels').addEventListener('click', () => { this.buildLevelSelect(); this.show('levels'); });
    $('btn-endless').addEventListener('click', () => app.startEndless());
    $('btn-codex').addEventListener('click', () => { this.buildCodex('elements'); this.show('codex'); });
    $('btn-settings').addEventListener('click', () => { this.syncSettings(); this.show('settings'); });
    $('btn-wipe').addEventListener('click', () => this.confirm('清除存檔', '所有進度、星級與圖鑑都會刪除，確定嗎？', () => app.wipeSave()));

    for (const btn of document.querySelectorAll('[data-back]')) {
      btn.addEventListener('click', () => this.show('menu'));
    }

    // 圖鑑 tabs
    $('tab-elements').addEventListener('click', () => this.buildCodex('elements'));
    $('tab-reactions').addEventListener('click', () => this.buildCodex('reactions'));

    // 設定
    $('set-sfx').addEventListener('change', (e) => app.setSetting('sfx', e.target.checked));
    $('set-music').addEventListener('change', (e) => app.setSetting('music', e.target.checked));
    $('set-volume').addEventListener('input', (e) => app.setSetting('volume', Number(e.target.value)));
    $('set-reduced').addEventListener('change', (e) => app.setSetting('reduced', e.target.checked));
    $('btn-replay-tutorial').addEventListener('click', () => {
      app.save.data.tutorialCompleted = false;
      app.save.save();
      this.toast('教學已重置', '下次進入第 1 關時會重新播放');
    });

    // 暫停
    $('btn-pause').addEventListener('click', () => app.togglePause());
    $('btn-resume').addEventListener('click', () => app.togglePause());
    $('btn-restart').addEventListener('click', () => { this.hideModal('pause'); app.restart(); });
    $('btn-quit').addEventListener('click', () => { this.hideModal('pause'); app.quitToMenu(); });
    $('pause-sfx').addEventListener('change', (e) => app.setSetting('sfx', e.target.checked));
    $('pause-reduced').addEventListener('change', (e) => app.setSetting('reduced', e.target.checked));

    // 結算
    $('btn-next-level').addEventListener('click', () => { this.hideModal('result'); app.nextLevel(); });
    $('btn-retry').addEventListener('click', () => { this.hideModal('result'); app.restart(); });
    $('btn-result-menu').addEventListener('click', () => { this.hideModal('result'); app.quitToMenu(); });

    // 確認
    $('btn-confirm-yes').addEventListener('click', () => { this.hideModal('confirm'); this.confirmCb?.(); });
    $('btn-confirm-no').addEventListener('click', () => this.hideModal('confirm'));

    // 元素選擇
    $('btn-cancel-pick').addEventListener('click', () => { this.hideModal('element-pick'); this.elementPickCb = null; });
  }

  show(name) {
    for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
    $(`screen-${name}`).classList.add('active');
    if (name === 'menu') this.syncMenu();
  }

  showModal(name) { $(`modal-${name}`).classList.remove('hidden'); }
  hideModal(name) { $(`modal-${name}`).classList.add('hidden'); }

  syncMenu() {
    const d = this.app.save.data;
    const hasProgress = d.unlockedLevels > 1 || Object.keys(d.levelStars).length > 0;
    $('btn-continue').classList.toggle('hidden', !hasProgress);
  }

  syncSettings() {
    const s = this.app.save.data.settings;
    $('set-sfx').checked = s.sfx;
    $('set-music').checked = s.music;
    $('set-volume').value = s.volume;
    $('set-reduced').checked = s.reduced;
  }

  syncPauseSettings() {
    const s = this.app.save.data.settings;
    $('pause-sfx').checked = s.sfx;
    $('pause-reduced').checked = s.reduced;
  }

  buildLevelSelect() {
    const grid = $('level-grid');
    grid.innerHTML = '';
    const d = this.app.save.data;
    for (const lv of LEVELS) {
      const locked = lv.id > d.unlockedLevels;
      const stars = d.levelStars[lv.id] ?? 0;
      const card = document.createElement('button');
      card.className = 'level-card' + (locked ? ' locked' : '') + (lv.isBoss ? ' boss-card' : '');
      card.setAttribute('aria-label', `第 ${lv.id} 關 ${lv.name}${locked ? '（未解鎖）' : ''}`);
      card.innerHTML = `
        <h3>${lv.isBoss ? '👹 ' : ''}第 ${lv.id} 關 · ${lv.name}</h3>
        <div class="lv-desc">${lv.description}</div>
        <div class="lv-stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span>
          ${d.highScores[lv.id] ? `<small style="float:right;color:var(--text-dim);letter-spacing:0">${d.highScores[lv.id].toLocaleString()}</small>` : ''}</div>`;
      if (!locked) card.addEventListener('click', () => this.app.startLevel(lv.id));
      grid.appendChild(card);
    }
  }

  buildCodex(tab) {
    $('tab-elements').classList.toggle('active', tab === 'elements');
    $('tab-reactions').classList.toggle('active', tab === 'reactions');
    const wrap = $('codex-content');
    wrap.innerHTML = '';
    const d = this.app.save.data;

    if (tab === 'elements') {
      for (const el of Object.values(ELEMENTS)) {
        const discovered = d.discoveredElements.includes(el.id) || el.unlockedAtLevel <= d.unlockedLevels;
        const card = document.createElement('div');
        card.className = 'codex-card' + (discovered ? '' : ' undiscovered');
        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = 44; iconCanvas.height = 44;
        const g = iconCanvas.getContext('2d');
        if (discovered) {
          g.fillStyle = el.color;
          g.beginPath(); g.roundRect(2, 2, 40, 40, 8); g.fill();
          drawElementIcon(g, el.id, 22, 22, 40);
        } else {
          g.fillStyle = '#333';
          g.beginPath(); g.roundRect(2, 2, 40, 40, 8); g.fill();
          g.fillStyle = '#777'; g.font = '20px sans-serif';
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText('?', 22, 23);
        }
        const info = document.createElement('div');
        info.innerHTML = discovered
          ? `<h4>${el.name} ${el.nameEn}</h4><p>${el.description}</p>
             <div class="codex-meta">核心：${CORE_INFO[el.id]?.name ?? ''} — ${CORE_INFO[el.id]?.desc ?? ''}</div>`
          : `<h4>？？？</h4><p>於第 ${el.unlockedAtLevel} 關解鎖。</p>`;
        card.appendChild(iconCanvas);
        card.appendChild(info);
        wrap.appendChild(card);
      }
    } else {
      const entries = [...ALL_REACTIONS].sort((a, b) => a.elements.length - b.elements.length);
      for (const rx of entries) {
        const rec = d.discoveredReactions[rx.id];
        const card = document.createElement('div');
        card.className = 'codex-card' + (rec ? '' : ' undiscovered');
        const icon = document.createElement('div');
        icon.className = 'codex-icon';
        icon.style.background = rec ? rx.color : '#333';
        icon.style.color = '#1a1630';
        icon.textContent = rec ? (rx.elements.length === 3 ? '☲' : '☯') : '?';
        const info = document.createElement('div');
        if (rec) {
          const els = rx.elements.map(e => ELEMENTS[e].name).join('＋');
          info.innerHTML = `<h4>${rx.name} ${rx.nameEn}</h4><p>${els}</p><p>${rx.description}</p>
            <div class="codex-meta">觸發 ${rec.count} 次 · 最高單次 ${rec.bestScore.toLocaleString()} 分 · 首次發現 ${new Date(rec.firstAt).toLocaleDateString()}</div>`;
        } else {
          const hint = ELEMENTS[rx.elements[0]].name;
          info.innerHTML = `<h4>？？？</h4><p>${rx.elements.length} 種元素的反應，其中之一是「${hint}」…</p>`;
        }
        card.appendChild(icon);
        card.appendChild(info);
        wrap.appendChild(card);
      }
      // 共鳴說明（永遠顯示）
      const card = document.createElement('div');
      card.className = 'codex-card';
      card.innerHTML = `<div class="codex-icon" style="background:#8877cc">◈</div>
        <div><h4>${RESONANCE_INFO.name} ${RESONANCE_INFO.nameEn}</h4><p>${RESONANCE_INFO.description}</p></div>`;
      wrap.appendChild(card);
    }
  }

  showResult({ won, title, stars, rows, canNext }) {
    $('result-title').textContent = title;
    $('result-stars').innerHTML = won
      ? `${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span>` : '';
    $('result-body').innerHTML = rows.map(r => r.section
      ? `<div class="result-section">${r.html}</div>` : `<div>${r.html}</div>`).join('');
    $('btn-next-level').classList.toggle('hidden', !canNext);
    this.showModal('result');
  }

  offerRelics(candidates, onPick) {
    const wrap = $('relic-choices');
    wrap.innerHTML = '';
    for (const id of candidates) {
      const relic = RELIC_BY_ID[id];
      const card = document.createElement('button');
      card.className = 'relic-card';
      card.setAttribute('aria-label', `選擇遺物 ${relic.name}`);
      card.innerHTML = `<div class="relic-icon">${relic.icon}</div><h4>${relic.name}</h4><p>${relic.description}</p>`;
      card.addEventListener('click', () => {
        this.hideModal('relic');
        onPick(id);
      });
      wrap.appendChild(card);
    }
    this.showModal('relic');
  }

  pickElement(elements, cb) {
    const wrap = $('element-pick-list');
    wrap.innerHTML = '';
    this.elementPickCb = cb;
    for (const id of elements) {
      const el = ELEMENTS[id];
      const btn = document.createElement('button');
      btn.className = 'element-pick-btn';
      btn.style.background = `linear-gradient(180deg, ${el.secondaryColor}, ${el.color})`;
      btn.setAttribute('aria-label', el.name);
      const cv = document.createElement('canvas');
      cv.width = 30; cv.height = 30;
      drawElementIcon(cv.getContext('2d'), id, 15, 15, 30);
      btn.appendChild(cv);
      btn.appendChild(document.createTextNode(el.name));
      btn.addEventListener('click', () => {
        this.hideModal('element-pick');
        const fn = this.elementPickCb;
        this.elementPickCb = null;
        fn?.(id);
      });
      wrap.appendChild(btn);
    }
    this.showModal('element-pick');
  }

  confirm(title, text, cb) {
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    this.confirmCb = cb;
    this.showModal('confirm');
  }

  toast(title, sub = '') {
    const area = $('toast-area');
    const div = document.createElement('div');
    div.className = 'toast';
    div.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    area.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  }

  // 法術目標提示列
  showTargetHint(spell, spellSystem) {
    const hint = $('target-hint');
    hint.innerHTML = '';
    hint.classList.remove('hidden');
    const label = document.createElement('span');
    label.textContent = `${spell.icon} ${spell.name}：點擊棋盤目標`;
    hint.appendChild(label);
    if (spell.targeted === 'rowcol') {
      const mkBtn = (mode, text) => {
        const b = document.createElement('button');
        b.textContent = text;
        b.dataset.mode = mode;
        b.className = spellSystem.pending?.rcMode === mode ? 'sel' : '';
        b.addEventListener('click', () => {
          spellSystem.setRcMode(mode);
          for (const x of hint.querySelectorAll('button[data-mode]')) {
            x.classList.toggle('sel', x.dataset.mode === mode);
          }
        });
        return b;
      };
      hint.appendChild(mkBtn('row', '整行'));
      hint.appendChild(mkBtn('col', '整列'));
    }
    const cancel = document.createElement('button');
    cancel.textContent = '取消';
    cancel.addEventListener('click', () => spellSystem.cancel());
    hint.appendChild(cancel);
  }

  hideTargetHint() { $('target-hint').classList.add('hidden'); }
}
