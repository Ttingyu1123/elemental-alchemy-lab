// ═══ 全域遊戲常數（單一正本，其他模組不得自帶魔術數字）═══
export const COLS = 10;
export const VISIBLE_ROWS = 20;
export const HIDDEN_ROWS = 4;
export const TOTAL_ROWS = VISIBLE_ROWS + HIDDEN_ROWS;

// 輸入
export const DAS_MS = 150;   // 按住後開始連續移動的延遲
export const ARR_MS = 42;    // 連續移動間隔

// 鎖定
export const LOCK_DELAY_MS = 520;
export const LOCK_RESET_MAX = 10; // lock delay 期間允許的移動/旋轉重置次數上限

// 下落速度（ms / 格）
export const BASE_FALL_MS = 820;
export const SOFT_DROP_MS = 38;
export const ENDLESS_SPEED_STEP = 60;  // 無限模式每升一級加速
export const ENDLESS_MIN_FALL_MS = 90;

// 反應解析
export const RESOLVE_STEP_MS = 300;  // 每個連鎖 pass 間的演出間隔
export const MAX_CHAIN = 30;         // 安全連鎖上限

// 分數
export const LINE_SCORES = [0, 100, 300, 600, 1000];
export const HARD_DROP_SCORE_PER_ROW = 2;
export const SOFT_DROP_SCORE_PER_ROW = 1;

export function chainMultiplier(chain) {
  if (chain <= 1) return 1;
  if (chain === 2) return 1.5;
  if (chain === 3) return 2;
  if (chain === 4) return 3;
  return Math.min(3 + (chain - 4) * 0.5, 8); // Chain 5+ 遞增，上限 ×8
}

// 能量
export const ENERGY_MAX = 100;
export const ENERGY_PAIR = 6;
export const ENERGY_TRIPLE = 14;
export const ENERGY_RESONANCE = 5;
export const ENERGY_CORE = 8;
export const ENERGY_CRYSTAL = 18;

// 特殊方塊生成（關卡可覆寫）
export const DEFAULT_SPECIAL_RATES = { ether: 0.015, gold: 0.02, rune: 0.01 };

// 粒子上限
export const MAX_PARTICLES = 320;

// 存檔
export const SAVE_KEY = 'eal_save';
export const SAVE_VERSION = 1;
