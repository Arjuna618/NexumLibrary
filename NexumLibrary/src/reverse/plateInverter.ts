import type { IstrongTurret, TankData } from '../types/istrong.js';
import type { ArrasClassEmit, ArrasGunEmit } from '../types/warnings.js';
import type { WarningCollector } from '../warnings/collector.js';
import { invertSpinSpeed } from './physicsInverter.js';
import { arrasColorOf } from './colorInverter.js';
import { invertTurretsWithDependencies, withFrame, withMount, holderFrame } from './turretInverter.js';
import { emitBodyLayerMeta } from './istrongMetaEmitter.js';
import { ISTRONG_PLATE_KEY as PLATE_KEY, ISTRONG_MAIN_BODY_KEY as MAIN_BODY_KEY, plateRecord } from '../types/istrongMeta.js';
import { plateShape, osaPolygonShape } from './plateShape.js';

export interface PlateResult {
  K: number;
  anchor: any | null;
  anchorIndex: number;
  before: any[];
  after: any[];
  anchorGuns: ArrasGunEmit[];
  anchorTurrets: any[];
  dependencies: ArrasClassEmit[];
  onPlates: Set<string>;
}

const facingOf = (layer: any): any => {
  if (layer.spinEnabled && typeof layer.spinSpeed === 'number' && layer.spinSpeed) {
    return ['spin', { speed: invertSpinSpeed(layer.spinSpeed) * (layer.spinDirection === -1 ? -1 : 1) }];
  }
  return null;
};
export function turnedShape(shape: number | number[][], angle: number): number | number[][] {
  if (!angle) return shape;
  if (Array.isArray(shape)) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return shape.map(([x, y]) => [+(x! * c - y! * s).toFixed(4), +(x! * s + y! * c).toFixed(4)]);
  }
  if (!(shape >= 3)) return shape;
  const n = Math.floor(shape);
  const frac = ((((shape - n) + angle / (2 * Math.PI)) % 1) + 1) % 1;
  return +(n + frac).toFixed(6);
}

export function followsBody(l: any, tank: TankData): boolean {
  if (l.useInheritColor) return true;
  if (l.teamColour === false) return false;
  return (l.teamColour === true || !l.intangible) && tank.keepOwnColor !== true;
}

export function plateFacing(layer: any): any {
  return facingOf(layer) ?? undefined;
}

export function widestSolidPlate(tank: TankData): { K: number; anchor: any | null } {
  let K = 1, anchor: any = null;
  for (const l of Array.isArray(tank.bodyLayers) ? tank.bodyLayers : []) {
    if (l && l.intangible === false && typeof l.sizeRatio === 'number' && l.sizeRatio > K) { K = l.sizeRatio; anchor = l; }
  }
  return { K, anchor };
}

