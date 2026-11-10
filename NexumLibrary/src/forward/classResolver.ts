import type { ArrasClassDef, Registry } from '../types/arras.js';

const MERGE_OBJECT_KEYS = new Set(['BODY', 'SHOOT_SETTINGS', 'PROPERTIES', 'STAT_NAMES']);

function resolveParentChain(name: string, registry: Registry, visited: Set<string> = new Set()): ArrasClassDef[] {
  if (visited.has(name)) return [];
  visited.add(name);
  const def = registry.get(name);
  if (!def) return [];
  const chain: ArrasClassDef[] = [def];
  const parent = def.PARENT;
  if (typeof parent === 'string') {
    chain.push(...resolveParentChain(parent, registry, visited));
  } else if (Array.isArray(parent)) {
    for (const p of parent) {
      if (typeof p === 'string') {
        chain.push(...resolveParentChain(p, registry, visited));
      }
    }
  }
  return chain;
}

export function resolveFlat(name: string, registry: Registry): ArrasClassDef {
  const chain = resolveParentChain(name, registry).reverse();
  const merged: any = {};
  for (const def of chain) {
    for (const [k, v] of Object.entries(def)) {
      if (k.startsWith('_')) continue;
      if (MERGE_OBJECT_KEYS.has(k) && v && typeof v === 'object' && !Array.isArray(v)) {
        merged[k] = { ...(merged[k] ?? {}), ...v };
      } else if (v !== undefined) {
        merged[k] = v;
      }
    }
  }
  merged._className = name;
  return merged as ArrasClassDef;
}

export function resolveField<T = any>(name: string, registry: Registry, field: string): T | undefined {
  const chain = resolveParentChain(name, registry);
  for (const def of chain) {
    if ((def as any)[field] !== undefined) return (def as any)[field] as T;
  }
  return undefined;
}

function isInTurretChain(name: string, registry: Registry, visited: Set<string> = new Set()): boolean {
  if (visited.has(name)) return false;
  visited.add(name);
  if (name === 'autoTurret') return true;
  const def = registry.get(name);
  if (!def) return false;
  const p = def.PARENT;
  if (typeof p === 'string') return isInTurretChain(p, registry, visited);
  if (Array.isArray(p)) {
    for (const s of p) {
      if (typeof s === 'string' && isInTurretChain(s, registry, visited)) return true;
    }
  }
  return false;
}

export function classifyEntity(name: string, registry: Registry): 'tank' | 'boss' | 'projectile' | 'turret' | 'other' {
  const flat = resolveFlat(name, registry);
  const parent = flat.PARENT;
  const parentStr = typeof parent === 'string' ? parent : (Array.isArray(parent) ? (typeof parent[0] === 'string' ? parent[0] : '') : '');

  if (parentStr === 'genericBoss' || parentStr.includes('Boss')) return 'boss';
  if (['bullet', 'drone', 'swarm', 'trap', 'minion', 'hive', 'boomerang'].includes(parentStr)) return 'projectile';
  if (isInTurretChain(name, registry)) return 'turret';
  if (parentStr === 'genericTank' || parentStr.includes('Tank')) return 'tank';

  const ent = registry.get(parentStr);
  if (ent) return classifyEntity(parentStr, registry);

  if (flat.GUNS || flat.TURRETS) return 'tank';
  return 'other';
}

export function detectProjectileVisual(typeName: string, registry: Registry): string {
  const flat = resolveFlat(typeName, registry);
  const directType = (flat as any).TYPE;
  if (typeof directType === 'string') {
    const lower = directType.toLowerCase();
    if (['bullet', 'drone', 'swarm', 'trap', 'minion', 'hive', 'boomerang'].includes(lower)) return lower;
  }
  let cur: string | undefined = typeName;
  const visited = new Set<string>();
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    if (cur === 'bullet' || cur === 'drone' || cur === 'swarm' || cur === 'trap' || cur === 'minion' || cur === 'hive' || cur === 'boomerang') {
      return cur;
    }
    const def = registry.get(cur);
    if (!def) break;
    const p = def.PARENT;
    cur = typeof p === 'string' ? p : (Array.isArray(p) && typeof p[0] === 'string' ? p[0] : undefined);
  }
  return 'bullet';
}
