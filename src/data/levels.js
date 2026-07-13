// ═══ 關卡資料表（資料驅動；startingBlocks 由下而上鋪在棋盤底部）═══
// 圖例：F火 W水 E土 A風 L光 S暗 R岩石 X不可破壞岩石 C腐蝕 K鎖鏈 I冰封 G金色 .空
// objectives type: score / lines / clearElement / reaction / anyPair / tripleReaction /
//                  resonance / createCore / chain / clearCorrupt / destroyRocks / survive

export const LEVELS = [
  {
    id: 1, name: '入門講堂', description: '學會移動、旋轉與消行。只有火與水。',
    availableElements: ['fire', 'water'],
    elementWeights: { fire: 1, water: 1 },
    specialRates: {},
    startingBlocks: [],
    objectives: [
      { type: 'lines', target: 2 },
      { type: 'score', target: 600 },
    ],
    moveLimit: null, timeLimit: null,
    fallMs: 900,
    star2Score: 4000, star3Score: 8000,
    tutorial: true,
  },
  {
    id: 2, name: '蒸氣初啼', description: '讓火與水相鄰，觸發你的第一個煉金反應。',
    availableElements: ['fire', 'water'],
    elementWeights: { fire: 1, water: 1 },
    specialRates: {},
    startingBlocks: ['W.F.W.F.W.'],
    objectives: [
      { type: 'reaction', reactionId: 'steam', target: 3 },
    ],
    moveLimit: null, timeLimit: null,
    fallMs: 880,
    star2Score: 4500, star3Score: 9000,
  },
  {
    id: 3, name: '大地初醒', description: '土元素加入。以水潤土，見證生長。',
    availableElements: ['fire', 'water', 'earth'],
    elementWeights: { fire: 0.8, water: 1.1, earth: 1.1 },
    specialRates: {},
    startingBlocks: ['E.E.E.E.E.'],
    objectives: [
      { type: 'reaction', reactionId: 'growth', target: 2 },
      { type: 'lines', target: 3 },
    ],
    moveLimit: null, timeLimit: null,
    fallMs: 850,
    star2Score: 6000, star3Score: 12000,
  },
  {
    id: 4, name: '風起雲湧', description: '風元素加入。火借風勢，焚盡一切。',
    availableElements: ['fire', 'water', 'earth', 'air'],
    elementWeights: { fire: 1.1, water: 0.8, earth: 0.8, air: 1.1 },
    specialRates: { gold: 0.02 },
    startingBlocks: [],
    objectives: [
      { type: 'reaction', reactionId: 'firestorm', target: 2 },
      { type: 'score', target: 3000 },
    ],
    moveLimit: null, timeLimit: null,
    fallMs: 820,
    star2Score: 8000, star3Score: 16000,
  },
  {
    id: 5, name: '頑石擋道', description: '岩石不含元素，用火焰風暴或熔岩摧毀它們。',
    availableElements: ['fire', 'water', 'earth', 'air'],
    elementWeights: { fire: 1.1, water: 0.9, earth: 1.0, air: 1.0 },
    specialRates: { gold: 0.02 },
    startingBlocks: [
      '.R..RR..R.',
      'R.R....R.R',
    ],
    objectives: [
      { type: 'destroyRocks', target: 5 },
      { type: 'lines', target: 4 },
    ],
    moveLimit: null, timeLimit: null,
    fallMs: 800,
    star2Score: 9000, star3Score: 18000,
  },
  {
    id: 6, name: '共鳴之歌', description: '4 個相同元素相連即共鳴；5 個以上凝成元素核心。',
    availableElements: ['fire', 'water', 'earth', 'air'],
    elementWeights: { fire: 1, water: 1, earth: 1, air: 1 },
    specialRates: { gold: 0.02, ether: 0.015 },
    startingBlocks: [],
    objectives: [
      { type: 'resonance', target: 3 },
      { type: 'createCore', target: 1 },
    ],
    moveLimit: null, timeLimit: null,
    fallMs: 780,
    star2Score: 10000, star3Score: 20000,
  },
  {
    id: 7, name: '輝光降臨', description: '光元素加入。聖泉、雷電與生命晶石聽候差遣。',
    availableElements: ['fire', 'water', 'earth', 'air', 'light'],
    elementWeights: { fire: 0.7, water: 1.0, earth: 0.7, air: 1.1, light: 1.4 },
    specialRates: { gold: 0.025, ether: 0.015 },
    startingBlocks: [],
    objectives: [
      { type: 'reaction', reactionId: 'lightning', target: 2 },
      { type: 'reaction', reactionId: 'holyspring', target: 1 },
    ],
    moveLimit: null, timeLimit: null,
    fallMs: 760,
    star2Score: 12000, star3Score: 22000,
  },
  {
    id: 8, name: '暗影滋長', description: '暗元素與腐蝕現身。腐蝕會擴散，儘快淨化。',
    availableElements: ['fire', 'water', 'earth', 'air', 'light', 'shadow'],
    elementWeights: { fire: 0.9, water: 1.0, earth: 0.8, air: 0.9, light: 1.0, shadow: 0.8 },
    specialRates: { gold: 0.02, ether: 0.015 },
    startingBlocks: [
      '..C....C..',
      '.C......C.',
    ],
    objectives: [
      { type: 'clearCorrupt', target: 4 },
      { type: 'score', target: 6000 },
    ],
    moveLimit: null, timeLimit: null,
    fallMs: 740,
    star2Score: 13000, star3Score: 24000,
  },
  {
    id: 9, name: '晝夜交蝕', description: '讓光與暗相鄰，見證最稀有的湮滅反應。',
    availableElements: ['fire', 'water', 'earth', 'air', 'light', 'shadow'],
    elementWeights: { fire: 0.6, water: 0.6, earth: 0.6, air: 0.6, light: 1.5, shadow: 1.5 },
    specialRates: { gold: 0.02, ether: 0.02 },
    startingBlocks: [],
    objectives: [
      { type: 'reaction', reactionId: 'eclipse', target: 1 },
      { type: 'chain', target: 3 },
    ],
    moveLimit: null, timeLimit: null,
    fallMs: 720,
    star2Score: 14000, star3Score: 26000,
  },
  {
    id: 10, name: '三相合一', description: '三種元素齊聚一點，引發高階煉金術。',
    availableElements: ['fire', 'water', 'earth', 'air', 'light', 'shadow'],
    elementWeights: { fire: 1, water: 1, earth: 1, air: 1, light: 0.9, shadow: 0.9 },
    specialRates: { gold: 0.025, ether: 0.02, rune: 0.012 },
    startingBlocks: [],
    objectives: [
      { type: 'tripleReaction', target: 1 },
      { type: 'score', target: 8000 },
    ],
    moveLimit: null, timeLimit: null,
    fallMs: 700,
    star2Score: 16000, star3Score: 30000,
  },
  {
    id: 11, name: '限量委託', description: '工坊接到急件：步數有限，效率至上。',
    availableElements: ['fire', 'water', 'earth', 'air', 'light', 'shadow'],
    elementWeights: { fire: 1, water: 1, earth: 1, air: 1, light: 0.9, shadow: 0.9 },
    specialRates: { gold: 0.03, ether: 0.02, rune: 0.015 },
    startingBlocks: [
      '.K......K.',
      'IWIF..IEIA',
    ],
    objectives: [
      { type: 'lines', target: 6 },
      { type: 'anyPair', target: 6 },
    ],
    moveLimit: 45, timeLimit: null,
    fallMs: 680,
    star2Score: 18000, star3Score: 32000,
  },
  {
    id: 12, name: '腐化煉金魔像', description: '第一章 Boss。以高階反應與連鎖擊碎魔像。',
    availableElements: ['fire', 'water', 'earth', 'air', 'light', 'shadow'],
    elementWeights: { fire: 1, water: 1, earth: 1, air: 1, light: 1.1, shadow: 0.7 },
    specialRates: { gold: 0.02, ether: 0.02, rune: 0.012 },
    startingBlocks: [
      '..C.RR.C..',
    ],
    objectives: [
      { type: 'boss', target: 1 },
    ],
    moveLimit: null, timeLimit: null,
    fallMs: 700,
    star2Score: 20000, star3Score: 36000,
    boss: 'corrupted_golem',
    isBoss: true,
  },
];

export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map(l => [l.id, l]));

// 無限模式設定
export const ENDLESS_CONFIG = {
  name: '無限模式',
  availableElements: ['fire', 'water', 'earth', 'air'],
  // 依等級逐步解鎖元素與特殊方塊
  elementUnlocks: { 3: 'light', 5: 'shadow' },
  specialRates: { gold: 0.02, ether: 0.012, rune: 0.008 },
  scorePerLevel: 3000, // 每 3000 分升一級
};
