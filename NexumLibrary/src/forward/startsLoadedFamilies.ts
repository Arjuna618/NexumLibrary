import type { Registry } from '../types/arras.js';
import { upgradeTreeOf, familyMembers, type UpgradeTree } from './rightClickFamilies.js';

export const UNDERSEER_FAMILY_ROOT = 'underseer';

export function underseerFamilyOf(tree: UpgradeTree): Set<string> {
  return familyMembers(UNDERSEER_FAMILY_ROOT, tree);
}

const familyByRegistry = new WeakMap<Registry, Set<string>>();
export function underseerFamilyOfRegistry(registry: Registry): Set<string> {
  let f = familyByRegistry.get(registry);
  if (!f) { f = underseerFamilyOf(upgradeTreeOf(registry)); familyByRegistry.set(registry, f); }
  return f;
}

const has = (t: any, type: string): boolean =>
  Array.isArray(t?.projectileBehaviors) && t.projectileBehaviors.some((b: any) => b && b.type === type && b.enabled);

export function applyStartsLoadedRule(
  tankConfig: any,
  className: string,
  underseerFamily: Set<string>,
  make: (type: string, enabled: boolean) => any,
): number {
  if (!underseerFamily.has(className)) return 0;
  let changed = 0;
  for (const t of tankConfig?.turrets || []) {
    if (!t || t.turretType === 'auto' || t.turretType === 'decorative') continue;
    if (!has(t, 'waitToCycle') || has(t, 'startsLoaded')) continue;
    if (t.projectileType?.statCalculatorType !== 'necro') continue;
    const at = t.projectileBehaviors.findIndex((b: any) => b && b.type === 'waitToCycle');
    t.projectileBehaviors.splice(at + 1, 0, make('startsLoaded', true));
    changed++;
  }
  return changed;
}
