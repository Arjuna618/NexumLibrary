import type { IstrongTurret } from '../types/istrong.js';
import type { ArrasClassEmit, ArrasGunEmit } from '../types/warnings.js';
import type { WarningCollector } from '../warnings/collector.js';
import { invertColor } from './colorInverter.js';
import { invertMotionType, invertFacingType, invertStatCalculator } from './behaviorInverter.js';
import { emitProjectileMeta } from './istrongMetaEmitter.js';

const VISUAL_TO_PARENT: Record<string, string> = {
  bullet: 'bullet',
  drone: 'drone',
  swarm: 'swarm',
  trap: 'trap',
  minion: 'minion',
  hive: 'hive',
  boomerang: 'boomerang',
  bomb: 'bullet',
  rocket: 'bullet',
  missile: 'bullet',
};

export interface InvertedCPD {
  classDef: ArrasClassEmit;
  innerGunInverter: (turrets: IstrongTurret[], parentName: string, warn: WarningCollector) => { GUNS: ArrasGunEmit[]; TURRETS: any[] };
}

export function buildCpdClass(
  cpd: any,
  parentTankName: string,
  gunIndex: number,
  warn: WarningCollector,
  innerInverter: (turrets: IstrongTurret[], parentName: string, warn: WarningCollector) => { GUNS: ArrasGunEmit[]; TURRETS: any[] },
): ArrasClassEmit {
  const className = `${parentTankName}Projectile${gunIndex}`;
  const visual = (cpd.visual || 'bullet').toLowerCase();
  const parent = VISUAL_TO_PARENT[visual] ?? 'bullet';

  const classDef: ArrasClassEmit = {
    className,
    PARENT: parent,
    LABEL: cpd.name || className,
  };

  const motion = invertMotionType(cpd.motionType);
  if (motion && motion !== 'glide') classDef.MOTION_TYPE = motion;

  const facing = invertFacingType(cpd.facingType);
  if (facing && facing !== 'toTarget') classDef.FACING_TYPE = facing;

  if (typeof cpd.shape === 'number' && cpd.shape !== 0) {
    if (cpd.trapDepth && cpd.trapDepth > 0) {
      classDef.SHAPE = -cpd.shape;
    } else {
      classDef.SHAPE = cpd.shape;
    }
  }

  if (cpd.color && cpd.color !== 'inherit' && !cpd.useTankColor) {
    classDef.COLOR = invertColor(cpd.color, warn);
  }

  if (typeof cpd.density === 'number' && cpd.density !== 1) {
    if (!classDef.BODY) classDef.BODY = {} as any;
    (classDef.BODY as any).DENSITY = cpd.density;
  }

  if (cpd.hitsOwnType && cpd.hitsOwnType !== 'none') {
    const hitsMap: Record<string, string> = {
      push: 'push',
      drone: 'droneCollision',
      hardWithBuffer: 'hardWithBuffer',
      assembler: 'assembler',
    };
    classDef.HITS_OWN_TYPE = hitsMap[cpd.hitsOwnType] ?? cpd.hitsOwnType;
  }

  if (cpd.persistsAfterDeath) classDef.PERSISTS_AFTER_DEATH = true;

  if (Array.isArray(cpd.turrets) && cpd.turrets.length > 0) {
    const inner = innerInverter(cpd.turrets as IstrongTurret[], className, warn);
    if (inner.GUNS.length > 0) classDef.GUNS = inner.GUNS;
    if (inner.TURRETS.length > 0) classDef.TURRETS = inner.TURRETS;
  }

  if (Array.isArray(cpd.bodyLayers) && cpd.bodyLayers.length > 0) {
    warn.info('cpd.bodyLayers', `Custom projectile "${className}" has body layer overlays. They are emitted as extra TURRETS but the parent class layers may not perfectly match.`);
  }

  emitProjectileMeta(classDef as any, cpd);

  return classDef;
}
