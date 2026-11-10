import {
  ISTRONG_META_KEY,
  ISTRONG_INLINE_PROJECTILE_KEY,
  ISTRONG_OUTER_BODY_KEY,
  META_FIELD_KEYS,
  type IstrongTankMeta,
  type IstrongTurretMeta,
  type IstrongProjectileMeta,
  type IstrongBodyLayerMeta,
} from '../types/istrongMeta.js';

function readMeta(
  source: Record<string, any> | null | undefined,
  key: string = ISTRONG_META_KEY,
): Record<string, any> | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const raw = source[key];
  if (!raw || typeof raw !== 'object') return undefined;
  return raw;
}

function applyMeta<K extends string>(
  target: Record<string, any>,
  meta: Record<string, any> | undefined,
  keys: ReadonlyArray<K>,
): boolean {
  if (!meta) return false;
  let applied = false;
  for (const k of keys) {
    const v = meta[k];
    if (v === undefined || v === null) continue;
    target[k] = v;
    applied = true;
  }
  return applied;
}

export function readTankMeta(source: Record<string, any> | null | undefined): IstrongTankMeta | undefined {
  const m = readMeta(source);
  return m as IstrongTankMeta | undefined;
}

export function applyTankMeta(target: Record<string, any>, source: Record<string, any> | null | undefined): boolean {
  const m = readMeta(source);
  return applyMeta(target, m, META_FIELD_KEYS.tank);
}

export function readTurretMeta(source: Record<string, any> | null | undefined): IstrongTurretMeta | undefined {
  const m = readMeta(source);
  return m as IstrongTurretMeta | undefined;
}

export function applyTurretMeta(target: Record<string, any>, source: Record<string, any> | null | undefined): boolean {
  const m = readMeta(source);
  return applyMeta(target, m, META_FIELD_KEYS.turret);
}

export function readProjectileMeta(source: Record<string, any> | null | undefined): IstrongProjectileMeta | undefined {
  const m = readMeta(source);
  return m as IstrongProjectileMeta | undefined;
}

export function applyProjectileMeta(target: Record<string, any>, source: Record<string, any> | null | undefined): boolean {
  const m = readMeta(source);
  return applyMeta(target, m, META_FIELD_KEYS.projectile);
}

export function readBodyLayerMeta(source: Record<string, any> | null | undefined): IstrongBodyLayerMeta | undefined {
  const m = readMeta(source);
  return m as IstrongBodyLayerMeta | undefined;
}

export function applyBodyLayerMeta(target: Record<string, any>, source: Record<string, any> | null | undefined): boolean {
  const m = readMeta(source);
  return applyMeta(target, m, META_FIELD_KEYS.bodyLayer);
}

export function applyProjectileMetaInline(target: Record<string, any>, source: Record<string, any> | null | undefined): boolean {
  const m = readMeta(source, ISTRONG_INLINE_PROJECTILE_KEY);
  return applyMeta(target, m, META_FIELD_KEYS.projectile);
}

export function applyOuterBodyLayerMeta(target: Record<string, any>, source: Record<string, any> | null | undefined): boolean {
  const m = readMeta(source, ISTRONG_OUTER_BODY_KEY);
  return applyMeta(target, m, META_FIELD_KEYS.bodyLayer);
}
