import { GUN_STAT_KEYS, DEFAULT_GUN_STATS } from '../constants/gunStats.js';
import type { GunStats } from '../constants/gunStats.js';

export function combineStats(arr: any): GunStats {
  const out: any = { ...DEFAULT_GUN_STATS };
  if (!Array.isArray(arr)) return out;
  for (const k of GUN_STAT_KEYS) {
    let val = 1;
    for (const obj of arr) {
      if (obj && typeof obj === 'object' && typeof obj[k] === 'number') {
        val *= obj[k];
      }
    }
    out[k] = val;
  }
  return out;
}

export function weaponArray(angles: number[] | number, basePosition: number[]): any[] {
  const list: number[] = Array.isArray(angles) ? angles : (typeof angles === 'number' ? [angles] : []);
  const out: any[] = [];
  for (const a of list) {
    const pos = [...basePosition];
    pos[5] = a;
    out.push({ POSITION: pos });
  }
  return out;
}

export function ensureIsClass(Class: Record<string, any>, str: any): any {
  if (typeof str === 'object') return str;
  if (str in Class) return Class[str];
  return { LABEL: str, _className: typeof str === 'string' ? str : undefined };
}

export function makeConfigProxy(): any {
  return new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'spawn_class') return 'basic';
      if (prop === 'LEVEL_CAP') return 45;
      if (prop === 'SKILL_CAP') return 9;
      if (prop === 'TIER_CAP') return 9;
      if (prop === 'TIER_MULT') return 15;
      if (prop === 'level_cap') return 45;
      if (prop === 'skill_cap') return 9;
      if (prop === 'tier_multiplier') return 15;
      return undefined;
    }
  });
}
