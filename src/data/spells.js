// ═══ 法術資料表 ═══
export const SPELLS = [
  {
    id: 'transmute', name: '元素轉化', icon: '🜍', cost: 25,
    targeted: 'cell', needElementPick: true, perLevelLimit: Infinity,
    description: '選擇棋盤中一格，將其轉化為指定基礎元素。',
  },
  {
    id: 'hammer', name: '賢者之錘', icon: '🔨', cost: 30,
    targeted: 'cell', needElementPick: false, perLevelLimit: Infinity,
    description: '敲除一個普通方塊；對障礙方塊造成一次傷害。',
  },
  {
    id: 'gravity', name: '重力逆轉', icon: '🜃', cost: 40,
    targeted: null, needElementPick: false, perLevelLimit: Infinity,
    description: '將所有未被支撐的方塊重新向下整理，可能觸發新反應。',
  },
  {
    id: 'resonate', name: '元素共鳴', icon: '🜁', cost: 50,
    targeted: null, needElementPick: true, perLevelLimit: Infinity,
    description: '將棋盤中 4 個隨機普通方塊轉為同一元素。',
  },
  {
    id: 'philostone', name: '賢者之石', icon: '🜎', cost: 100,
    targeted: 'rowcol', needElementPick: false, perLevelLimit: 1,
    description: '清除一整行或一整列。每關限用一次。',
  },
];

export const SPELL_BY_ID = Object.fromEntries(SPELLS.map(s => [s.id, s]));
