// ═══ GameSession：一局遊戲的狀態機與主更新邏輯 ═══
// 狀態：falling → (lock) → resolving →(連鎖循環)→ falling / won / over
import { EventBus } from './EventBus.js';
import { makeRng, randomSeed } from './Random.js';
import { Board, applyStartingBlocks, ensureCellUidAbove } from '../board/Board.js';
import { PieceQueue } from '../board/PieceQueue.js';
import { Piece } from '../board/Piece.js';
import { SHAPE_BY_ID } from '../data/pieces.js';
import { runPass } from '../alchemy/ReactionResolver.js';
import { tickLockTimers } from '../alchemy/ReactionEffects.js';
import { ScoreSystem } from '../systems/ScoreSystem.js';
import { SpellSystem } from '../systems/SpellSystem.js';
import { BossSystem } from '../systems/BossSystem.js';
import { ObjectiveTracker } from '../systems/LevelSystem.js';
import { aggregateRelicMods } from '../systems/RelicSystem.js';
import { ENDLESS_CONFIG, LEVELS } from '../data/levels.js';
import { REACTION_BY_ID } from '../data/reactions.js';
import {
  BASE_FALL_MS, SOFT_DROP_MS, LOCK_DELAY_MS, LOCK_RESET_MAX,
  RESOLVE_STEP_MS, FAST_RESOLVE_STEP_MS, MAX_CHAIN, ENERGY_MAX,
  HARD_DROP_SCORE_PER_ROW, SOFT_DROP_SCORE_PER_ROW,
  ENDLESS_SPEED_STEP, ENDLESS_MIN_FALL_MS,
} from '../config.js';

export class GameSession {
  constructor(app, mode, levelDef = null, seed = null, resume = null) {
    this.app = app;
    this.mode = mode; // 'level' | 'endless'
    this.levelDef = levelDef;
    this.bus = new EventBus();
    this.rng = makeRng(seed ?? randomSeed());
    this.audio = app.audio;
    this.fx = app.renderer;

    const cfg = mode === 'endless'
      ? { availableElements: [...ENDLESS_CONFIG.availableElements], elementWeights: {}, specialRates: ENDLESS_CONFIG.specialRates }
      : levelDef;

    this.board = new Board();
    if (mode === 'level' && levelDef.startingBlocks?.length) {
      applyStartingBlocks(this.board, levelDef.startingBlocks, this.rng, cfg.availableElements);
    }
    this.queue = new PieceQueue(this.rng, cfg);
    // pity：反應目標所需元素太久沒出現時強制補給
    if (mode === 'level') {
      const pity = new Set();
      for (const o of levelDef.objectives) {
        if (o.type === 'reaction') {
          for (const el of REACTION_BY_ID[o.reactionId]?.elements ?? []) {
            if (cfg.availableElements.includes(el)) pity.add(el);
          }
        }
      }
      this.queue.pityElements = [...pity];
    }
    this.score = new ScoreSystem();
    this.energy = 0;
    this.relicMods = aggregateRelicMods(app.save.data.ownedRelics);
    this.spells = new SpellSystem(this);
    this.objectives = mode === 'level' ? new ObjectiveTracker(this, levelDef) : null;
    this.boss = (mode === 'level' && levelDef.boss) ? new BossSystem(this, levelDef.boss) : null;

    this.state = 'spawn';
    this.piece = null;
    this.holdPiece = null;
    this.holdUsed = false;
    this.softDrop = false;
    this.fallTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.resolveTimer = 0;
    this.fastResolve = false;
    this.chain = 0;
    this.maxChain = 0;
    this.lockCount = 0;
    this.elapsed = 0;
    this.endlessLevel = 1;
    this.rerollsUsed = 0;
    this.corruptionCancelled = false;
    this.canReact = true;
    this.timeLeft = (mode === 'level' && levelDef.timeLimit)
      ? (levelDef.timeLimit + this.relicMods.timeLimitBonus) * 1000 : null;

    this.stats = { reactions: 0, byType: {}, lines: 0, quads: 0, cores: 0, resonances: 0 };
    this.bus.on('reaction', ({ def }) => {
      this.stats.reactions += 1;
      this.stats.byType[def.id] = (this.stats.byType[def.id] ?? 0) + 1;
      this.audio.play(def.elements.length === 3 ? 'triple' : 'reaction', { pitch: def.priority / 20 });
    });
    this.bus.on('lines', ({ count }) => {
      this.stats.lines += count;
      if (count >= 4) this.stats.quads += 1;
      this.audio.play('line');
    });
    this.bus.on('resonance', () => { this.stats.resonances += 1; });
    this.bus.on('coreCreated', () => { this.stats.cores += 1; this.audio.play('core'); });

    this.spawnPiece();
    if (resume) this.applyResume(resume);
  }

