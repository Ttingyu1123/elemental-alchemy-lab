// ═══ 遺物效果聚合：各系統只查 mods，不各自硬編碼遺物邏輯 ═══
import { RELIC_BY_ID } from '../data/relics.js';

export function aggregateRelicMods(ownedIds) {
  const mods = {
    scoreMultByElement: {},
    energyBonusByElement: {},
    rockSoftener: false,
    extraCurse: 0,
    rerollPerLevel: 0,
    cancelFirstCorruption: false,
    timeLimitBonus: 0,
    twinChance: 0,
  };
  for (const id of ownedIds) {
    const relic = RELIC_BY_ID[id];
    if (!relic) continue;
    const m = relic.modifiers;
    if (m.reactionScoreMult) {
      const { element, mult } = m.reactionScoreMult;
      mods.scoreMultByElement[element] = (mods.scoreMultByElement[element] ?? 1) * mult;
    }
    if (m.reactionEnergyBonus) {
      const { element, bonus } = m.reactionEnergyBonus;
      mods.energyBonusByElement[element] = (mods.energyBonusByElement[element] ?? 0) + bonus;
    }
    if (m.rockSoftener) mods.rockSoftener = true;
    if (m.extraCurse) mods.extraCurse += m.extraCurse;
    if (m.rerollPerLevel) mods.rerollPerLevel += m.rerollPerLevel;
    if (m.cancelFirstCorruption) mods.cancelFirstCorruption = true;
    if (m.timeLimitBonus) mods.timeLimitBonus += m.timeLimitBonus;
    if (m.twinChance) mods.twinChance += m.twinChance;
  }
  return mods;
}
