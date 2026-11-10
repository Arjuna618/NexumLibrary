import type { IstrongTurret, TankData } from '../types/istrong.js';
import type { ArrasClassEmit, ArrasGunEmit } from '../types/warnings.js';
import type { WarningCollector } from '../warnings/collector.js';
import { invertSpinSpeed } from './physicsInverter.js';
import { arrasColorOf } from './colorInverter.js';
import { invertTurretsWithDependencies } from './turretInverter.js';
import { emitBodyLayerMeta } from './istrongMetaEmitter.js';

const OUTER_BODY_ARRAS_SIZE = 20;

interface BodyLayer {
  id?: string;
  label?: string;
  sides?: number;
  sizeRatio?: number;
  color?: string;
  colorMap?: number;
  useInheritColor?: boolean;
  spinEnabled?: boolean;
  spinDirection?: number;
  spinSpeed?: number;
  copies?: number;
  initialAngle?: number;
  starDepth?: number;
  intangible?: boolean;
  stationary?: boolean;
  turretIds?: string[];
  renderOrder?: number;
  maxAliveEnabled?: boolean;
  maxAlive?: number;
}

function isTrueLayer(layer: BodyLayer): boolean {
  const turretCount = Array.isArray(layer.turretIds) ? layer.turretIds.length : 0;
  const intangible = layer.intangible !== false;
  return turretCount > 0 || !intangible;
}

function buildFacingType(spinEnabled: boolean | undefined, spinSpeed: number | undefined, spinDirection: number | undefined): any | undefined {
  if (!spinEnabled || typeof spinSpeed !== 'number') return undefined;
  const arrasSpeed = invertSpinSpeed(spinSpeed) * (spinDirection === -1 ? -1 : 1);
  return ['spin', { speed: arrasSpeed }];
}

export interface LayeredBossInversionResult {
  isLayeredBoss: boolean;
  mainClassOverrides: {
    SHAPE?: number;
    COLOR?: any;
    FACING_TYPE?: any;
    extraTurrets: { POSITION: number[]; TYPE: string }[];
    outerBodyLayer?: BodyLayer;
  };
  outerBodyTurretIds: Set<string>;
  dependencies: ArrasClassEmit[];
  consumedTurretIds: Set<string>;
}

