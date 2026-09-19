import { getUnit, TRAITS, type TraitDef, type TraitId } from './balance';

export interface ActiveTrait {
  trait: TraitDef;
  /** Distinct units with the trait. */
  count: number;
  /** 0 when below the first threshold. */
  tier: 0 | 1 | 2;
}

/** Traits count each unit once, however many copies or stars are on the board. */
export function activeTraits(unitIds: readonly string[]): ActiveTrait[] {
  const distinct = [...new Set(unitIds)];
  return TRAITS.map((trait) => {
    const count = distinct.filter((id) => {
      const unit = getUnit(id);
      return unit.origin === trait.id || unit.role === trait.id;
    }).length;
    const tier = count >= trait.thresholds[1] ? 2 : count >= trait.thresholds[0] ? 1 : 0;
    return { trait, count, tier };
  });
}

/** The trait's bonus for a unit that has it, or 0. */
export function traitBonus(traits: readonly ActiveTrait[], id: TraitId): number {
  const active = traits.find((entry) => entry.trait.id === id);
  return active && active.tier > 0 ? active.trait.values[active.tier - 1] : 0;
}
