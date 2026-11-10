import type { ArrasClassDef, Registry } from '../types/arras.js';

let _sharedTurretIdCounter = 0;
export function resetSharedTurretIds(): void { _sharedTurretIdCounter = 0; }
export function nextSharedTurretId(): string {
  return `arras-${++_sharedTurretIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const TARGETING_CONTROLLERS = new Set([
  'nearestDifferentMaster', 'canRepel', 'onlyAcceptInArc', 'mapAltToFire',
  'minion', 'hangOutNearMaster', 'targetSelf', 'mapFireToAlt',
]);

export const TURRET_SPIN_MULT = 2500 / 3;
export const ARRAS_SPIN_MULTIPLIER = 2500 / 3;

export const BODY_OVERLAY_DEFS: Record<string, any> = {
  smasherBody:     { SHAPE: 6, FACING_TYPE: ['spin', { speed: 0.16 }] },
  landmineBody:    { SHAPE: 6, FACING_TYPE: ['spin', { speed: 0.3  }] },
  spikeBody:       { SHAPE: 3, FACING_TYPE: ['spin', { speed: 0.16 }] },
  weirdSpikeBody1: { SHAPE: 3, FACING_TYPE: ['spin', { speed: 0.20 }] },
  weirdSpikeBody2: { SHAPE: 3, FACING_TYPE: ['spin', { speed: -0.17 }] },
  dominationBody:  { SHAPE: 6, FACING_TYPE: ['noFacing', { angle: Math.PI / 2 }] },
};

export const SMASHER_BODY_DEFS: Record<string, any> = {
  smasherBody:     { SHAPE: 6, COLOR: 'black', FACING_TYPE: ['spin', { speed: 0.16 }] },
  landmineBody:    { SHAPE: 6, COLOR: 9,       FACING_TYPE: ['spin', { speed: 0.3  }] },
  spikeBody:       { SHAPE: 3, COLOR: 'black', FACING_TYPE: ['spin', { speed: 0.16 }] },
  weirdSpikeBody1: { SHAPE: 3, COLOR: 'black', FACING_TYPE: ['spin', { speed: 0.20 }] },
  weirdSpikeBody2: { SHAPE: 3, COLOR: 'black', FACING_TYPE: ['spin', { speed: -0.17 }] },
  dominationBody:  { SHAPE: 6, COLOR: 9,       FACING_TYPE: ['noFacing', { angle: Math.PI / 2 }] },
};

export function hasCanRepel(controllers: any[] | null): boolean {
  if (!controllers) return false;
  for (const ctrl of controllers) {
    const name = typeof ctrl === 'string' ? ctrl : (Array.isArray(ctrl) ? ctrl[0] : '');
    if (name === 'canRepel') return true;
  }
  return false;
}

export function isSpinOnlyControllers(controllers: any[]): boolean {
  if (!controllers || !Array.isArray(controllers) || controllers.length === 0) return false;
  for (const ctrl of controllers) {
    const name = typeof ctrl === 'string' ? ctrl : (Array.isArray(ctrl) ? ctrl[0] : '');
    if (typeof name !== 'string') return false;
    if (TARGETING_CONTROLLERS.has(name)) return false;
    if (name !== 'spin' && name !== 'speedControl' && name !== 'reverseSpin') return false;
  }
  return true;
}

export function resolveControllers(turretClass: ArrasClassDef | undefined, registry: Registry): any[] | null {
  let cur: any = turretClass;
  const visited = new Set<string>();
  while (cur) {
    if (cur.CONTROLLERS && Array.isArray(cur.CONTROLLERS) && cur.CONTROLLERS.length > 0) {
      return cur.CONTROLLERS;
    }
    const parentName = typeof cur.PARENT === 'string' ? cur.PARENT : (Array.isArray(cur.PARENT) ? cur.PARENT[0] : null);
    if (!parentName || visited.has(parentName)) break;
    visited.add(parentName);
    cur = registry.get(parentName);
  }
  return null;
}

export function resolveFacingTypeSpin(cls: ArrasClassDef | undefined, registry: Registry): number | null {
  let cur: any = cls;
  const visited = new Set<string>();
  while (cur) {
    const ft = cur.FACING_TYPE;
    if (ft && Array.isArray(ft) && ft[0] === 'spin') {
      return ft[1]?.speed ?? 0;
    }
    const pn = typeof cur.PARENT === 'string' ? cur.PARENT : (Array.isArray(cur.PARENT) ? cur.PARENT[0] : null);
    if (!pn || visited.has(pn)) break;
    visited.add(pn);
    cur = registry.get(pn);
  }
  return null;
}

export function extractControllerSpinSpeed(controllers: any[]): number | null {
  if (!controllers || !Array.isArray(controllers)) return null;
  for (const ctrl of controllers) {
    if (Array.isArray(ctrl) && ctrl[0] === 'spin' && ctrl[1]?.speed !== undefined) {
      return ctrl[1].speed;
    }
  }
  return null;
}

export function hasExplicitlyEmptyControllers(cls: ArrasClassDef | undefined): boolean {
  if (!cls) return false;
  const ctrl = cls.CONTROLLERS;
  return Array.isArray(ctrl) && ctrl.length === 0;
}

export function mapHitsOwnType(arras: string | undefined): string | null {
  if (!arras) return null;
  switch (arras) {
    case 'push': return 'push';
    case 'never': return 'none';
    case 'droneCollision': return 'drone';
    case 'hardWithBuffer': return 'hardWithBuffer';
    case 'repel': return 'push';
    case 'hardOnlyBosses': case 'hardOnlyTanks': return 'drone';
    case 'assembler': return 'assembler';
    default: return null;
  }
}

export function normalizeTurretPosition(raw: any): number[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    return [
      raw.SIZE ?? 10,
      raw.X ?? 0,
      raw.Y ?? 0,
      raw.ANGLE ?? 0,
      raw.ARC ?? 360,
      raw.LAYER ?? 0,
    ];
  }
  return [10, 0, 0, 0, 360, 0];
}

export function hasHealerSymbol(cls: ArrasClassDef | undefined, registry: Registry): boolean {
  let cur: any = cls;
  const visited = new Set<string>();
  while (cur) {
    if (cur.TURRETS && Array.isArray(cur.TURRETS)) {
      for (const td of cur.TURRETS) {
        const tn = typeof td.TYPE === 'string' ? td.TYPE : (Array.isArray(td.TYPE) ? td.TYPE[0] : '');
        if (tn === 'healerSymbol') return true;
      }
    }
    const pn = typeof cur.PARENT === 'string' ? cur.PARENT : (Array.isArray(cur.PARENT) ? cur.PARENT[0] : null);
    if (!pn || visited.has(pn)) break;
    visited.add(pn);
    cur = registry.get(pn);
  }
  return false;
}

export function resolveHealerFlag(cls: ArrasClassDef | undefined, registry: Registry): boolean {
  let cur: any = cls;
  const visited = new Set<string>();
  while (cur) {
    if ((cur as any).HEALER === true) return true;
    const pn = typeof cur.PARENT === 'string' ? cur.PARENT : (Array.isArray(cur.PARENT) ? cur.PARENT[0] : null);
    if (!pn || visited.has(pn)) break;
    visited.add(pn);
    cur = registry.get(pn);
  }
  return false;
}

export function resolveField(cls: ArrasClassDef | undefined, field: string, registry: Registry): any {
  let cur: any = cls;
  const visited = new Set<string>();
  while (cur) {
    if (cur[field] !== undefined) return cur[field];
    const pn = typeof cur.PARENT === 'string' ? cur.PARENT : (Array.isArray(cur.PARENT) ? cur.PARENT[0] : null);
    if (!pn || visited.has(pn)) break;
    visited.add(pn);
    cur = registry.get(pn);
  }
  return undefined;
}

export function resolveBodyNumber(cls: ArrasClassDef | undefined, key: string, registry: Registry): number | undefined {
  let cur: any = cls;
  const visited = new Set<string>();
  while (cur) {
    const v = cur.BODY ? cur.BODY[key] : undefined;
    if (typeof v === 'number') return v;
    const pn = typeof cur.PARENT === 'string' ? cur.PARENT : (Array.isArray(cur.PARENT) ? cur.PARENT[0] : null);
    if (!pn || visited.has(pn)) break;
    visited.add(pn);
    cur = registry.get(pn);
  }
  return undefined;
}

export function resolveBodyOverlayField(turretClass: any, field: string, registry: Registry): any {
  let cur: any = turretClass;
  const visited = new Set<string>();
  while (cur) {
    if (cur[field] !== undefined) return cur[field];
    const pn = typeof cur.PARENT === 'string' ? cur.PARENT : (Array.isArray(cur.PARENT) ? cur.PARENT[0] : null);
    if (!pn || visited.has(pn)) break;
    visited.add(pn);
    cur = registry.get(pn) ?? SMASHER_BODY_DEFS[pn] ?? null;
  }
  return undefined;
}

export function makeBehavior(type: string, enabled: boolean = true): any {
  return {
    type,
    enabled,
    acceptsFromTop: true,
    responseLag: 0.1,
    maxTurnRate: 360,
    predictionStrength: 50,
    targetRange: 0,
    orbitRadius: 100,
    orbitSpeed: 1.5,
    returnSpeed: 1.5,
    maxDistance: 400,
    cohesion: 0.5,
    separation: 0.3,
    alignment: 0.4,
    spinSpeed: 3,
    targetPriority: 'nearest',
    snakeAmplitude: 150,
    snakePeriod: 5,
    snakeInvert: false,
    snakeYOffset: 0,
    snakeAngle: 0,
    formulaDivisor: 4,
  };
}

export function resolveProjectileVisual(typeName: string, registry: Registry): string {
  const classDef = registry.get(typeName);
  if (!classDef) {
    const lower = typeName.toLowerCase();
    if (lower.includes('drone') || lower.includes('sentry')) return 'drone';
    if (lower.includes('trap') || lower.includes('block') || lower.includes('pillar')) return 'trap';
    if (lower.includes('swarm') || lower.includes('bee') || lower.includes('sunchip')) return 'swarm';
    if (lower.includes('minion')) return 'minion';
    if (lower.includes('hive')) return 'hive';
    return 'bullet';
  }

  const typeCheck = (t: string | undefined): string | null => {
    switch (t) {
      case 'drone': return 'drone';
      case 'trap': return 'trap';
      case 'swarm': return 'swarm';
      case 'minion': return 'minion';
      default: return null;
    }
  };

  const direct = typeCheck((classDef as any).TYPE);
  if (direct) return direct;

  let cur: any = classDef;
  const visited = new Set<string>();
  while (cur) {
    const found = typeCheck(cur.TYPE);
    if (found) return found;
    const pn = typeof cur.PARENT === 'string' ? cur.PARENT : (Array.isArray(cur.PARENT) ? cur.PARENT[0] : null);
    if (!pn || visited.has(pn)) break;
    visited.add(pn);
    cur = registry.get(pn);
  }

  const shape = (classDef as any).SHAPE ?? 0;
  if (shape === 3 && !(classDef as any).MOTION_TYPE) return 'drone';
  if (shape === -3 || shape === 4 || shape === -4) return 'trap';
  return 'bullet';
}

export function shapeForVisualResolved(visual: string, classDef?: ArrasClassDef, registry?: Registry): number {
  if (classDef && registry) {
    const resolved = resolveField(classDef, 'SHAPE', registry);
    if (resolved !== undefined) return resolved;
  } else if ((classDef as any)?.SHAPE !== undefined) {
    return (classDef as any).SHAPE;
  }
  switch (visual) {
    case 'drone': return 3;
    case 'trap': return 4;
    case 'swarm': return 5;
    case 'hive': return 5;
    case 'minion': return 0;
    case 'boomerang': return 0;
    default: return 0;
  }
}

export function motionForVisualResolved(visual: string, classDef?: ArrasClassDef): string {
  if ((classDef as any)?.MOTION_TYPE) {
    const mt = (classDef as any).MOTION_TYPE;
    switch (mt) {
      case 'glide': case 'motor': case 'chase': case 'swarm': case 'grow': case 'withMaster': return mt;
      default: return 'glide';
    }
  }
  switch (visual) {
    case 'drone': case 'minion': return 'chase';
    case 'swarm': return 'swarm';
    case 'trap': return 'glide';
    case 'hive': return 'chase';
    default: return 'glide';
  }
}