export function invertLayeredBoss(
  tank: TankData,
  bodyLayers: BodyLayer[] | null | undefined,
  parentClassName: string,
  warn: WarningCollector,
): LayeredBossInversionResult {
  const empty: LayeredBossInversionResult = {
    isLayeredBoss: false,
    mainClassOverrides: { extraTurrets: [] },
    outerBodyTurretIds: new Set<string>(),
    dependencies: [],
    consumedTurretIds: new Set<string>(),
  };

  if (!Array.isArray(bodyLayers) || bodyLayers.length === 0) return empty;

  const trueLayers = bodyLayers.filter(isTrueLayer);
  if (trueLayers.length < 2) return empty;

  trueLayers.sort((a, b) => (a.renderOrder ?? 0) - (b.renderOrder ?? 0));

  const outerLayer = trueLayers[0]!;
  const outerSizeRatio = outerLayer.sizeRatio ?? 1;
  if (outerSizeRatio <= 0) return empty;
  const innermostArrasSize = OUTER_BODY_ARRAS_SIZE / outerSizeRatio;

  const turretsById = new Map<string, IstrongTurret>();
  for (const t of tank.turrets ?? []) {
    if (t.id) turretsById.set(t.id, t);
  }

  const consumedTurretIds = new Set<string>();
  const outerBodyTurretIds = new Set<string>();
  const dependencies: ArrasClassEmit[] = [];
  const mainTurrets: { POSITION: number[]; TYPE: string }[] = [];

  for (const tid of outerLayer.turretIds ?? []) {
    if (turretsById.has(tid)) {
      outerBodyTurretIds.add(tid);
      consumedTurretIds.add(tid);
    }
  }

  const innerLayers = trueLayers.slice(1);
  for (let i = 0; i < innerLayers.length; i++) {
    const layer = innerLayers[i]!;
    const layerClassName = `${parentClassName}Layer${i + 1}`;
    const layerArrasSize = (layer.sizeRatio ?? 1) * innermostArrasSize;
    const renderLayerPos = i + 1;

    mainTurrets.push({
      POSITION: [layerArrasSize, 0, 0, (layer.initialAngle ?? 0) * 180 / Math.PI, 360, renderLayerPos],
      TYPE: layerClassName,
    });

    const layerTurrets: IstrongTurret[] = [];
    for (const tid of layer.turretIds ?? []) {
      const t = turretsById.get(tid);
      if (t) {
        layerTurrets.push(t);
        consumedTurretIds.add(tid);
      }
    }
    const inner = invertTurretsWithDependencies(layerTurrets, layerClassName, warn);
    dependencies.push(...inner.dependencies);

    const classDef: ArrasClassEmit = {
      className: layerClassName,
      PARENT: 'genericTank',
      LABEL: layer.label ?? layerClassName,
    };
    if (typeof layer.sides === 'number') classDef.SHAPE = layer.sides;
    if (layer.color && layer.color !== 'inherit' && !layer.useInheritColor) {
      classDef.COLOR = arrasColorOf(layer.color, layer.colorMap, warn);
    } else if (layer.useInheritColor) {
      classDef.COLOR = -1;
    }
    const facing = buildFacingType(layer.spinEnabled, layer.spinSpeed, layer.spinDirection);
    if (facing) classDef.FACING_TYPE = facing;
    if (inner.GUNS.length > 0) classDef.GUNS = inner.GUNS;
    if (inner.TURRETS.length > 0) classDef.TURRETS = inner.TURRETS;
    if (layer.maxAliveEnabled && (layer.maxAlive ?? 0) > 0) classDef.MAX_CHILDREN = layer.maxAlive;
    classDef.INTANGIBLE = true;
    classDef.DRAW_HEALTH = false;
    emitBodyLayerMeta(classDef as any, layer);
    dependencies.push(classDef);
  }

  const innermostClassName = `${parentClassName}Layer${innerLayers.length + 1}`;
  const innermostTurrets: IstrongTurret[] = [];
  for (const t of tank.turrets ?? []) {
    if (t.id && !consumedTurretIds.has(t.id)) {
      innermostTurrets.push(t);
      consumedTurretIds.add(t.id);
    }
  }
  if (innermostTurrets.length > 0 || tank.tankSides) {
    const innermostFacing = buildFacingType(tank.baseSpinEnabled, tank.baseSpinSpeed, tank.baseSpinDirection);
    mainTurrets.push({
      POSITION: [innermostArrasSize, 0, 0, 0, 360, innerLayers.length + 1],
      TYPE: innermostClassName,
    });
    const inner = invertTurretsWithDependencies(innermostTurrets, innermostClassName, warn);
    dependencies.push(...inner.dependencies);
    const classDef: ArrasClassEmit = {
      className: innermostClassName,
      PARENT: 'genericTank',
      LABEL: innermostClassName,
    };
    if (typeof tank.tankSides === 'number' && tank.tankSides !== 0) classDef.SHAPE = tank.tankSides;
    const innerColor = arrasColorOf(tank.tankColor, tank.tankColorMap, warn);
    if (innerColor !== 'inherit' && innerColor !== -1) classDef.COLOR = innerColor;
    if (innermostFacing) classDef.FACING_TYPE = innermostFacing;
    if (inner.GUNS.length > 0) classDef.GUNS = inner.GUNS;
    if (inner.TURRETS.length > 0) classDef.TURRETS = inner.TURRETS;
    classDef.INTANGIBLE = true;
    classDef.DRAW_HEALTH = false;
    dependencies.push(classDef);
  }

  const outerFacing = buildFacingType(outerLayer.spinEnabled, outerLayer.spinSpeed, outerLayer.spinDirection);
  const outerColor = outerLayer.useInheritColor
    ? arrasColorOf(tank.tankColor, tank.tankColorMap, warn)
    : arrasColorOf(outerLayer.color ?? '#a7a7af', outerLayer.colorMap, warn);

  warn.info('layeredBoss', `LayeredBoss reconstructed as ${innerLayers.length + 1} child class${innerLayers.length === 0 ? '' : 'es'} (${innerLayers.length + 1} kronos-style layer files).`, {
    original: { layerCount: trueLayers.length, innermostArrasSize },
    recovered: { mainClass: parentClassName, layerClasses: innerLayers.map((_, i) => `${parentClassName}Layer${i + 1}`) },
  });

  return {
    isLayeredBoss: true,
    mainClassOverrides: {
      SHAPE: outerLayer.sides,
      COLOR: outerColor,
      FACING_TYPE: outerFacing,
      extraTurrets: mainTurrets,
      outerBodyLayer: outerLayer,
    },
    outerBodyTurretIds,
    dependencies,
    consumedTurretIds,
  };
}