export function invertPlates(tank: TankData, className: string, warn: WarningCollector, mainMount: number | null): PlateResult {
  const layers: any[] = Array.isArray(tank.bodyLayers) ? tank.bodyLayers : [];
  const res: PlateResult = { K: 1, anchor: null, anchorIndex: -1, before: [], after: [], anchorGuns: [], anchorTurrets: [], dependencies: [], onPlates: new Set() };
  const byId = new Map<string, IstrongTurret>();
  for (const t of tank.turrets ?? []) if (t && t.id) byId.set(t.id, t);
  const partsOf = new Map<any, IstrongTurret[]>();
  for (const l of layers) {
    const list: IstrongTurret[] = [];
    for (const id of Array.isArray(l.turretIds) ? l.turretIds : []) {
      const t = byId.get(id);
      if (t && !res.onPlates.has(id)) { list.push(t); res.onPlates.add(id); }
    }
    partsOf.set(l, list);
  }
  ({ K: res.K, anchor: res.anchor } = widestSolidPlate(tank));
  res.anchorIndex = res.anchor ? layers.indexOf(res.anchor) : -1;
  const K = res.K;
  const mountOf = (share: number) => (typeof mainMount === 'number' ? mainMount * K * share : null);

  const plateTurret = (l: any, li: number): any => {
    const share = (typeof l.sizeRatio === 'number' ? l.sizeRatio : 1) / K;
    const name = `${className}_layer${li}Body`;
    const sides = typeof l.sides === 'number' ? l.sides : 6;
    const cls: any = {
      className: name, LABEL: '', SHAPE: turnedShape(plateShape(l, sides, warn), l.initialAngle ?? 0),
      COLOR: followsBody(l, tank) ? 'mirror' : arrasColorOf(l.color ?? '#484848', l.colorMap, warn),
    };
    const spin = facingOf(l);
    if (spin) cls.FACING_TYPE = spin;
    else if (l.stationary) cls.FACING_TYPE = ['noFacing', { angle: 0 }];
    else cls.MIRROR_MASTER_ANGLE = true;
    const parts = partsOf.get(l) ?? [];
    if (parts.length) {
      const inner = withMount(mountOf(share), () => withFrame(holderFrame(share), () => invertTurretsWithDependencies(parts, name, warn)));
      res.dependencies.push(...inner.dependencies);
      cls.PARENT = 'genericTank';
      cls.INTANGIBLE = true;
      cls.DRAW_HEALTH = false;
      if (inner.GUNS.length) cls.GUNS = inner.GUNS;
      if (inner.TURRETS.length) cls.TURRETS = inner.TURRETS;
      if (l.maxAliveEnabled && (l.maxAlive ?? 0) > 0) cls.MAX_CHILDREN = l.maxAlive;
    } else {
      cls.INDEPENDENT = true;
    }
    emitBodyLayerMeta(cls, l);
    cls[PLATE_KEY] = plateRecord(l, li);
    res.dependencies.push(cls);
    return { POSITION: [+(20 * share).toFixed(6), 0, 0, 0, 360, 0], TYPE: name };
  };

  const ordered = (sel: (l: any) => boolean) => layers.map((l, i) => ({ l, i })).filter((x) => sel(x.l))
    .sort((a, b) => (a.l.renderOrder ?? 0) - (b.l.renderOrder ?? 0) || a.i - b.i);
  const under = ordered((l) => (l.renderOrder ?? 0) >= 0);
  const over = ordered((l) => (l.renderOrder ?? 0) < 0);

  if (!res.anchor) {
    for (const { l, i } of under) res.before.push(plateTurret(l, i));
    for (const { l, i } of over) {
      const turret = plateTurret(l, i);
      res.after.push({ ...turret, POSITION: [...turret.POSITION.slice(0, 5), 1] });
    }
    return res;
  }

  const units = [...under.map((x) => ({ kind: 'plate', ...x })), { kind: 'main', l: null, i: -1 }, ...over.map((x) => ({ kind: 'plate', ...x }))];
  const at = units.findIndex((u) => u.l === res.anchor);
  units.forEach((u, n) => {
    if (n === at) return;
    const turret = u.kind === 'main' ? mainTurret(tank, className, K, warn, mountOf(1 / K), res, byId) : plateTurret(u.l, u.i);
    if (n < at) res.before.push(turret);
    else res.after.push({ ...turret, POSITION: [...turret.POSITION.slice(0, 5), 1] });
  });
  const anchorParts = partsOf.get(res.anchor) ?? [];
  const inner = withMount(mountOf(1), () => invertTurretsWithDependencies(anchorParts, className, warn));
  res.anchorGuns = inner.GUNS;
  res.anchorTurrets = inner.TURRETS;
  res.dependencies.push(...inner.dependencies);
  return res;
}

function mainTurret(tank: TankData, className: string, K: number, warn: WarningCollector, mount: number | null, res: PlateResult, byId: Map<string, IstrongTurret>): any {
  const name = `${className}_mainBody`;
  const parts = (tank.turrets ?? []).filter((t) => t && !(t.id && res.onPlates.has(t.id)));
  void byId;
  const inner = withMount(mount, () => withFrame(holderFrame(1 / K), () => invertTurretsWithDependencies(parts, name, warn)));
  res.dependencies.push(...inner.dependencies);
  const sides = typeof tank.tankSides === 'number' ? tank.tankSides : 0;
  const cls: any = {
    className: name, PARENT: 'genericTank', LABEL: '', INTANGIBLE: true, DRAW_HEALTH: false, [MAIN_BODY_KEY]: 1,
    COLOR: tank.keepOwnColor === true && !(res.anchor && followsBody(res.anchor, tank)) ? arrasColorOf(tank.tankColor, tank.tankColorMap, warn) : 'mirror',
  };
  if (sides >= 3) cls.SHAPE = osaPolygonShape(sides, (tank.tankShapeDepth ?? 0) > 0, true);
  if (tank.baseSpinEnabled && typeof tank.baseSpinSpeed === 'number') {
    cls.FACING_TYPE = ['spin', { speed: invertSpinSpeed(tank.baseSpinSpeed * (tank.baseSpinDirection ?? 1)) }];
  } else cls.MIRROR_MASTER_ANGLE = true;
  if (inner.GUNS.length) cls.GUNS = inner.GUNS;
  if (inner.TURRETS.length) cls.TURRETS = inner.TURRETS;
  res.dependencies.push(cls);
  return { POSITION: [+(20 / K).toFixed(6), 0, 0, 0, 360, 0], TYPE: name };
}
