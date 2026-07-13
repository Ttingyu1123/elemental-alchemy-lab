// ═══ 反應資料表：所有反應集中定義，效果實作在 alchemy/ReactionEffects.js ═══
// priority 大者先掃描；同一格每個階段只能被一個反應占用

export const PAIR_REACTIONS = [
  {
    id: 'eclipse', name: '虛空淨化', nameEn: 'Eclipse',
    elements: ['light', 'shadow'], priority: 100,
    score: 400, energy: 12, effect: 'eclipse', color: '#c9a7ff',
    description: '光與暗湮滅，清除反應所在的整行與整列。稀有而強大。',
  },
  {
    id: 'steam', name: '蒸氣', nameEn: 'Steam',
    elements: ['fire', 'water'], priority: 50,
    score: 80, energy: 6, effect: 'steam', color: '#cfe8f5',
    description: '水火相遇化為蒸氣，向上清除每格正上方最多 2 格。',
  },
  {
    id: 'growth', name: '生長', nameEn: 'Growth',
    elements: ['water', 'earth'], priority: 50,
    score: 90, energy: 6, effect: 'growth', color: '#69c56a',
    description: '孕育植物方塊並向鄰近空格蔓延；三株相連即整群綻放清除。',
  },
  {
    id: 'firestorm', name: '火焰風暴', nameEn: 'Firestorm',
    elements: ['fire', 'air'], priority: 50,
    score: 120, energy: 6, effect: 'firestorm', color: '#ff8b45',
    description: '烈焰隨風延燒，清除中心十字延伸 2 格；遇岩石而止。',
  },
  {
    id: 'sandstorm', name: '沙暴', nameEn: 'Sandstorm',
    elements: ['earth', 'air'], priority: 48,
    score: 80, energy: 6, effect: 'sandstorm', color: '#d9c07a',
    description: '狂沙推動同列方塊一格；無處可推則凝為沙塵。',
  },
  {
    id: 'lava', name: '熔岩', nameEn: 'Lava',
    elements: ['fire', 'earth'], priority: 50,
    score: 100, energy: 6, effect: 'lava', color: '#e05620',
    description: '生成熔岩方塊，每次反應階段熔化下方一格，最多三次。',
  },
  {
    id: 'frost', name: '冰霜', nameEn: 'Frost',
    elements: ['water', 'air'], priority: 50,
    score: 90, energy: 6, effect: 'frost', color: '#a8e0ff',
    description: '寒氣凝結周圍最多 4 個普通方塊為冰晶；冰晶受反應波及即粉碎得分。',
  },
  {
    id: 'lifecrystal', name: '生命晶石', nameEn: 'Life Crystal',
    elements: ['earth', 'light'], priority: 55,
    score: 130, energy: 6, effect: 'lifecrystal', color: '#b8f0c0',
    description: '結成生命晶石；晶石被消除時恢復大量煉金能量。',
  },
  {
    id: 'holyspring', name: '聖泉', nameEn: 'Holy Spring',
    elements: ['water', 'light'], priority: 55,
    score: 140, energy: 6, effect: 'holyspring', color: '#fff2b0',
    description: '湧出聖泉，滌淨附近所有暗元素與腐蝕；無可淨化時轉為能量。',
  },
  {
    id: 'lightning', name: '雷電', nameEn: 'Lightning',
    elements: ['air', 'light'], priority: 55,
    score: 150, energy: 6, effect: 'lightning', color: '#ffe97a',
    description: '召落雷擊，優先劈碎堆疊最高處的至多 3 個方塊。',
  },
  {
    id: 'cursedflame', name: '詛咒火焰', nameEn: 'Cursed Flame',
    elements: ['fire', 'shadow'], priority: 55,
    score: 200, energy: 8, effect: 'cursedflame', color: '#b04ad0',
    description: '清除大範圍，但殘留 1～2 個詛咒腐蝕方塊。高收益高風險。',
  },
  {
    id: 'corruption', name: '腐蝕', nameEn: 'Corruption',
    elements: ['earth', 'shadow'], priority: 48,
    score: 70, energy: 5, effect: 'corruption', color: '#7a4fa0',
    description: '將附近普通元素轉為暗元素；日後以光淨化可得高額連鎖分。',
  },
];

export const TRIPLE_REACTIONS = [
  {
    id: 'superheat', name: '超熱蒸氣', nameEn: 'Superheated Steam',
    elements: ['fire', 'water', 'air'], priority: 90,
    score: 500, energy: 14, effect: 'superheat', color: '#ffdede',
    description: '爆沸的蒸氣直衝而上，清除反應上方五列寬的大片區域。',
  },
  {
    id: 'worldtree', name: '世界樹', nameEn: 'World Tree',
    elements: ['water', 'earth', 'light'], priority: 92,
    score: 450, energy: 14, effect: 'worldtree', color: '#8be29a',
    description: '種下世界樹之芽；三次落塊後轟然生長，清除大範圍並持續給分。',
  },
  {
    id: 'cataclysm', name: '火山災變', nameEn: 'Volcanic Cataclysm',
    elements: ['fire', 'earth', 'shadow'], priority: 90,
    score: 550, energy: 14, effect: 'cataclysm', color: '#ff5030',
    description: '地底怒火噴發，清除棋盤最下兩行，但殘留少量岩石。',
  },
  {
    id: 'aurora', name: '極光風暴', nameEn: 'Aurora Storm',
    elements: ['water', 'air', 'light'], priority: 92,
    score: 500, energy: 14, effect: 'aurora', color: '#a0ffe0',
    description: '極光橫掃，清除棋盤上「中心附近最多的元素」的所有普通方塊。',
  },
  {
    id: 'desolation', name: '荒蕪', nameEn: 'Desolation',
    elements: ['earth', 'air', 'shadow'], priority: 88,
    score: 380, energy: 12, effect: 'desolation', color: '#9a8f70',
    description: '大地枯朽，數格化為沙塵；限步數內淨化可得高分，逾期則成障礙。',
  },
];

export const ALL_REACTIONS = [...TRIPLE_REACTIONS, ...PAIR_REACTIONS];
export const REACTION_BY_ID = Object.fromEntries(ALL_REACTIONS.map(r => [r.id, r]));

// 共鳴（同元素 4+ 相連）在 ResonanceSystem 處理；圖鑑用的虛擬條目：
export const RESONANCE_INFO = {
  id: 'resonance', name: '元素共鳴', nameEn: 'Resonance',
  description: '4 個以上相同元素相連即共鳴消除；5～6 個生成元素核心，7 個以上生成強化核心。',
};

// 元素核心效果說明（觸發實作在 ReactionEffects.triggerCore）
export const CORE_INFO = {
  fire:   { name: '火焰核心', desc: '爆炸周圍 3×3' },
  water:  { name: '水流核心', desc: '清除同一直列' },
  earth:  { name: '大地核心', desc: '清除同一橫行' },
  air:    { name: '風暴核心', desc: '清除隨機散布的方塊' },
  light:  { name: '光明核心', desc: '清除所有暗元素與腐蝕' },
  shadow: { name: '暗影核心', desc: '吞噬一種隨機元素的所有方塊' },
};
