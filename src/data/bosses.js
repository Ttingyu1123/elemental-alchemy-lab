// ═══ Boss 資料表 ═══
export const BOSSES = {
  corrupted_golem: {
    id: 'corrupted_golem',
    name: '腐化煉金魔像',
    maxHp: 1200,
    // 每 N 次落塊施放一次技能
    attackEveryLocks: 4,
    phases: [
      { hpAbove: 0.7, label: '第一階段', attack: 'corrupt2', desc: '生成腐蝕方塊' },
      { hpAbove: 0.4, label: '第二階段', attack: 'chains', desc: '生成鎖鏈方塊', speedMult: 1 },
      { hpAbove: 0.2, label: '第三階段', attack: 'corrupt2', desc: '加速＋腐蝕', speedMult: 1.35 },
      { hpAbove: 0,   label: '狂怒階段', attack: 'potion', desc: '投擲不穩定藥劑', speedMult: 1.5 },
    ],
    damage: {
      pairReaction: 22,
      tripleReaction: 65,
      eclipse: 85,
      resonance: 15,
      core: 28,
      linePer: 10, // 穩定化改版後消行更常見，上修消行傷害

    },
  },
};