  // ═══ 中途存檔：只在 falling（棋盤穩定）時可序列化 ═══
  serialize() {
    if (this.state !== 'falling' || !this.piece) return null;
    const pieceData = (p) => p ? { shape: p.shape.id, cells: p.cells.map(c => ({ ...c })) } : null;
    return {
      mode: this.mode,
      levelId: this.levelDef?.id ?? null,
      rngState: this.rng.getState(),
      board: {
        grid: this.board.grid.map(row => row.map(cell => cell ? { ...cell } : null)),
        lockSeq: this.board.lockSeq,
      },
      queue: {
        pieces: this.queue.queue.map(pieceData),
        bag: this.queue.bag.map(s => s.id),
        recentElements: [...this.queue.recentElements],
        pityStreaks: { ...this.queue.pityStreaks },
        elements: [...this.queue.elements],
      },
      piece: { ...pieceData(this.piece), x: this.piece.x, y: this.piece.y, rot: this.piece.rot },
      hold: pieceData(this.holdPiece),
      holdUsed: this.holdUsed,
      score: this.score.score,
      energy: this.energy,
      lockCount: this.lockCount,
      elapsed: this.elapsed,
      timeLeft: this.timeLeft,
      endlessLevel: this.endlessLevel,
      rerollsUsed: this.rerollsUsed,
      corruptionCancelled: this.corruptionCancelled,
      maxChain: this.maxChain,
      spellsUsed: { ...this.spells.usedCounts },
      boss: this.boss ? { hp: this.boss.hp, locks: this.boss.locksSinceAttack } : null,
      objectives: this.objectives?.items.map(i => ({ progress: i.progress, done: i.done })) ?? null,
      stats: JSON.parse(JSON.stringify(this.stats)),
    };
  }

  applyResume(d) {
    const revive = (pd) => {
      if (!pd) return null;
      return new Piece(SHAPE_BY_ID[pd.shape], pd.cells.map(c => ({ ...c })));
    };
    this.board.grid = d.board.grid.map(row => row.map(cell => cell ? { ...cell } : null));
    this.board.lockSeq = d.board.lockSeq;
    this.board.version += 1;
    this.rng.setState(d.rngState);

    const q = this.queue;
    q.queue = d.queue.pieces.map(revive);
    q.bag = d.queue.bag.map(id => SHAPE_BY_ID[id]);
    q.recentElements = [...d.queue.recentElements];
    q.pityStreaks = { ...d.queue.pityStreaks };
    q.elements = [...d.queue.elements];

    this.piece = revive(d.piece);
    this.piece.x = d.piece.x;
    this.piece.y = d.piece.y;
    this.piece.rot = d.piece.rot;
    this.holdPiece = revive(d.hold);
    this.holdUsed = d.holdUsed;
    this.score.score = d.score;
    this.energy = d.energy;
    this.lockCount = d.lockCount;
    this.elapsed = d.elapsed;
    this.timeLeft = d.timeLeft;
    this.endlessLevel = d.endlessLevel;
    this.rerollsUsed = d.rerollsUsed;
    this.corruptionCancelled = d.corruptionCancelled;
    this.maxChain = d.maxChain;
    this.spells.usedCounts = { ...d.spellsUsed };
    if (this.boss && d.boss) {
      this.boss.hp = d.boss.hp;
      this.boss.locksSinceAttack = d.boss.locks;
    }
    if (this.objectives && d.objectives) {
      this.objectives.items.forEach((item, i) => {
        if (d.objectives[i]) {
          item.progress = d.objectives[i].progress;
          item.done = d.objectives[i].done;
        }
      });
    }
    this.stats = JSON.parse(JSON.stringify(d.stats));

    // 新格 id 不得與還原格衝突（hitGuard 以 id 去重）
    let maxId = 0;
    this.board.forEach((r, c, cell) => { maxId = Math.max(maxId, cell.id || 0); });
    for (const p of [this.piece, this.holdPiece, ...q.queue]) {
      if (p) for (const cell of p.cells) maxId = Math.max(maxId, cell.id || 0);
    }
    ensureCellUidAbove(maxId);

    this.state = 'falling';
    this.fallTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.bus.emit('objectivesChanged', {});
    this.app.saveMidGame?.(this);
  }

