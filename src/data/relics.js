// ═══ 遺物資料表：以 modifiers 供各系統查詢，不在系統內硬編碼 ═══
export const RELICS = [
  {
    id: 'fire_ring', name: '火焰戒指', icon: '💍',
    description: '火系反應分數 +20%。',
    modifiers: { reactionScoreMult: { element: 'fire', mult: 1.2 } },
  },
  {
    id: 'tide_flask', name: '潮汐瓶', icon: '🧪',
    description: '水系反應額外提供 5 點煉金能量。',
    modifiers: { reactionEnergyBonus: { element: 'water', bonus: 5 } },
  },
  {
    id: 'earth_amulet', name: '大地護符', icon: '🪨',
    description: '岩石障礙可被任何反應波及摧毀。',
    modifiers: { rockSoftener: true },
  },
  {
    id: 'wind_feather', name: '風之羽', icon: '🪶',
    description: '每關可免費重抽一次「下一個」拼塊。',
    modifiers: { rerollPerLevel: 1 },
  },
  {
    id: 'light_mirror', name: '光明鏡', icon: '🪞',
    description: '每關第一次腐蝕擴散自動取消。',
    modifiers: { cancelFirstCorruption: true },
  },
  {
    id: 'shadow_tome', name: '暗影書', icon: '📖',
    description: '暗系反應分數 +30%，但詛咒火焰多殘留 1 個腐蝕方塊。',
    modifiers: { reactionScoreMult: { element: 'shadow', mult: 1.3 }, extraCurse: 1 },
  },
  {
    id: 'sage_hourglass', name: '賢者沙漏', icon: '⏳',
    description: '有時間限制的關卡，時限 +30 秒。',
    modifiers: { timeLimitBonus: 30 },
  },
  {
    id: 'twin_crucible', name: '雙生坩堝', icon: '⚗️',
    description: '雙元素反應有 12% 機率獲得雙倍分數與能量。',
    modifiers: { twinChance: 0.12 },
  },
];

export const RELIC_BY_ID = Object.fromEntries(RELICS.map(r => [r.id, r]));

// 過完這些關卡後提供三選一
export const RELIC_OFFER_AFTER_LEVELS = [3, 6, 9];
