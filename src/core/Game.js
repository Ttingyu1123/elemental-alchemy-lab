// ═══ GameSession：一局遊戲的狀態機與主更新邏輯 ═══
// 狀態：falling → (lock) → resolving →(連鎖循環)→ falling / won / over
import { EventBus } from './EventBus.js';
import { makeRng, randomSeed } from './Random.js';
import { Board, applyStartingBlocks } from '../board/Board.js';
import { PieceQueue } from '../board/PieceQueue.js';
import { Piece } from '../board/Piece.js';
import { runPass } from '../alchemy/ReactionResolver.js';
import { tickLockTimers } from '../alchemy/ReactionEffects.js';
import { ScoreSystem } from '../systems/ScoreSystem.js';
import { SpellSystem } from '../systems/SpellSystem.js';
import { BossSystem } from '../systems/BossSystem.js';
import { ObjectiveTracker } from '../systems/LevelSystem.js';
import { aggregateRelicMods } from '../systems/RelicSystem.js';
import { ENDLESS_CONFIG, LEVELS } from '../data/levels.js';
import {
  BASE_FALL_MS, SOFT_DROP_MS, LOCK_DELAY_MS, LOCK_RESET_MAX,
  RESOLVE_STEP_MS, MAX_CHAIN, ENERGY_MAX,
  HARD_DROP_SCORE_PER_ROW, SOFT_DROP_SCORE_PER_ROW,
  ENDLESS_SPEED_STEP, ENDLESS_MIN_FALL_MS,
} from '../config.js';

export class GameSession {
  constructor(app, mode, levelDef = null, seed = null) {
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
  }

  // ── 玩家輸入 ──
  handleAction(action) {
    if (this.state === 'over' || this.state === 'won') return;
    this.bus.emit('playerAction', action);
    if (this.state !== 'falling' || !this.piece) {
      if (action === 'softOff') this.softDrop = false;
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
      if (this.resolveTimer >= RESOLVE_STEP_MS) {
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