  addEnergy(n) {
    this.energy = Math.min(ENERGY_MAX, this.energy + n);
  }

  currentFallMs() {
    let ms = this.mode === 'endless'
      ? Math.max(BASE_FALL_MS - (this.endlessLevel - 1) * ENDLESS_SPEED_STEP, ENDLESS_MIN_FALL_MS)
      : (this.levelDef.fallMs ?? BASE_FALL_MS);
    if (this.boss) ms /= this.boss.speedMult;
    return ms;
  }

  spawnPiece() {
    this.piece = this.queue.shift();
    this.holdUsed = false;
    this.fallTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    if (!this.piece.fits(this.board, this.piece.x, this.piece.y, this.piece.rot)) {
      this.gameOver('blocked');
      return;
    }
    this.state = 'falling';
    this.app.saveMidGame?.(this); // 每次生成新拼塊 = 穩定檢查點
  }

  // ── 玩家輸入 ──
  handleAction(action) {
    if (this.state === 'over' || this.state === 'won') return;
    this.bus.emit('playerAction', action);
    if (this.state !== 'falling' || !this.piece) {
      // 解析中按住 ↓ 或按 Space：快轉連鎖演出
      if (this.state === 'resolving' && (action === 'softOn' || action === 'hard')) this.fastResolve = true;
      if (action === 'softOff') { this.softDrop = false; this.fastResolve = false; }
      return;
    }
    switch (action) {
      case 'left':
        if (this.piece.tryMove(this.board, -1, 0)) { this.audio.play('move'); this.onMoveReset(); }
        break;
      case 'right':
        if (this.piece.tryMove(this.board, 1, 0)) { this.audio.play('move'); this.onMoveReset(); }
        break;
      case 'cw':
        if (this.piece.tryRotate(this.board, 1)) { this.audio.play('rotate'); this.onMoveReset(); }
        break;
      case 'ccw':
        if (this.piece.tryRotate(this.board, -1)) { this.audio.play('rotate'); this.onMoveReset(); }
        break;
      case 'softOn': this.softDrop = true; break;
      case 'softOff': this.softDrop = false; break;
      case 'hard': this.hardDrop(); break;
      case 'hold': this.doHold(); break;
    }
  }

  onMoveReset() {
    // lock delay 期間有限次重置，防無限旋轉拖延
    if (this.piece.isGrounded(this.board) && this.lockResets < LOCK_RESET_MAX) {
      this.lockTimer = 0;
      this.lockResets += 1;
    }
  }

  hardDrop() {
    const gy = this.piece.ghostY(this.board);
    const dist = gy - this.piece.y;
    this.piece.y = gy;
    if (dist > 0) this.score.addRaw(dist * HARD_DROP_SCORE_PER_ROW);
    this.audio.play('hard');
    this.lockPiece(); // 瞬降立即鎖定
  }

  doHold() {
    if (this.holdUsed) { this.audio.play('denied'); return; }
    const cur = this.piece;
    const fresh = new Piece(cur.shape, cur.cells); // 重置旋轉與位置
    if (this.holdPiece) {
      const swap = this.holdPiece;
      if (!swap.fits(this.board, swap.x, swap.y, swap.rot)) { this.audio.play('denied'); return; }
      this.piece = swap;
    } else {
      this.piece = this.queue.shift();
      if (!this.piece.fits(this.board, this.piece.x, this.piece.y, this.piece.rot)) {
        this.gameOver('blocked');
        return;
      }
    }
    this.holdPiece = fresh;
    this.holdUsed = true;
    this.fallTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.audio.play('hold');
  }

  reroll() {
    if (this.rerollsUsed >= this.relicMods.rerollPerLevel) return;
    this.rerollsUsed += 1;
    this.queue.rerollNext();
    this.audio.play('hold');
  }

  // ── 主更新（暫停時 App 不呼叫 → 一切停止）──
  update(dt) {
    if (this.state === 'falling') {
      this.elapsed += dt;
      if (this.timeLeft != null) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.objectives?.sync(this.score.score, this.elapsed / 1000);
          if (this.objectives?.isComplete()) this.victory();
          else this.gameOver('time');
          return;
        }
      }

      const interval = this.softDrop ? SOFT_DROP_MS : this.currentFallMs();
      this.fallTimer += dt;
      while (this.fallTimer >= interval && this.piece) {
        this.fallTimer -= interval;
        if (this.piece.tryMove(this.board, 0, 1)) {
          if (this.softDrop) this.score.addRaw(SOFT_DROP_SCORE_PER_ROW);
          this.lockTimer = 0;
        } else break;
      }

