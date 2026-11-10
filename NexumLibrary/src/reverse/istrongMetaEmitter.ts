import {
  ISTRONG_META_KEY,
  ISTRONG_INLINE_PROJECTILE_KEY,
  ISTRONG_OUTER_BODY_KEY,
  ISTRONG_META_VERSION,
  META_FIELD_KEYS,
  type IstrongTankMeta,
  type IstrongTurretMeta,
  type IstrongProjectileMeta,
  type IstrongBodyLayerMeta,
} from '../types/istrongMeta.js';

function pickDefined<K extends string>(
  source: Record<string, any> | null | undefined,
  keys: ReadonlyArray<K>,
): Record<K, any> | undefined {
  if (!source || typeof source !== 'object') return undefined;
  let hasAny = false;
  const out = {} as Record<K, any>;
  for (const k of keys) {
    const v = source[k];
    if (v === undefined || v === null) continue;
    out[k] = v;
    hasAny = true;
  }
  return hasAny ? out : undefined;
}

function attachMeta(
  target: Record<string, any>,
  meta: Record<string, any> | undefined,
  key: string = ISTRONG_META_KEY,
): void {
  if (!meta) return;
  target[key] = { v: ISTRONG_META_VERSION, ...meta };
}

export function emitTankMeta(target: Record<string, any>, tank: any): void {
  const meta = pickDefined<keyof IstrongTankMeta>(tank, META_FIELD_KEYS.tank);
  if (meta && !(typeof tank?.tankShieldCapacity === 'number' && tank.tankShieldCapacity < 54)) delete meta.tankShieldCapacity;
  if (meta && tank?.keepOwnColor === true) {
    delete meta.tankColor;
    if (Object.keys(meta).length === 0) return;
  }
  attachMeta(target, meta);
}

export function emitTurretMeta(target: Record<string, any>, turret: any): void {
  const meta = pickDefined<keyof IstrongTurretMeta>(turret, META_FIELD_KEYS.turret);
  attachMeta(target, meta);
}

export function emitProjectileMeta(target: Record<string, any>, projectileType: any): void {
  const meta = pickDefined<keyof IstrongProjectileMeta>(projectileType, META_FIELD_KEYS.projectile);
  attachMeta(target, meta);
}

export function emitBodyLayerMeta(target: Record<string, any>, layer: any): void {
  const meta = pickDefined<keyof IstrongBodyLayerMeta>(layer, META_FIELD_KEYS.bodyLayer);
  attachMeta(target, meta);
}

export function emitProjectileMetaInline(target: Record<string, any>, projectileType: any): void {
  const meta = pickDefined<keyof IstrongProjectileMeta>(projectileType, META_FIELD_KEYS.projectile);
  attachMeta(target, meta, ISTRONG_INLINE_PROJECTILE_KEY);
}

export function emitOuterBodyLayerMeta(target: Record<string, any>, layer: any): void {
  const meta = pickDefined<keyof IstrongBodyLayerMeta>(layer, META_FIELD_KEYS.bodyLayer);
  attachMeta(target, meta, ISTRONG_OUTER_BODY_KEY);
}
