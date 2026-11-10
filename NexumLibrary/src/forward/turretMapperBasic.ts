import type { ArrasClassDef, ArrasGun, ArrasGunPosition, Registry } from '../types/arras.js';
import type { GunStats } from '../constants/gunStats.js';
import { DEFAULT_GUN_STATS } from '../constants/gunStats.js';
import {
  convertGunStats,
  convertBarrelLength,
  convertBarrelWidth,
  convertBarrelX,
  convertBarrelY,
  convertLifetime,
  convertRoundLifetime,
  computeTopSpeedRatio,
  convertBulletSize,
  convertTankBarrelSpeed,
} from './physicsCalibrator.js';
import { getEntityColor } from './colorMapper.js';
import { detectProjectileVisual } from './classResolver.js';
import { resolveBodyNumber } from './turretMapperHelpers.js';
import { mapStatCalculator } from './behaviorMapper.js';
import type { WarningCollector } from '../warnings/collector.js';
import { collectGunArrasOnly, collectProjectileArrasOnly } from './arrasOnlyCollector.js';
import { applyTurretMeta, applyProjectileMeta, applyProjectileMetaInline } from './istrongMetaReader.js';

let nextTurretIdCounter = 1;
function generateTurretId(): string {
  return `arras-${nextTurretIdCounter++}-${Math.random().toString(36).slice(2, 9)}`;
}

export function resetTurretIdCounter() { nextTurretIdCounter = 1; }

function normalizeGunPosition(pos: any): ArrasGunPosition {
  if (Array.isArray(pos)) {
    return {
      LENGTH: pos[0] ?? 0,
      WIDTH: pos[1] ?? 0,
      ASPECT: pos[2] ?? 1,
      X: pos[3] ?? 0,
      Y: pos[4] ?? 0,
      ANGLE: pos[5] ?? 0,
      DELAY: pos[6] ?? 0,
    };
  }
  return {
    LENGTH: pos?.LENGTH ?? pos?.length ?? 0,
    WIDTH: pos?.WIDTH ?? pos?.width ?? 0,
    ASPECT: pos?.ASPECT ?? pos?.aspect ?? 1,
    X: pos?.X ?? pos?.x ?? 0,
    Y: pos?.Y ?? pos?.y ?? 0,
    ANGLE: pos?.ANGLE ?? pos?.angle ?? 0,
    DELAY: pos?.DELAY ?? pos?.delay ?? 0,
  };
}

export function motionForVisual(visual: string): string {
  if (visual === 'drone') return 'chase';
  if (visual === 'swarm') return 'swarm';
  if (visual === 'trap') return 'glide';
  if (visual === 'minion') return 'motor';
  if (visual === 'hive') return 'motor';
  if (visual === 'boomerang') return 'motor';
  return 'glide';
}

export function facingForVisual(visual: string): string {
  if (visual === 'trap') return 'turnWithSpeed';
  if (visual === 'drone' || visual === 'minion') return 'smoothToTarget';
  return 'smoothWithMotion';
}

export function shapeForVisual(visual: string): number {
  if (visual === 'drone') return 3;
  if (visual === 'trap') return 4;
  if (visual === 'swarm') return 5;
  if (visual === 'minion') return 0;
  return 0;
}

export function defaultBehaviors(visual: string): any[] {
  const motion = motionForVisual(visual);
  const motionMap: Record<string, string> = {
    glide: 'motionGlide',
    chase: 'motionChase',
    swarm: 'motionSwarm',
    motor: 'motionMotor',
    grow: 'motionGrow',
    withMaster: 'motionWithMaster',
  };
  const result: any[] = [];
  const mb = motionMap[motion];
  if (mb) result.push({ type: mb, enabled: true });
  if (visual === 'drone') {
    result.push({ type: 'autoTargetEnemy', enabled: true });
    result.push({ type: 'canRepel', enabled: true });
    result.push({ type: 'followMouse', enabled: true });
    result.push({ type: 'hangNearOwner', enabled: true });
  }
  if (visual === 'swarm') {
    result.push({ type: 'swarmAI', enabled: true });
  }
  return result;
}