      if (this.piece && this.piece.isGrounded(this.board)) {
        this.lockTimer += dt;
        if (this.lockTimer >= LOCK_DELAY_MS) this.lockPiece();
      }

      // 狀態型目標對帳與勝利檢查（棋盤穩定時才判定）
      if (this.state === 'falling') {
        this.objectives?.sync(this.score.score, this.elapsed / 1000);
        if (this.objectives?.isComplete()) this.victory();
      }
    } else if (this.state === 'resolving') {
      this.resolveTimer += dt;
      if (this.resolveTimer >= (this.fastResolve ? FAST_RESOLVE_STEP_MS : RESOLVE_STEP_MS)) {
        this.resolveTimer = 0;
        this.stepResolve();
      }
    }
  }

  lockPiece() {
    if (this.state !== 'falling' || !this.piece) return; // 防重複鎖定
    this.state = 'locking';
    this.board.lock(this.piece.blocks());
    this.piece = null;
    this.softDrop = false;
    this.lockCount += 1;
    this.audio.play('lock');
    this.bus.emit('lock', { count: this.lockCount });
    this.spells.cancel(); // 落地時取消未完成的目標選擇
    this.boss?.onLock();
    tickLockTimers(this);
    this.startResolution();
  }

  // 由鎖定或法術觸發；chain 重新起算
  startResolution() {
    if (this.state === 'resolving' || this.state === 'over' || this.state === 'won') return;
    this.chain = 0;
    this.state = 'resolving';
    this.resolveTimer = RESOLVE_STEP_MS; // 第一個 pass 立即執行
  }

  stepResolve() {
    if (this.chain >= MAX_CHAIN) {
      console.warn('[Resolver] 連鎖達安全上限', MAX_CHAIN);
      this.finishResolution();
      return;
    }
    const { acted } = runPass(this, this.chain + 1);
    if (acted) {
      this.chain += 1;
      if (this.chain > this.maxChain) this.maxChain = this.chain;
      this.bus.emit('chainReached', { chain: this.chain });
      if (this.chain >= 2) {
        this.fx?.bigText(`Chain ×${this.chain}!`);
        this.audio.play('chain', { chain: this.chain });
      }
    } else {
      this.finishResolution();
    }
  }

  finishResolution() {
    this.fastResolve = false;
    this.bus.emit('chainEnd', { chain: this.chain });

    if (this.board.stackReachedTop()) { this.gameOver('topout'); return; }
    if (this.boss?.dead) { this.victory(); return; }
    this.objectives?.sync(this.score.score, this.elapsed / 1000);
    if (this.objectives?.isComplete()) { this.victory(); return; }
    if (this.mode === 'level' && this.levelDef.moveLimit && this.lockCount >= this.levelDef.moveLimit) {
      this.gameOver('moves');
      return;
    }

    if (this.mode === 'endless') this.updateEndlessLevel();

    if (this.piece) {
      // 法術引發的解析：拼塊還在空中，若被重力填入的格子重疊則上推
      while (!this.piece.fits(this.board, this.piece.x, this.piece.y, this.piece.rot) && this.piece.y > 0) {
        this.piece.y -= 1;
      }
      this.state = 'falling';
    } else {
      this.spawnPiece();
    }
  }

  updateEndlessLevel() {
    const newLevel = Math.floor(this.score.score / ENDLESS_CONFIG.scorePerLevel) + 1;
    if (newLevel > this.endlessLevel) {
      this.endlessLevel = newLevel;
      this.fx?.bigText(`等級 ${newLevel}！速度提升`);
      for (const [lv, el] of Object.entries(ENDLESS_CONFIG.elementUnlocks)) {
        if (newLevel >= Number(lv)) this.queue.addElement(el);
      }
    }
  }

  victory() {
    if (this.state === 'won' || this.state === 'over') return;
    this.state = 'won';
    this.spells.cancel();
    this.audio.play('victory');
    this.app.onSessionEnd(this, true);
  }

  gameOver(reason) {
    if (this.state === 'won' || this.state === 'over') return;
    this.state = 'over';
    this.overReason = reason;
    this.spells.cancel();
    this.audio.play('fail');
    this.app.onSessionEnd(this, false);
  }

  destroy() {
    this.objectives?.destroy();
    this.boss?.destroy();
    this.bus.clear();
  }
}

export function starsFor(levelDef, score) {
  let stars = 1;
  if (score >= levelDef.star2Score) stars = 2;
  if (score >= levelDef.star3Score) stars = 3;
  return stars;
}

export { LEVELS };
