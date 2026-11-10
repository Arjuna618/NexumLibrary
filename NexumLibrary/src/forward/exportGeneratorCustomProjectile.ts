import type { Registry } from '../types/arras.js';
import type { ExportFile, CustomProjectileData } from '../types/istrong.js';
import { resolveFlat, detectProjectileVisual } from './classResolver.js';
import { motionForVisual, facingForVisual, shapeForVisual } from './turretMapperBasic.js';
import { buildCustomProjectileDesign } from './turretMapperFull.js';
import { resetSharedTurretIds, resolveControllers, resolveField } from './turretMapperHelpers.js';
import { mapMotionType, mapFacingType } from './behaviorMapper.js';
import { getEntityColor } from './colorMapper.js';
import { PROJECTILE_NAME_OVERRIDES } from '../constants/projectileWhitelist.js';
import { WarningCollector } from '../warnings/collector.js';
import type { DeathBurst } from './deathBurst.js';

function camelToTitle(s: string): string {
  return s.replace(/^./, c => c.toUpperCase()).replace(/([A-Z])/g, ' $1').replace(/\s+/g, ' ').trim();
}

export function convertArrasClassToCustomProjectile(
  className: string,
  registry: Registry,
  warn?: WarningCollector,
): ExportFile<CustomProjectileData> {
  const w = warn ?? new WarningCollector();
  resetSharedTurretIds();

  const flat = resolveFlat(className, registry);
  const visual = detectProjectileVisual(className, registry);

  let shape = typeof flat.SHAPE === 'number' ? Math.abs(flat.SHAPE) : shapeForVisual(visual);
  let trapDepth = 0;
  if (typeof flat.SHAPE === 'number' && flat.SHAPE < 0) {
    const absShape = Math.abs(flat.SHAPE);
    shape = absShape;
    trapDepth = 6 / (absShape * absShape);
  } else if (visual === 'trap') {
    trapDepth = shape === 3 ? 0.67 : (shape === 4 ? 0.38 : 0.15);
  }

  const bodySize = (flat.BODY as any)?.SIZE;
  const size = typeof bodySize === 'number' ? bodySize : 1;

  const useTankColor = flat.COLOR === undefined || flat.COLOR === null || flat.COLOR === -1;
  const color = useTankColor
    ? 'inherit'
    : getEntityColor(flat.COLOR as any, '#3ca4cb');

  const resolvedMotionType = resolveField(flat, 'MOTION_TYPE', registry);
  const resolvedFacingType = resolveField(flat, 'FACING_TYPE', registry);
  const motion = resolvedMotionType
    ? mapMotionType(typeof resolvedMotionType === 'string' ? resolvedMotionType : (Array.isArray(resolvedMotionType) ? resolvedMotionType[0] : 'glide'))
    : motionForVisual(visual);
  const facing = resolvedFacingType
    ? mapFacingType(resolvedFacingType)
    : facingForVisual(visual);

  const controllers = resolveControllers(flat, registry);
  let hasGoToTarget = false;
  if (controllers) {
    for (const c of controllers) {
      const cName = typeof c === 'string' ? c : (Array.isArray(c) ? c[0] : '');
      if (cName === 'goToMasterTarget' || cName === 'goToTarget') {
        hasGoToTarget = true;
        break;
      }
    }
  }

  const displayName = PROJECTILE_NAME_OVERRIDES[className]
    ?? (flat as any).NAME
    ?? flat.LABEL
    ?? camelToTitle(className);

  const burst: { explode?: DeathBurst } = {};
  const cpd = buildCustomProjectileDesign(
    flat,
    registry,
    visual,
    shape,
    motion,
    facing,
    trapDepth,
    hasGoToTarget,
    size,
    0,
    undefined,
    undefined,
    burst,
  );
  if (burst.explode) {
    const pieces = burst.explode.rings.reduce((n, r) => n + r.count, 0);
    w.info('SHOOT_ON_DEATH', `"${className}" bursts into ${pieces} piece(s) when it dies. A projectile file cannot carry a burst: it lives on the barrel that fires the projectile. Convert the tank or the turret that fires it to keep the burst.`, { original: pieces });
  }

  const data: CustomProjectileData = cpd
    ? { ...cpd, name: displayName, category: 'Projectiles' }
    : {
        name: displayName,
        category: 'Projectiles',
        visual,
        shape,
        size,
        color,
        useTankColor,
        useMuzzleSize: true,
        motionType: motion,
        facingType: facing,
        growRate: 1,
      };

  return {
    version: '1.0.0',
    type: 'CustomProjectile',
    name: displayName,
    timestamp: Date.now(),
    category: 'Projectiles',
    source: 'nexum-upload',
    data,
  };
}
