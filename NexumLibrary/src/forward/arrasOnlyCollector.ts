import type { ArrasClassDef } from '../types/arras.js';

const MAPPED_TANK_KEYS = new Set<string>([
  'PARENT',
  'NAME',
  'LABEL',
  'COLOR',
  'SHAPE',
  'SIZE',
  'BODY',
  'HEALTH_WITH_LEVEL',
  'CONTROLLERS',
  'FACING_TYPE',
  'SKILL_CAP',
  'SKILL',
  'EXTRA_SKILL',
  'GUNS',
  'TURRETS',
  'MAX_CHILDREN',
  'HAS_NO_RECOIL',
  'TYPE',
  'HEALER',
  'IS_SMASHER',
  'HEALING_TANK',
  'INVISIBLE',
  'ARENA_CLOSER',
  'DRAW_HEALTH',
]);

const MAPPED_BODY_KEYS = new Set<string>([
  'HEALTH',
  'DAMAGE',
  'SPEED',
  'REGEN',
  'SHIELD',
  'FOV',
  'PUSHABILITY',
]);

const MAPPED_GUN_PROPERTIES = new Set<string>([
  'TYPE',
  'SHOOT_SETTINGS',
  'AUTOFIRE',
  'SYNCS_SKILLS',
  'MAX_CHILDREN',
  'MAX_BULLETS',
  'ALT_FIRE',
  'NEGATIVE_RECOIL',
  'HAS_NO_RECOIL',
  'INDEPENDENT',
  'PERSISTS_AFTER_DEATH',
  'SHOOT_ON_DEATH',
  'NECRO',
  'HEALER',
  'GUN_STAT_SCALE',
  'DRAW_ABOVE',
  'WAIT_TO_CYCLE',
  'DELAY_SPAWN',
  'DESTROY_OLDEST_CHILD',
  'CONTROLLERS',
  'HITS_OWN_TYPE',
  'MOTION_TYPE',
  'FACING_TYPE',
  'STAT_CALCULATOR',
  'INDEPENDENT_CHILDREN',
]);

const MAPPED_PROJECTILE_KEYS = new Set<string>([
  'PARENT',
  'LABEL',
  'NAME',
  'TYPE',
  'COLOR',
  'SHAPE',
  'SIZE',
  'BODY',
  'CONTROLLERS',
  'FACING_TYPE',
  'MOTION_TYPE',
  'GUNS',
  'TURRETS',
  'MAX_CHILDREN',
  'HITS_OWN_TYPE',
  'PERSISTS_AFTER_DEATH',
  'NECRO',
  'INDEPENDENT',
  'HEALER',
  'INVISIBLE',
]);

function deepClone(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deepClone);
  const out: Record<string, any> = {};
  for (const k of Object.keys(value)) {
    out[k] = deepClone((value as any)[k]);
  }
  return out;
}

export function collectTankArrasOnly(classDef: ArrasClassDef | undefined): Record<string, any> | undefined {
  if (!classDef || typeof classDef !== 'object') return undefined;
  const out: Record<string, any> = {};
  let hasAny = false;
  for (const key of Object.keys(classDef)) {
    if (key.startsWith('_')) continue;
    if (MAPPED_TANK_KEYS.has(key)) continue;
    out[key] = deepClone((classDef as any)[key]);
    hasAny = true;
  }
  const body = (classDef as any).BODY;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const unmappedBody: Record<string, any> = {};
    let hasBody = false;
    for (const bKey of Object.keys(body)) {
      if (bKey.startsWith('_')) continue;
      if (MAPPED_BODY_KEYS.has(bKey)) continue;
      unmappedBody[bKey] = deepClone(body[bKey]);
      hasBody = true;
    }
    if (hasBody) {
      out.BODY = unmappedBody;
      hasAny = true;
    }
  }
  if ((classDef as any).COLOR === -1) {
    out.COLOR = -1;
    hasAny = true;
  }
  return hasAny ? out : undefined;
}

export function collectGunArrasOnly(properties: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!properties || typeof properties !== 'object') return undefined;
  const out: Record<string, any> = {};
  let hasAny = false;
  for (const key of Object.keys(properties)) {
    if (key.startsWith('_')) continue;
    if (MAPPED_GUN_PROPERTIES.has(key)) continue;
    out[key] = deepClone(properties[key]);
    hasAny = true;
  }
  return hasAny ? out : undefined;
}

export function collectProjectileArrasOnly(classDef: ArrasClassDef | undefined): Record<string, any> | undefined {
  if (!classDef || typeof classDef !== 'object') return undefined;
  const out: Record<string, any> = {};
  let hasAny = false;
  for (const key of Object.keys(classDef)) {
    if (key.startsWith('_')) continue;
    if (MAPPED_PROJECTILE_KEYS.has(key)) continue;
    out[key] = deepClone((classDef as any)[key]);
    hasAny = true;
  }
  const body = (classDef as any).BODY;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const unmappedBody: Record<string, any> = {};
    let hasBody = false;
    for (const bKey of Object.keys(body)) {
      if (bKey.startsWith('_')) continue;
      if (MAPPED_BODY_KEYS.has(bKey)) continue;
      unmappedBody[bKey] = deepClone(body[bKey]);
      hasBody = true;
    }
    if (hasBody) {
      out.BODY = unmappedBody;
      hasAny = true;
    }
  }
  if ((classDef as any).COLOR === -1) {
    out.COLOR = -1;
    hasAny = true;
  }
  return hasAny ? out : undefined;
}
