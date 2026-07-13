// ═══ 元素資料表（新增元素只改這裡＋反應表）═══
export const ELEMENTS = {
  fire: {
    id: 'fire', name: '火元素', nameEn: 'Fire',
    color: '#e8593a', secondaryColor: '#ffb35c', icon: 'flame',
    rarity: 1, baseScore: 10, tags: ['hot', 'destructive'],
    description: '燃燒、爆炸、擴散傷害。煉金爐中最狂野的力量。',
    unlockedAtLevel: 1,
  },
  water: {
    id: 'water', name: '水元素', nameEn: 'Water',
    color: '#3d7de8', secondaryColor: '#7fd0ff', icon: 'drop',
    rarity: 1, baseScore: 10, tags: ['cold', 'purify'],
    description: '冷卻、蒸氣、淨化。萬物溶劑，反應的媒介。',
    unlockedAtLevel: 1,
  },
  earth: {
    id: 'earth', name: '土元素', nameEn: 'Earth',
    color: '#a4713a', secondaryColor: '#d9b06a', icon: 'gem',
    rarity: 1, baseScore: 10, tags: ['solid', 'growth'],
    description: '形成岩石、植物、結晶。承載一切的根基。',
    unlockedAtLevel: 3,
  },
  air: {
    id: 'air', name: '風元素', nameEn: 'Air',
    color: '#4fc9b8', secondaryColor: '#b0f5ec', icon: 'gust',
    rarity: 1, baseScore: 10, tags: ['swift', 'spread'],
    description: '擴散、推動、雷電。看不見卻無所不在。',
    unlockedAtLevel: 4,
  },
  light: {
    id: 'light', name: '光元素', nameEn: 'Light',
    color: '#e9c95a', secondaryColor: '#fff6d0', icon: 'star',
    rarity: 2, baseScore: 15, tags: ['holy', 'amplify'],
    description: '淨化、增幅、連鎖加成。賢者追尋的輝光。',
    unlockedAtLevel: 7,
  },
  shadow: {
    id: 'shadow', name: '暗元素', nameEn: 'Shadow',
    color: '#6d4bb8', secondaryColor: '#2a1f4d', icon: 'moon',
    rarity: 2, baseScore: 15, tags: ['corrupt', 'devour'],
    description: '腐蝕、吞噬、轉化。禁忌之力，慎用之。',
    unlockedAtLevel: 8,
  },
};

export const ELEMENT_IDS = Object.keys(ELEMENTS);
export const BASE_FOUR = ['fire', 'water', 'earth', 'air'];

export function elementOf(id) { return ELEMENTS[id]; }
