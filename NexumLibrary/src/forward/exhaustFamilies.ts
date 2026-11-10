import type { Registry } from '../types/arras.js';
import { upgradeTreeOf, familyMembers, type UpgradeTree } from './rightClickFamilies.js';

export const LAUNCHER_FAMILY_ROOT = 'launcher';

export function launcherFamilyOf(tree: UpgradeTree): Set<string> {
  return familyMembers(LAUNCHER_FAMILY_ROOT, tree);
}

const familyByRegistry = new WeakMap<Registry, Set<string>>();
export function launcherFamilyOfRegistry(registry: Registry): Set<string> {
  let f = familyByRegistry.get(registry);
  if (!f) { f = launcherFamilyOf(upgradeTreeOf(registry)); familyByRegistry.set(registry, f); }
  return f;
}

export function applyExhaustRule(tankConfig: any, className: string, launcherFamily: Set<string>, isV2Dreadnought: boolean): number {
  const inLauncher = launcherFamily.has(className);
  if (!inLauncher && !isV2Dreadnought) return 0;
  const want = isV2Dreadnought ? false : true;
  let changed = 0;
  const seen = new Set<any>();
  const walk = (o: any): void => {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) { for (const x of o) walk(x); return; }
    const riders = o.customProjectileDesign?.turrets;
    if (Array.isArray(riders)) {
      for (const g of riders) {
        if (!g || g.turretType === 'auto' || g.turretType === 'decorative' || !g.projectileType) continue;
        if (g.projectileType.persistsAfterDeath !== want) { g.projectileType.persistsAfterDeath = want; changed++; }
      }
    }
    for (const k of Object.keys(o)) walk(o[k]);
  };
  walk(tankConfig);
  return changed;
}
