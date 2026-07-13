// ═══ 成就資料表（條件判定在 AchievementSystem）═══
export const ACHIEVEMENTS = [
  { id: 'first_reaction', name: '初次煉成', icon: '⚗️', description: '觸發你的第一個元素反應。' },
  { id: 'chain5', name: '連鎖大師', icon: '🔗', description: '單次落塊達成 5 連鎖。' },
  { id: 'quad', name: '四行齊消', icon: '📏', description: '一次消除 4 行。' },
  { id: 'core_maker', name: '核心煉成師', icon: '💠', description: '以 7 個以上相連元素生成強化核心。' },
  { id: 'eclipse_seen', name: '晝夜交蝕', icon: '🌓', description: '觸發虛空淨化。' },
  { id: 'triple_alchemist', name: '三相賢者', icon: '🜍', description: '觸發任一三元素反應。' },
  { id: 'all_pairs', name: '反應大全', icon: '📖', description: '發現全部 12 種雙元素反應。' },
  { id: 'boss_slayer', name: '魔像剋星', icon: '👹', description: '擊敗腐化煉金魔像。' },
  { id: 'star_collector', name: '摘星者', icon: '⭐', description: '累計獲得 15 顆關卡星星。' },
  { id: 'endless_10k', name: '不眠工坊', icon: '♾️', description: '無限模式單局達 10,000 分。' },
  { id: 'purifier', name: '淨化者', icon: '✨', description: '累計淨化 20 個腐蝕方塊。' },
  { id: 'spell_master', name: '法術師', icon: '🪄', description: '累計施放 15 次法術。' },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