export function mapBasicGun(
  gun: ArrasGun,
  registry: Registry,
  warn: WarningCollector,
): any {
  const pos = normalizeGunPosition(gun.POSITION);
  const props = gun.PROPERTIES ?? {};
  const isAmmoBarrel = !props.SHOOT_SETTINGS;

  const shootSettings: GunStats = props.SHOOT_SETTINGS ?? { ...DEFAULT_GUN_STATS };
  const converted = isAmmoBarrel
    ? { bps: 0, speed: 0, knockback: 0, spread: 0, bulletDamage: 0, bulletHealthBase: 0, bulletPenetration: 0, bulletLifetime: 0, shudder: 0.1 }
    : convertGunStats(shootSettings);
  if (!isAmmoBarrel) converted.speed = convertTankBarrelSpeed(shootSettings.speed);

  const typeRef = props.TYPE ?? 'bullet';
  const typeClassName = typeof typeRef === 'string' ? typeRef : (Array.isArray(typeRef) ? typeRef[0] : 'bullet');
  const visual = detectProjectileVisual(typeClassName, registry);

  if (!isAmmoBarrel) {
    converted.bulletLifetime = visual === 'bullet'
      ? convertRoundLifetime(shootSettings.range, 'bullet', mapStatCalculator(props.STAT_CALCULATOR))
      : convertLifetime(shootSettings.range, visual === 'trap' ? 'trap' : visual === 'swarm' ? 'swarm' : visual === 'boomerang' ? 'boomerang' : 'bullet');
  }

  const projClassDef = registry.get(typeClassName);
  const isCpd = projClassDef && (
    (Array.isArray(projClassDef.GUNS) && projClassDef.GUNS.length > 0) ||
    (Array.isArray(projClassDef.TURRETS) && projClassDef.TURRETS.length > 0)
  );

  if (isCpd) {
    warn.info('cpd', `Nested guns/turrets on projectile "${typeClassName}" (CPD/TAP) aren't yet supported when uploading custom arras source; the basic projectile is preserved.`);
  }

  const aspect = pos.ASPECT < 0 ? 1 / Math.abs(pos.ASPECT) : pos.ASPECT;
  const baseWidth = pos.ASPECT < 0 ? pos.WIDTH * Math.abs(pos.ASPECT) : pos.WIDTH;

  const angleRad = pos.ANGLE * Math.PI / 180;
  const xLocal = pos.X;
  const yLocal = pos.Y;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const xTank = xLocal * cosA - yLocal * sinA;
  const yTank = xLocal * sinA + yLocal * cosA;

  const length = convertBarrelLength(pos.LENGTH);
  const width = convertBarrelWidth(baseWidth);
  const xOffset = convertBarrelX(xTank);
  const yOffset = convertBarrelY(yTank);

  const ownBodySpeed = visual === 'minion' ? resolveBodyNumber(projClassDef, 'SPEED', registry) : undefined;
  const topSpeedRatio = !isAmmoBarrel
    ? computeTopSpeedRatio(shootSettings.speed, shootSettings.maxSpeed, visual === 'trap' ? 'trap' : visual === 'swarm' ? 'swarm' : visual === 'drone' ? 'drone' : visual === 'minion' ? 'minion' : visual === 'hive' ? 'hive' : visual === 'boomerang' ? 'boomerang' : 'bullet', ownBodySpeed)
    : 1;

  const bulletSize = isAmmoBarrel ? (shootSettings.size ?? 1) : convertBulletSize(shootSettings.size ?? 1, pos.WIDTH, pos.ASPECT);

  const result: any = {
    id: generateTurretId(),
    length,
    width,
    aspect: aspect <= 0 ? 1 : aspect,
    xOffset,
    yOffset,
    angle: angleRad,
    bps: converted.bps,
    speed: converted.speed,
    delay: pos.DELAY,
    knockback: props.HAS_NO_RECOIL ? 0 : converted.knockback,
    launchReversed: props.NEGATIVE_RECOIL ? true : undefined,
    spread: converted.spread,
    shudder: converted.shudder,
    bulletDamage: converted.bulletDamage,
    bulletHealthBase: converted.bulletHealthBase,
    bulletPenetration: converted.bulletPenetration,
    bulletLifetime: converted.bulletLifetime,
    shootResist: shootSettings.resist ?? 1,
    shootDensity: (shootSettings.density ?? 1) !== 1 ? shootSettings.density : undefined,
    isCustom: false,
    animProgress: 0,
    turretType: isAmmoBarrel ? 'decorative' : 'regular',
    alwaysAbove: false,
    alwaysShoot: !!props.AUTOFIRE,
    independent: !!props.INDEPENDENT,
    fov: 200,
    fovSize: 10,
    autoTargetPriority: 'nearest',
    maxTurnSpeed: 4.5,
    autoFireDelay: 0,
    manualControl: false,
    autoCircleSize: 25,
    autoTurretLength: 7,
    autoTurretWidth: 20,
    projectileType: {
      visual,
      shape: shapeForVisual(visual),
      size: bulletSize,
      useMuzzleSize: true,
      color: 'inherit',
      useTankColor: true,
      maxAlive: props.MAX_CHILDREN ?? 0,
      lifetime: 0,
      dieAtRange: false,
      motionType: motionForVisual(visual),
      facingType: facingForVisual(visual),
      growRate: 1,
      subTurrets: [],
      customProjectileDesign: null,
      persistsAfterDeath: !!props.PERSISTS_AFTER_DEATH,
      trapDepth: visual === 'trap' ? 0.15 : 0,
      trapCurved: false,
      friction: visual === 'trap' ? 0.05 : 0,
      hitsOwnType: 'none',
      density: visual === 'trap' ? 2.5 : 1,
      bounciness: visual === 'trap' ? 0 : 0.9,
      bouncy: visual !== 'trap',
      statCalculatorType: 'bullet',
      topSpeedRatio,
      necroInfect: !!props.NECRO,
    },
    projectileBehaviors: defaultBehaviors(visual),
    visualLayers: [],
    autoCurrentAngle: 0,
    autoTargetId: null,
    autoShapeLockId: null,
    aboveTankBody: !!props.DRAW_ABOVE,
    renderLayer: 0,
    autoFire: false,
    wifiRange: false,
    wifiRangeValue: 50,
    recoilPosition: 0,
    recoilVelocity: 0,
    physRecoilPos: 0,
    physRecoilVel: 0,
    physRecoilDirX: 0,
    physRecoilDirY: 0,
    autoSubTurrets: [],
    primarySubTurretId: null,
    altFire: !!props.ALT_FIRE,
    syncsSkills: !!props.SYNCS_SKILLS,
    necro: !!props.NECRO,
    healer: !!props.HEALER,
    gunStatScale: typeof props.GUN_STAT_SCALE === 'number' ? props.GUN_STAT_SCALE : 1,
  };

  if (typeof props.GUN_STAT_SCALE === 'object' && props.GUN_STAT_SCALE !== null) {
    const gss = props.GUN_STAT_SCALE as Record<string, number>;
    if (gss.damage != null) result.bulletDamage *= gss.damage;
    if (gss.health != null) result.bulletHealthBase *= gss.health;
    if (gss.pen != null) result.bulletPenetration *= gss.pen;
    if (gss.speed != null) {
      result.speed *= gss.speed;
      if (result.projectileType?.topSpeedRatio != null && gss.speed !== 0) {
        result.projectileType.topSpeedRatio /= gss.speed;
      }
    }
    if (gss.range != null) result.bulletLifetime *= gss.range;
    if (gss.reload != null) result.bps *= gss.reload;
    if (gss.recoil != null) result.knockback *= gss.recoil;
    result.gunStatScale = 1.0;
  }

  const gunArrasOnly = collectGunArrasOnly(props);
  if (gunArrasOnly) result._arrasOnly = gunArrasOnly;

  const projArrasOnly = collectProjectileArrasOnly(projClassDef);
  if (projArrasOnly) (result.projectileType as any)._arrasOnly = projArrasOnly;

  applyTurretMeta(result as any, props);
  if (projClassDef) {
    applyProjectileMeta(result.projectileType as any, projClassDef as any);
  }
  applyProjectileMetaInline(result.projectileType as any, props);

  return result;
}
