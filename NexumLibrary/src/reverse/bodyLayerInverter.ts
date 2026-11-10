import type { ArrasTurretEmit, ArrasClassEmit } from '../types/warnings.js';
import type { WarningCollector } from '../warnings/collector.js';
import { invertSpinSpeed } from './physicsInverter.js';
import { emitBodyLayerMeta } from './istrongMetaEmitter.js';
import { arrasColorOf } from './colorInverter.js';

const LABEL_TO_BODY_TYPE: Record<string, string> = {
  smasher: 'smasherBody',
  spike: 'spikeBody',
  landmine: 'landmineBody',
  domination: 'dominationBody',
  auto: 'autoSmasherBody',
  mega: 'megaSmasherBody',
  saw: 'sawBody',
};

function labelToBodyType(label: string | undefined): string {
  if (!label) return 'smasherBody';
  const lower = label.toLowerCase();
  for (const key of Object.keys(LABEL_TO_BODY_TYPE)) {
    if (lower.includes(key)) return LABEL_TO_BODY_TYPE[key]!;
  }
  return `${lower.replace(/[^a-z0-9]/g, '')}Body`;
}

function layerShape(layer: any, sides: number, warn: WarningCollector): number | number[][] {
  if (Array.isArray(layer.outline) && layer.outline.length >= 3) return layer.outline.map((p: number[]) => [p[0], p[1]]);
  const depth = typeof layer.starDepth === 'number' ? layer.starDepth : 0;
  if (depth > 0 && sides >= 3) {
    if (layer.starCurved) warn.warn('bodyLayers', `layer "${layer.label ?? ''}": a curved star goes to OSA with straight sides`);
    const pts: number[][] = [];
    for (let i = 0; i < sides * 2; i++) {
      const a = Math.PI * i / sides, r = i % 2 ? 1 - depth : 1;
      pts.push([+(r * Math.cos(a)).toFixed(4), +(r * Math.sin(a)).toFixed(4)]);
    }
    return pts;
  }
  return sides;
}

export interface InvertedBodyLayers {
  turrets: ArrasTurretEmit[];
  layeredBossDependencies: ArrasClassEmit[];
  isSmasherDetected: boolean;
}

export function invertBodyLayers(
  bodyLayers: any[] | null | undefined,
  parentClassName: string,
  warn: WarningCollector,
): InvertedBodyLayers {
  const result: InvertedBodyLayers = { turrets: [], layeredBossDependencies: [], isSmasherDetected: false };
  if (!Array.isArray(bodyLayers) || bodyLayers.length === 0) return result;

  const renderOrders = new Set(bodyLayers.map(l => l.renderOrder ?? 0));
  const isLayeredBoss = renderOrders.size > 1 && bodyLayers.some(l => Array.isArray(l.turretIds) && l.turretIds.length > 0);

  if (isLayeredBoss) {
    warn.warn('bodyLayers', `LayeredBoss with ${bodyLayers.length} stacked layers detected. The reverse export collapses layers into TURRETS overlays, and a round trip cannot rebuild LayerN child classes.`, {
      original: { layerCount: bodyLayers.length, renderOrders: [...renderOrders] },
    });
  }

  bodyLayers.forEach((layer, li) => {
    const sizeRatio = typeof layer.sizeRatio === 'number' ? layer.sizeRatio : 1;
    const arrasSize = sizeRatio * 20;
    const sides = typeof layer.sides === 'number' ? layer.sides : 6;
    const initialAngle = typeof layer.initialAngle === 'number' ? layer.initialAngle : 0;
    const angleDeg = initialAngle * 180 / Math.PI;
    const copies = Math.max(1, typeof layer.copies === 'number' ? layer.copies : 1);
    const spinEnabled = !!layer.spinEnabled;
    const spinSpeed = typeof layer.spinSpeed === 'number' ? layer.spinSpeed : 0;
    const spinDir = layer.spinDirection === -1 ? -1 : 1;
    const stationary = !!layer.stationary;

    if (labelToBodyType(layer.label) !== 'sawBody') result.isSmasherDetected = true;

    const shape = layerShape(layer, sides, warn);
    const color = layer.useInheritColor ? 'mirror' : arrasColorOf(layer.color ?? '#484848', layer.colorMap, warn);
    const hat = (name: string, facing: any) => {
      result.layeredBossDependencies.push({
        className: name, LABEL: '', SHAPE: shape, COLOR: color, FACING_TYPE: facing,
        INDEPENDENT: true, MIRROR_MASTER_ANGLE: false,
      } as any);
    };
    const base = `${parentClassName}_layer${li}`;
    if (!stationary) {
      hat(`${base}Body`, spinEnabled && spinSpeed ? ['spin', { speed: invertSpinSpeed(spinSpeed) * spinDir }] : ['toTarget']);
    }
    const angleStep = 360 / copies;
    for (let i = 0; i < copies; i++) {
      const ang = angleDeg + i * angleStep;
      let type = `${base}Body`;
      if (stationary) {
        type = copies > 1 ? `${base}c${i}Body` : `${base}Body`;
        hat(type, ['noFacing', { angle: ang * Math.PI / 180 }]);
      }
      const entry: ArrasTurretEmit = { POSITION: [arrasSize, 0, 0, ang, 360, 0], TYPE: type };
      if (i === 0) emitBodyLayerMeta(entry as any, layer);
      result.turrets.push(entry);
    }
  });

  return result;
}
