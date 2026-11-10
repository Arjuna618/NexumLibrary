import type { ArrasGun, ArrasGunPosition, ArrasClassDef, Registry } from '../types/arras.js';
import type { GunStats } from '../constants/gunStats.js';
import { DEFAULT_GUN_STATS } from '../constants/gunStats.js';
import { combineStats } from '../arras/helpers.js';
import { PROJECTILE_NAME_OVERRIDES } from '../constants/projectileWhitelist.js';
import { burstOfDeathGuns, type DeathBurst } from './deathBurst.js';
import {
  convertGunStats,
  convertBarrelLength,
  convertBarrelWidth,
  convertBarrelX,
  convertBarrelY,
  convertTurretX,
  convertTurretY,
  convertLifetime,
  convertRoundLifetime,
  CLASS_RANGE_RULED,
  convertRoundBarrelSpeed,
  computeTopSpeedRatio,
  convertBulletSize,
  convertTankBarrelSpeed,
} from './physicsCalibrator.js';
import {
  nextSharedTurretId,
  resolveBodyNumber,
  resolveControllers,
  resolveFacingTypeSpin,
  extractControllerSpinSpeed,
  isSpinOnlyControllers,
  hasCanRepel,
  hasExplicitlyEmptyControllers,
  hasHealerSymbol,
  resolveHealerFlag,
  mapHitsOwnType,
  normalizeTurretPosition,
  resolveField,
  resolveBodyOverlayField,
  resolveProjectileVisual,
  shapeForVisualResolved,
  motionForVisualResolved,
  makeBehavior,
  BODY_OVERLAY_DEFS,
  SMASHER_BODY_DEFS,
  TURRET_SPIN_MULT,
  ARRAS_SPIN_MULTIPLIER,
} from './turretMapperHelpers.js';
import { mapControllers, mapStatCalculator, mapMotionType, mapFacingType } from './behaviorMapper.js';
import { collectGunArrasOnly, collectProjectileArrasOnly } from './arrasOnlyCollector.js';
import { applyTurretMeta, applyProjectileMeta, applyProjectileMetaInline, applyBodyLayerMeta } from './istrongMetaReader.js';
import { RAMMER_RING_SLOT } from './colorMapper.js';
import { alphaIsCapped } from './alwaysInvisible.js';
import { ISTRONG_LOOK_KEY, ISTRONG_AUTO_KEY, ISTRONG_PICTURE_KEY } from '../types/istrongMeta.js';

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
    LENGTH: pos?.LENGTH ?? pos?.length ?? 18,
    WIDTH: pos?.WIDTH ?? pos?.width ?? 8,
    ASPECT: pos?.ASPECT ?? pos?.aspect ?? 1,
    X: pos?.X ?? pos?.x ?? 0,
    Y: pos?.Y ?? pos?.y ?? 0,
    ANGLE: pos?.ANGLE ?? pos?.angle ?? 0,
    DELAY: pos?.DELAY ?? pos?.delay ?? 0,
  };
}

const TAP_ENTITY_WHITELIST = new Set([
  'sentrySwarmMinion', 'sentryTrapMinion', 'sentryGunMinion',
  'destroyerLegion', 'gunnerLegion', 'sprayerLegion', 'battleshipLegion', 'spawnerLegion',
]);

const TAP_MINION_TO_FULL: Record<string, string> = {
  'sentrySwarmMinion': 'sentrySwarm',
  'sentryTrapMinion': 'sentryTrap',
  'sentryGunMinion': 'sentryGun',
};

export const GUN_SCALE_AS_DEFINED = true;

export const ROUND_GUN_SCALE_ON_MINIONS = true;

export const TURRET_OPTIONS_AS_DEFINED = true;
const G_AUTO_TURRET: Partial<GunStats> = { reload: 0.9, recoil: 0.75, shudder: 0.5, size: 0.8, health: 0.9, damage: 0.6, pen: 1.2, speed: 1.1, range: 0.8, density: 1.3, resist: 1.25 };
export function misplacedTurretOptionRows(turretClass: ArrasClassDef | undefined | null): Partial<GunStats>[] | null {
  const ai: any = (turretClass as any)?.AI;
  if (!TURRET_OPTIONS_AS_DEFINED || !ai || typeof ai !== 'object' || !('extraStats' in ai)) return null;
  const undo: any = {};
  for (const k of Object.keys(G_AUTO_TURRET)) undo[k] = 1 / (G_AUTO_TURRET as any)[k];
  const asked = ai.extraStats == null ? [] : (Array.isArray(ai.extraStats) ? ai.extraStats : [ai.extraStats]);
  return [undo, ...asked];
}

export function mapGuns(guns: ArrasGun[] | undefined, registry: Registry, depth: number = 0, statScale?: unknown, bodyArrasSize?: number): any[] {
  if (!guns || !Array.isArray(guns)) return [];
  const turrets: any[] = [];
  const _scaleRows: any[] = statScale == null ? []
    : (Array.isArray(statScale) && statScale.length > 0 && typeof statScale[0] === 'object' ? statScale as any[] : [statScale]);

  for (const gun of guns) {
    const pos: ArrasGunPosition = normalizeGunPosition(gun.POSITION);
    const props: any = gun.PROPERTIES ?? {};
    const isAmmoBarrel = !props.SHOOT_SETTINGS;

    const shootSettings: GunStats = isAmmoBarrel ? { ...DEFAULT_GUN_STATS }
      : (_scaleRows.length > 0 && GUN_SCALE_AS_DEFINED ? combineStats([props.SHOOT_SETTINGS, ..._scaleRows]) : props.SHOOT_SETTINGS);
    const converted: any = isAmmoBarrel
      ? { bps: 0, speed: 0, knockback: 0, spread: 0, bulletDamage: 0, bulletHealthBase: 0, bulletPenetration: 0, bulletLifetime: 0, shudder: 0.1, _arrasResist: 1 }
      : convertGunStats(shootSettings);
    if (!isAmmoBarrel && depth === 0) converted.speed = convertTankBarrelSpeed(shootSettings.speed);
    else if (!isAmmoBarrel) converted.speed = convertRoundBarrelSpeed(shootSettings.speed);

    const typeRef = props.TYPE ?? 'bullet';
    const typeClassName = typeof typeRef === 'string' ? typeRef : (Array.isArray(typeRef) ? typeRef[0] : '');
    const typeOptions: any = Array.isArray(typeRef) ? (typeRef[1] || {}) : {};
    const projClassDef = typeClassName ? registry.get(typeClassName) : undefined;
    let visual = typeClassName ? resolveProjectileVisual(typeClassName, registry) : 'bullet';
    if (typeClassName === 'casing') visual = 'bullet';

    let calibVisual = visual;
    const earlyControllers = (projClassDef as any)?.CONTROLLERS
      ?? (projClassDef ? resolveControllers(projClassDef, registry) : undefined);
    if (earlyControllers) {
      for (const c of earlyControllers) {
        const cName = typeof c === 'string' ? c : (Array.isArray(c) ? c[0] : '');
        if (cName === 'boomerang') { calibVisual = 'boomerang'; break; }
      }
    }
    if (!isAmmoBarrel) {
      converted.bulletLifetime = calibVisual === 'bullet'
        ? convertRoundLifetime(shootSettings.range, 'bullet', mapStatCalculator(props.STAT_CALCULATOR))
        : (calibVisual === 'swarm' && CLASS_RANGE_RULED.has(typeClassName))
        ? convertRoundLifetime(shootSettings.range, 'swarm', mapStatCalculator(props.STAT_CALCULATOR), resolveBodyNumber(projClassDef, 'RANGE', registry))
        : convertLifetime(shootSettings.range, calibVisual === 'trap' ? 'trap' : calibVisual === 'swarm' ? 'swarm' : calibVisual === 'boomerang' ? 'boomerang' : 'bullet');
    }

    const resolvedMotionType = props.MOTION_TYPE
      ?? (projClassDef ? resolveField(projClassDef, 'MOTION_TYPE', registry) : undefined);
    const resolvedFacingType = props.FACING_TYPE
      ?? (projClassDef ? resolveField(projClassDef, 'FACING_TYPE', registry) : undefined);
    const motion = resolvedMotionType
      ? mapMotionType(typeof resolvedMotionType === 'string' ? resolvedMotionType : (Array.isArray(resolvedMotionType) ? resolvedMotionType[0] : 'glide'))
      : motionForVisualResolved(visual, projClassDef);
    const facing = resolvedFacingType
      ? mapFacingType(resolvedFacingType)
      : (visual === 'trap' ? 'turnWithSpeed' : 'smoothWithMotion');

    let projShape = shapeForVisualResolved(visual, projClassDef, registry);
    let projTrapDepth = 0;
    if (projShape < 0) {
      const absShape = Math.abs(projShape);
      projShape = absShape;
      projTrapDepth = 6 / (absShape * absShape);
    } else if (visual === 'trap') {
      projTrapDepth = projShape === 3 ? 0.67 : (projShape === 4 ? 0.38 : 0.15);
    }

    const statCalc = mapStatCalculator(props.STAT_CALCULATOR);

    const projBehaviors: any[] = [];

    const projClassControllers = (projClassDef as any)?.CONTROLLERS
      ?? resolveControllers(projClassDef, registry);
    const typeOptionControllers = Array.isArray(typeOptions?.CONTROLLERS) ? typeOptions.CONTROLLERS : null;
    const gunLevelControllers = Array.isArray(props.CONTROLLERS) ? props.CONTROLLERS : null;
    const mergedControllers = [
      ...(typeOptionControllers ?? []),
      ...(gunLevelControllers ?? []),
      ...(projClassControllers ?? []),
    ];
    if (mergedControllers.length > 0) {
      const mapped = mapControllers(mergedControllers);
      for (const b of mapped) projBehaviors.push(b);
    }

    const isIndependent = typeOptions.INDEPENDENT
      ?? (projClassDef ? ((projClassDef as any).INDEPENDENT ?? resolveField(projClassDef, 'INDEPENDENT', registry)) : false);
    if (isIndependent) {
      projBehaviors.push({ type: 'independentProjectile', enabled: true });
    }

    let tankAsProjectileName: string | undefined;
    if (projClassDef && !isAmmoBarrel && typeClassName) {
      const tapGuns = resolveField(projClassDef, 'GUNS', registry);
      const tapTurrets = resolveField(projClassDef, 'TURRETS', registry);
      const tapIsFullEntity = (Array.isArray(tapGuns) && tapGuns.length > 0)
        || (Array.isArray(tapTurrets) && tapTurrets.length > 0);
      if (tapIsFullEntity) {
        if (props.INDEPENDENT_CHILDREN || TAP_ENTITY_WHITELIST.has(typeClassName)) {
          tankAsProjectileName = TAP_MINION_TO_FULL[typeClassName] ?? typeClassName;
        }
      }
    }

    const motionBehaviorMap: Record<string, string> = {
      'glide': 'motionGlide', 'motor': 'motionMotor', 'chase': 'motionChase',
      'swarm': 'motionSwarm', 'grow': 'motionGrow', 'withMaster': 'motionWithMaster',
    };
    const motionBehavior = motionBehaviorMap[motion];
    if (motionBehavior && !projBehaviors.some(b => b.type === motionBehavior)) {
      const mb = makeBehavior(motionBehavior, true);
      if (visual === 'trap' && motion === 'glide') mb.friction = 0.05;
      projBehaviors.push(mb);
    }

    if (visual === 'swarm' && !projBehaviors.some(b => b.type === 'swarmAI')) {
      projBehaviors.push(makeBehavior('swarmAI', true));
    }

    if (props.WAIT_TO_CYCLE) projBehaviors.push(makeBehavior('waitToCycle', true));
    if (props.WAIT_TO_CYCLE && props.DELAY_SPAWN === false) projBehaviors.push(makeBehavior('startsLoaded', true));
    if (props.DESTROY_OLDEST_CHILD) projBehaviors.push(makeBehavior('destroyOldest', true));

    const hasFollowMouse = projBehaviors.some(b => b.type === 'followMouse');
    const hasMinionControl = projBehaviors.some(b => b.type === 'minionControl');
    if (!hasFollowMouse) {
      const ateIdx = projBehaviors.findIndex(b => b.type === 'autoTargetEnemy');
      if (ateIdx >= 0 && !hasMinionControl) projBehaviors.splice(ateIdx, 1);
      const tsIdx = projBehaviors.findIndex(b => b.type === 'targetSelf');
      if (tsIdx >= 0) projBehaviors.splice(tsIdx, 1);
    }

    if (depth >= 1) {
      const fmIdx = projBehaviors.findIndex(b => b.type === 'followMouse');
      if (fmIdx >= 0) projBehaviors.splice(fmIdx, 1);
    }

    const hasGoToTarget = projBehaviors.some(b => b.type === 'goToTarget');

    const bulletSize = isAmmoBarrel ? shootSettings.size : convertBulletSize(shootSettings.size, pos.WIDTH, pos.ASPECT);
    const ownBodySpeed = calibVisual === 'minion' ? resolveBodyNumber(projClassDef, 'SPEED', registry) : undefined;

    const burst: { explode?: DeathBurst } = {};

    const projectileType: any = {
      visual,
      shape: projShape,
      size: bulletSize,
      useMuzzleSize: true,
      color: 'inherit',
      useTankColor: true,
      maxAlive: props.MAX_CHILDREN ?? 0,
      lifetime: 0,
      dieAtRange: visual === 'trap' || visual === 'boomerang',
      motionType: motion,
      facingType: facing,
      growRate: 1,
      subTurrets: [],
      customProjectileDesign: tankAsProjectileName ? undefined
        : ((projClassDef && !isAmmoBarrel && depth < 2)
          ? buildCustomProjectileDesign(projClassDef, registry, visual, projShape, motion, facing, projTrapDepth, hasGoToTarget, bulletSize, depth,
              bodyArrasSize != null ? bodyArrasSize * (pos.WIDTH / 10) * shootSettings.size / 2 : undefined,
              ROUND_GUN_SCALE_ON_MINIONS && visual === 'minion' ? typeOptions.GUN_STAT_SCALE : undefined, burst)
          : undefined),
      persistsAfterDeath: (typeOptions.PERSISTS_AFTER_DEATH ?? props.PERSISTS_AFTER_DEATH
        ?? (projClassDef ? resolveField(projClassDef, 'PERSISTS_AFTER_DEATH', registry) : undefined) ?? false) === true,
      trapDepth: projTrapDepth,
      trapCurved: false,
      friction: visual === 'trap' ? 0.05 : 0,
      hitsOwnType: mapHitsOwnType((projClassDef as any)?.HITS_OWN_TYPE) ?? (visual === 'drone' ? 'drone' : (visual === 'trap' ? 'push' : (visual === 'minion' ? 'hardWithBuffer' : 'none'))),
      density: visual === 'trap' ? (hasGoToTarget ? 5 : 2.5) : 1,
      bounciness: (hasGoToTarget || projShape === 4) ? 0 : 0.9,
      bouncy: (hasGoToTarget || projShape === 4) ? false : true,
      statCalculatorType: statCalc,
      topSpeedRatio: computeTopSpeedRatio(shootSettings.speed, shootSettings.maxSpeed, calibVisual === 'trap' ? 'trap' : calibVisual === 'swarm' ? 'swarm' : calibVisual === 'drone' ? 'drone' : calibVisual === 'minion' ? 'minion' : calibVisual === 'hive' ? 'hive' : calibVisual === 'boomerang' ? 'boomerang' : 'bullet', ownBodySpeed),
      motorDampLn: calibVisual === 'boomerang' ? (() => {
        const tsr = computeTopSpeedRatio(shootSettings.speed, shootSettings.maxSpeed, 'boomerang');
        const arrasTopSpeed = shootSettings.speed * tsr;
        if (arrasTopSpeed < 0.01) return undefined;
        const k = 1 / arrasTopSpeed;
        return -Math.log(1 + k) / 2;
      })() : undefined,
      tankAsProjectile: tankAsProjectileName,
      tankAsProjectileUseAI: tankAsProjectileName ? true : undefined,
      necroInfect: !!((projClassDef as any)?.NECRO),
    };
    if (!isAmmoBarrel && projClassDef) {
      if (resolveField(projClassDef, 'TYPE', registry) === 'swarm' && motion !== 'swarm') (projectileType as any).rangeDamage = true;
      if (visual === 'minion' && resolveField(projClassDef, 'BUFF_VS_FOOD', registry) === true) (projectileType as any).buffVsFood = true;
    }

    const projArrasOnly = collectProjectileArrasOnly(projClassDef);
    if (projArrasOnly) (projectileType as any)._arrasOnly = projArrasOnly;

    const turret: any = {
      id: nextSharedTurretId(),
      length: convertBarrelLength(pos.LENGTH),
      width: convertBarrelWidth(pos.ASPECT < 0 ? pos.WIDTH * Math.abs(pos.ASPECT) : pos.WIDTH),
      aspect: pos.ASPECT < 0 ? 1 / Math.abs(pos.ASPECT) : pos.ASPECT,
      xOffset: convertBarrelX(pos.X * Math.cos(pos.ANGLE * Math.PI / 180) - pos.Y * Math.sin(pos.ANGLE * Math.PI / 180)),
      yOffset: convertBarrelY(pos.X * Math.sin(pos.ANGLE * Math.PI / 180) + pos.Y * Math.cos(pos.ANGLE * Math.PI / 180)),
      angle: pos.ANGLE * Math.PI / 180,
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
      shootResist: converted._arrasResist ?? 1,
      fightResist: typeof props.FIGHT_RESIST === 'number' ? props.FIGHT_RESIST : undefined,
      shootDensity: ((converted as any)._arrasDensity ?? 1) !== 1 ? (converted as any)._arrasDensity : undefined,
      isCustom: false,
      animProgress: 0,
      turretType: isAmmoBarrel ? 'decorative' : 'regular',
      alwaysAbove: false,
      alwaysShoot: props.AUTOFIRE ?? false,
      independent: false,
      fov: 200,
      fovSize: 10,
      autoTargetPriority: 'nearest',
      maxTurnSpeed: 4.5,
      autoFireDelay: 0,
      manualControl: false,
      autoCircleSize: 25,
      autoTurretLength: 7,
      autoTurretWidth: 20,
      projectileType,
      projectileBehaviors: projBehaviors,
      visualLayers: [],
      autoCurrentAngle: 0,
      autoTargetId: null,
      autoShapeLockId: null,
      aboveTankBody: props.DRAW_ABOVE ?? false,
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
      altFire: props.ALT_FIRE ?? false,
      syncsSkills: props.SYNCS_SKILLS ?? false,
      necro: props.NECRO ?? false,
      healer: props.HEALER ?? (resolveHealerFlag(projClassDef, registry) || /^healer/i.test(typeClassName)),
      gunStatScale: props.GUN_STAT_SCALE ?? 1.0,
    };
    if (burst.explode) turret.explode = burst.explode;

    if (typeof turret.gunStatScale === 'object' && turret.gunStatScale !== null) {
      const gss = turret.gunStatScale as Record<string, number>;
      if (gss.damage != null) turret.bulletDamage *= gss.damage;
      if (gss.health != null) turret.bulletHealthBase *= gss.health;
      if (gss.pen != null) turret.bulletPenetration *= gss.pen;
      if (gss.speed != null) {
        turret.speed *= gss.speed;
        if (turret.projectileType?.topSpeedRatio != null && gss.speed !== 0) {
          turret.projectileType.topSpeedRatio /= gss.speed;
        }
      }
      if (gss.range != null) turret.bulletLifetime *= gss.range;
      if (gss.reload != null) turret.bps *= gss.reload;
      if (gss.recoil != null) turret.knockback *= gss.recoil;
      turret.gunStatScale = 1.0;
    }

    if (typeOptions && typeOptions.INVISIBLE) {
      const rates = typeOptions.INVISIBLE;
      const fadeInRate = Array.isArray(rates) ? (rates[0] ?? 0.08) / 2 : 0.04;
      const fadeOutRate = Array.isArray(rates) ? (rates[1] ?? 0.03) / 2 : 0.015;
      const invisBehavior = makeBehavior('invisible', true);
      invisBehavior.invisFadeInRate = fadeInRate;
      invisBehavior.invisFadeOutRate = fadeOutRate;
      turret.projectileBehaviors.push(invisBehavior);
      turret.projectileBehaviors = turret.projectileBehaviors.filter(
        (bh: any) => bh.type !== 'hangNearOwner' && bh.type !== 'hangNearOwnerV2'
      );
      if (alphaIsCapped(typeOptions.ALPHA)) {
        turret.projectileBehaviors.push(makeBehavior('alwaysInvisible', true));
      }
    }

    const gunArrasOnly = collectGunArrasOnly(props);
    if (gunArrasOnly) turret._arrasOnly = gunArrasOnly;

    applyTurretMeta(turret as any, props);
    if (projClassDef) {
      applyProjectileMeta(turret.projectileType as any, projClassDef as any);
    }
    applyProjectileMetaInline(turret.projectileType as any, props);

    turrets.push(turret);
  }

  return turrets;
}

export const PRIMARY_SUB_TURRET_OVERRIDES: Record<string, number> = {
  crossbowTurret: 7,
  tripleShotTurret: 3,
  spreadshotTurret: 11,
  pentaShotTurret: 5,
};

function pickPrimarySubTurretId(typeName: string, autoSubTurrets: any[]): string | null {
  if (autoSubTurrets.length === 0) return null;
  const overrideIdx = PRIMARY_SUB_TURRET_OVERRIDES[typeName];
  if (overrideIdx !== undefined && overrideIdx >= 1 && overrideIdx <= autoSubTurrets.length) {
    return autoSubTurrets[overrideIdx - 1].id;
  }
  return autoSubTurrets[0].id;
}

export interface AutoTurretMount { size?: number; dreadBody?: boolean; onRound?: boolean }

export const ARRAS_TURRET_TURN_CEILING = 40;
const ARRAS_UNIT = 1;
const FOV_SIZE_UNITS = 60;
const FOV_SIZE_LOADER_MAX = 68;

export function sightToFovSize(arrasFov: number, turretArrasSize: number): number {
  const units = arrasFov * 275 * Math.sqrt(turretArrasSize) * ARRAS_UNIT;
  return Math.max(1, Math.min(FOV_SIZE_LOADER_MAX, Math.round(units / FOV_SIZE_UNITS)));
}

const MOTION_BEHAVIOR_TYPE: Record<string, string> = {
  motionGlide: 'glide', motionMotor: 'motor', motionChase: 'chase', motionSwarm: 'swarm', motionGrow: 'grow', motionWithMaster: 'withMaster',
};
const STEERING_BEHAVIOR_TYPES = new Set(['followMouse', 'autoTargetEnemy', 'hangNearOwner', 'hangNearOwnerV2', 'minionControl', 'goToTarget', 'swarmAI']);
export function roundFliesALine(gun: any, onRound = false): boolean {
  if (!gun || gun.turretType === 'decorative') return false;
  const pt = gun.projectileType;
  const behaviors: any[] = Array.isArray(gun.projectileBehaviors) ? gun.projectileBehaviors : [];
  let motion: string = pt?.motionType || 'glide';
  for (const b of behaviors) { if (b?.enabled && MOTION_BEHAVIOR_TYPE[b.type]) { motion = MOTION_BEHAVIOR_TYPE[b.type]!; break; } }
  if (motion === 'glide' && behaviors.some((b) => b?.enabled && STEERING_BEHAVIOR_TYPES.has(b.type))) motion = 'motor';
  if (motion !== 'glide') return false;
  if (!((pt?.topSpeedRatio ?? 1) > 0)) return false;
  const lookOnly = (t: any): boolean => !!t && (t.look !== undefined || (Array.isArray(t.autoSubTurrets) && t.autoSubTurrets.length > 0 && t.autoSubTurrets.every((x: any) => x && x.look !== undefined)));
  if (((pt?.customProjectileDesign?.turrets ?? []) as any[]).some((t) => !lookOnly(t)) || (pt?.subTurrets?.length ?? 0) > 0) return false;
  if (!(typeof gun.speed === 'number' && (onRound ? gun.speed > 0 : gun.speed + 5 > 0))) return false;
  if (!((pt?.lifetime ?? 0) > 0 || (gun.bulletLifetime ?? 3) > 0)) return false;
  return true;
}

export function isDreadnoughtV2Class(cls: ArrasClassDef | undefined, registry: Registry): boolean {
  let cur: any = cls;
  const visited = new Set<string>();
  while (cur) {
    const pn = typeof cur.PARENT === 'string' ? cur.PARENT : (Array.isArray(cur.PARENT) ? cur.PARENT[0] : null);
    if (!pn || visited.has(pn)) return false;
    if (pn === 'genericDreadnoughtOfficialV2') return true;
    visited.add(pn);
    cur = registry.get(pn);
  }
  return false;
}

export function mergeRestoredLooks(list: any[]): any[] {
  const byId = new Map<string, any>();
  for (const t of list) if (t && !t._restoredLook && t.id) byId.set(t.id, t);
  const out: any[] = [];
  for (const t of list) {
    if (!t?._restoredLook) { out.push(t); continue; }
    const { _restoredLook: _r, ...part } = t;
    const gun = part.id ? byId.get(part.id) : undefined;
    if (gun) gun.look = part.look;
    else out.push(part);
  }
  return out;
}

export function mapAutoTurrets(turretDefs: any[] | undefined, registry: Registry, parentColor?: string | number, depth: number = 0, mount?: AutoTurretMount): any[] {
  if (!turretDefs || !Array.isArray(turretDefs)) return [];
  const turrets: any[] = [];

  for (const td of turretDefs) {
    if (!td || !td.TYPE) continue;

    let typeName: string;
    let typeOptions: any = {};
    let turretClassOverride: ArrasClassDef | null = null;
    if (typeof td.TYPE === 'string') {
      typeName = td.TYPE;
    } else if (Array.isArray(td.TYPE)) {
      const first = td.TYPE[0];
      typeOptions = td.TYPE[1] || {};
      if (typeof first === 'string') {
        typeName = first;
      } else if (typeof first === 'object' && first !== null) {
        turretClassOverride = first as ArrasClassDef;
        typeName = (first as any).PARENT || (first as any).LABEL || (first as any)._className || 'inlineClass';
      } else {
        continue;
      }
    } else if (typeof td.TYPE === 'object' && td.TYPE !== null) {
      if ((td.TYPE as any)._className) {
        typeName = (td.TYPE as any)._className;
      } else {
        turretClassOverride = td.TYPE as ArrasClassDef;
        typeName = (td.TYPE as any).PARENT || (td.TYPE as any).LABEL || 'inlineClass';
      }
    } else {
      continue;
    }

    if (!typeName || typeof typeName !== 'string') continue;
    if (/Layer\d+$/.test(typeName)) continue;

    const healerSymbolClass = turretClassOverride || registry.get(typeName);
    const nexum: any = healerSymbolClass;
    if (nexum?.[ISTRONG_LOOK_KEY]) { turrets.push({ ...JSON.parse(JSON.stringify(nexum[ISTRONG_LOOK_KEY])), _restoredLook: true }); continue; }
    if (nexum?.[ISTRONG_PICTURE_KEY]) continue;
    const _hasHealerSym = hasHealerSymbol(healerSymbolClass ?? undefined, registry);

    if (/Body\d*$/.test(typeName) || typeName.toLowerCase().includes('symbol')) continue;

    const turretClassCheck = turretClassOverride || registry.get(typeName);
    const isInvisibleSpawner = (turretClassCheck as any)?.SHAPE === '';

    const pos = normalizeTurretPosition(td.POSITION);
    const turretSize = pos[0] ?? 10;
    const turretRadialDist = pos[1] ?? 0;
    const turretY = pos[2] ?? 0;
    const turretAngleDeg = pos[3] ?? 0;
    const turretArc = pos[4] ?? 360;
    const turretLayer = pos[5] ?? 0;

    const angleRad = turretAngleDeg * Math.PI / 180;
    const xOff = convertTurretX(turretRadialDist * Math.cos(angleRad) + turretY * Math.sin(angleRad));
    const yOff = convertTurretY(turretRadialDist * Math.sin(angleRad) - turretY * Math.cos(angleRad));

    const turretClass = turretClassOverride || registry.get(typeName);

    const turretColor = typeOptions.COLOR ?? (turretClass as any)?.COLOR;
    const autoCircleColorMatch = turretColor === -1 || turretColor === 'mirror'
      || (parentColor != null && turretColor === parentColor);
    let subGuns: any[] = (turretClass as any)?.GUNS ?? [];
    const autoOwn: Record<string, any> | null = (turretClass as any)?.[ISTRONG_AUTO_KEY] ?? null;
    if (autoOwn?.aura === true) subGuns = subGuns.filter((g: any) => !['aura', 'healAura'].includes(Array.isArray(g?.PROPERTIES?.TYPE) ? g.PROPERTIES.TYPE[0] : g?.PROPERTIES?.TYPE));

    if (subGuns.length === 0 && typeName.endsWith('Turret')) {
      const baseName = typeName.slice(0, -6);
      const baseClass = registry.get(baseName);
      if ((baseClass as any)?.GUNS && (baseClass as any).GUNS.length > 0) {
        subGuns = (baseClass as any).GUNS;
      }
    }

    const turretArrasSize = mount?.size != null ? mount.size * turretSize / 20 : undefined;
    const _slipRows = misplacedTurretOptionRows(turretClass);
    const _gss = typeOptions.GUN_STAT_SCALE;
    const _turretRows = _slipRows === null ? _gss
      : [..._slipRows, ...(_gss == null ? [] : (Array.isArray(_gss) && _gss.length > 0 && typeof _gss[0] === 'object' ? _gss : [_gss]))];
    const autoSubTurrets = mapGuns(subGuns, registry, depth, _turretRows, turretArrasSize);

    const turretClassBody = (turretClass as any)?.BODY;
    const arrasDetectionFOV = turretClassBody?.FOV ?? 2;
    const primarySubId = pickPrimarySubTurretId(typeName, autoSubTurrets);
    let reachGun = autoSubTurrets.find((s: any) => s.id === primarySubId);
    if (!reachGun || reachGun.turretType === 'decorative') reachGun = autoSubTurrets.find((s: any) => s.turretType !== 'decorative');
    const fovSizeConverted = turretArrasSize != null && roundFliesALine(reachGun, mount?.onRound === true)
      ? sightToFovSize(resolveBodyNumber(turretClass ?? undefined, 'FOV', registry) ?? 2, turretArrasSize)
      : Math.max(1, Math.min(100, Math.round(arrasDetectionFOV * 5)));
    const arrasIndependent = (typeOptions.INDEPENDENT ?? resolveField(turretClass ?? undefined, 'INDEPENDENT', registry)) === true;

    const typeControllers = resolveControllers(turretClass ?? undefined, registry);
    const spinOnly = typeControllers !== null && isSpinOnlyControllers(typeControllers);

    const facingTypeSpin = resolveFacingTypeSpin(turretClass ?? undefined, registry);
    const hasFacingTypeSpin = facingTypeSpin !== null && facingTypeSpin !== 0;
    const controllerSpin = spinOnly && typeControllers ? extractControllerSpinSpeed(typeControllers) : null;

    let autoCircleSpin = false;
    let autoCircleSpinMode: 'fixed' | 'withBody' = 'fixed';
    let autoCircleSpinSpeed = 50;
    let autoCircleSpinDirection: 1 | -1 = 1;

    if (spinOnly && controllerSpin !== null) {
      autoCircleSpin = true;
      autoCircleSpinMode = 'withBody';
      autoCircleSpinSpeed = Math.min(500, Math.round(Math.abs(controllerSpin) * TURRET_SPIN_MULT));
      autoCircleSpinDirection = controllerSpin >= 0 ? 1 : -1;
    } else if (hasFacingTypeSpin && !typeControllers) {
      autoCircleSpin = true;
      autoCircleSpinMode = 'fixed';
      autoCircleSpinSpeed = Math.min(500, Math.round(Math.abs(facingTypeSpin!) * TURRET_SPIN_MULT));
      autoCircleSpinDirection = facingTypeSpin! >= 0 ? 1 : -1;
    }

    const autoCircleSize = Math.min(50, turretSize * 1.86);
    const autoTurretLength = 1;
    const autoTurretWidth = 0;

    const turret: any = {
      id: nextSharedTurretId(),
      length: 1,
      width: 0,
      aspect: 1,
      xOffset: xOff,
      yOffset: yOff,
      angle: angleRad,
      bps: 0,
      speed: 0,
      delay: 0,
      knockback: 0,
      spread: 0,
      bulletDamage: 0,
      bulletHealthBase: 0,
      bulletPenetration: 0,
      bulletLifetime: 0,
      shootResist: 1,
      isCustom: false,
      animProgress: 0,
      turretType: 'auto',
      alwaysAbove: false,
      alwaysShoot: false,
      independent: typeOptions.INDEPENDENT ?? (turretClass as any)?.INDEPENDENT ?? true,
      fov: turretArc,
      fovSize: fovSizeConverted,
      autoTargetPriority: 'nearest',
      maxTurnSpeed: ARRAS_TURRET_TURN_CEILING,
      autoFireDelay: 0,
      manualControl: (hasCanRepel(typeControllers) && !(mount?.dreadBody === true && arrasIndependent))
        || typeName === 'antiTankMachineGunArm' || typeName === 'cxATMGArm',
      autoCircleSize: autoCircleSize,
      autoCircleBaseSides: (() => {
        const decoShape = (turretClass as any)?.SHAPE ?? (turretClassOverride as any)?.SHAPE;
        if (typeof decoShape === 'number' && Math.abs(decoShape) >= 3) return Math.abs(decoShape);
        if (Array.isArray(decoShape)) return decoShape.length;
        return 0;
      })(),
      autoCircleHidden: spinOnly || isInvisibleSpawner,
      autoCircleFixed: hasExplicitlyEmptyControllers(turretClass ?? undefined),
      autoCircleColorMatch,
      autoCircleHealer: _hasHealerSym,
      autoCircleSpin,
      autoCircleSpinMode,
      autoCircleSpinSpeed,
      autoCircleSpinDirection,
      autoTurretLength,
      autoTurretWidth,
      projectileType: {
        visual: 'bullet', shape: 0, size: 1, useMuzzleSize: true,
        color: 'inherit', useTankColor: true, maxAlive: 0, lifetime: 0,
        dieAtRange: false, motionType: 'glide', facingType: 'smoothWithMotion',
        growRate: 1, subTurrets: [], customProjectileDesign: null, persistsAfterDeath: false,
        trapDepth: 0, trapCurved: false, friction: 0,
        hitsOwnType: 'none', density: 1, bounciness: 0.9, bouncy: true,
        statCalculatorType: 'bullet',
      },
      projectileBehaviors: [],
      visualLayers: [],
      autoCurrentAngle: 0,
      autoTargetId: null,
      autoShapeLockId: null,
      aboveTankBody: turretLayer >= 1,
      renderLayer: turretLayer >= 1 ? (spinOnly ? 2 : 1) : 0,
      autoFire: false,
      wifiRange: false,
      wifiRangeValue: 50,
      recoilPosition: 0,
      recoilVelocity: 0,
      physRecoilPos: 0,
      physRecoilVel: 0,
      physRecoilDirX: 0,
      physRecoilDirY: 0,
      autoSubTurrets,
      primarySubTurretId: primarySubId,
      altFire: false,
      syncsSkills: false,
      necro: false,
      healer: false,
      gunStatScale: 1.0,
      _sourceTypeName: typeName,
      _isNested: false,
    };

    applyTurretMeta(turret as any, td as any);

    turrets.push(turret);

    if (autoOwn) {
      Object.assign(turret, autoOwn);
      const inner = mapAutoTurrets((turretClass as any).TURRETS ?? [], registry, undefined, depth, undefined).filter((t: any) => t._restoredLook);
      turret.autoSubTurrets = mergeRestoredLooks([...turret.autoSubTurrets, ...inner]);
      continue;
    }

    if ((turretClass as any)?.TURRETS && Array.isArray((turretClass as any).TURRETS) && (turretClass as any).TURRETS.length > 0) {
      const nestedTurrets = mapAutoTurrets((turretClass as any).TURRETS, registry, undefined, depth,
        mount ? { size: turretArrasSize, dreadBody: mount.dreadBody, onRound: mount.onRound } : undefined);
      const sizeScale = turretSize / 20;
      for (const nt of nestedTurrets) {
        nt.xOffset = nt.xOffset * sizeScale + xOff;
        nt.yOffset = nt.yOffset * sizeScale + yOff;
        nt.autoCircleSize = Math.min(50, nt.autoCircleSize * sizeScale);
        if (turretLayer >= 1) nt.aboveTankBody = true;
        if (turretLayer >= 1) nt.renderLayer = 1;
        nt._sourceTypeName = typeName;
        nt._isNested = true;
        turrets.push(nt);
      }
    }
  }

  return turrets;
}

export function buildCustomProjectileDesign(
  projClassDef: ArrasClassDef,
  registry: Registry,
  visual: string,
  projShape: number,
  motion: string,
  facing: string,
  projTrapDepth: number,
  hasGoToTarget: boolean,
  bulletSize: number,
  depth: number = 0,
  roundArrasSize?: number,
  roundGunScale?: unknown,
  burstOut?: { explode?: DeathBurst },
): any | null {
  if (depth > 2) return null;

  const hasGuns = (projClassDef as any).GUNS && Array.isArray((projClassDef as any).GUNS) && (projClassDef as any).GUNS.length > 0;
  const hasTurrets = (projClassDef as any).TURRETS && Array.isArray((projClassDef as any).TURRETS) && (projClassDef as any).TURRETS.length > 0;
  if (!hasGuns && !hasTurrets) return null;

  const allTurrets: any[] = [];

  if (hasGuns) {
    const isDeathGun = (g: any) => g?.PROPERTIES?.SHOOT_ON_DEATH === true;
    const allGuns: any[] = (projClassDef as any).GUNS;
    const deathGuns = allGuns.filter(isDeathGun);
    const liveGuns = deathGuns.length > 0 ? allGuns.filter((g) => !isDeathGun(g)) : allGuns;
    if (deathGuns.length > 0 && burstOut) {
      const pieces = mapGuns(deathGuns, registry, depth + 1, roundGunScale, roundArrasSize);
      burstOut.explode = burstOfDeathGuns(deathGuns.map((g, i) => {
        const p = normalizeGunPosition(g.POSITION);
        return { angleDeg: p.ANGLE, x: p.X, y: p.Y, template: pieces[i] };
      }), String((projClassDef as any)._className ?? projClassDef.LABEL ?? 'a round'));
    }
    const gunTurrets = mapGuns(liveGuns, registry, depth + 1, roundGunScale, roundArrasSize);
    for (const gt of gunTurrets) {
      gt.alwaysShoot = true;
      gt.autoFire = true;
    }
    allTurrets.push(...gunTurrets);
  }

  if (hasTurrets) {
    const autoTurrets = mapAutoTurrets((projClassDef as any).TURRETS, registry, undefined, depth + 1,
      roundArrasSize != null ? { size: roundArrasSize, onRound: true } : undefined);
    allTurrets.push(...autoTurrets);
  }

  if (allTurrets.length === 0) return null;

  const hitsOwn = mapHitsOwnType((projClassDef as any).HITS_OWN_TYPE)
    ?? (visual === 'drone' ? 'drone' : (visual === 'trap' ? 'push' : (visual === 'minion' ? 'hardWithBuffer' : 'none')));

  const cpd: any = {
    name: PROJECTILE_NAME_OVERRIDES[(projClassDef as any)._className ?? '']
      ?? (projClassDef as any).LABEL
      ?? (projClassDef as any)._className
      ?? 'arras-projectile',
    visual,
    shape: projShape,
    size: bulletSize,
    useMuzzleSize: true,
    color: 'inherit',
    useTankColor: true,
    motionType: motion,
    facingType: facing,
    growRate: 1,
    turrets: mergeRestoredLooks(allTurrets),
    mountedTurret: null,
    trapDepth: projTrapDepth,
    trapCurved: false,
    friction: visual === 'trap' ? 0.05 : 0,
    hitsOwnType: hitsOwn,
    density: visual === 'trap' ? (hasGoToTarget ? 5 : 2.5) : 1,
    bounciness: (hasGoToTarget || projShape === 4) ? 0 : 0.9,
    bouncy: (hasGoToTarget || projShape === 4) ? false : true,
  };

  if (Array.isArray((projClassDef as any).TURRETS) && (projClassDef as any).TURRETS.length > 0) {
    const bodyLayers: any[] = [];
    for (const td of (projClassDef as any).TURRETS) {
      const tType = typeof td.TYPE === 'string' ? td.TYPE
                  : (Array.isArray(td.TYPE) ? td.TYPE[0] : '');
      if (!tType || !/Body\d*$/.test(tType) || /Layer\d+$/.test(tType)) continue;
      let cls: any = registry.get(tType) ?? BODY_OVERLAY_DEFS[tType] ?? null;
      if (!cls) continue;
      const pos = Array.isArray(td.POSITION) ? td.POSITION : [20];
      const sizeRatio = (pos[0] ?? 20) / 20;
      let shape = 6;
      let spinSpeed = 0;
      let spinDir: 1 | -1 = 1;
      const visited = new Set<string>();
      let cur: any = cls;
      while (cur) {
        if (cur.SHAPE !== undefined && shape === 6) shape = cur.SHAPE;
        if (cur.FACING_TYPE !== undefined) {
          const ft = cur.FACING_TYPE;
          if (Array.isArray(ft) && ft[0] === 'spin') {
            const spd = ft[1]?.speed ?? 0;
            spinDir = spd >= 0 ? 1 : -1;
            spinSpeed = Math.round(Math.abs(spd) * TURRET_SPIN_MULT);
          }
          break;
        }
        const pn = typeof cur.PARENT === 'string' ? cur.PARENT
                 : (Array.isArray(cur.PARENT) ? cur.PARENT[0] : null);
        if (!pn || visited.has(pn)) break;
        visited.add(pn);
        cur = registry.get(pn) ?? BODY_OVERLAY_DEFS[pn] ?? null;
      }
      bodyLayers.push({
        id: `layer-smasher-${bodyLayers.length}`,
        label: tType.replace(/Body$/, '').replace(/^./, (c: string) => c.toUpperCase()),
        sides: shape, sizeRatio, color: '#484848', colorMap: RAMMER_RING_SLOT, useInheritColor: false,
        spinEnabled: spinSpeed > 0, spinDirection: spinDir, spinSpeed,
        copies: 1, initialAngle: 0, starDepth: 0, starCurved: false,
        intangible: true, showHealerCross: false, stationary: false,
        turretIds: [], renderOrder: 0, maxAliveEnabled: false, maxAlive: 0, _currentAngle: 0,
      });
    }
    if (bodyLayers.length > 0) {
      cpd.bodyLayers = bodyLayers;
      cpd.maxBodyLayerRatio = Math.max(1.0, ...bodyLayers.map(l => l.sizeRatio));
    }
  }

  return cpd;
}

export function buildSmasherBodyLayers(turrets: any[] | undefined, registry: Registry): any[] {
  const result: any[] = [];
  if (!turrets || turrets.length === 0) return result;

  type BodyTurretInfo = {
    typeName: string;
    size: number;
    angleDeg: number;
    shape: number;
    spinSpeed: number;
    spinDir: 1 | -1;
    color: string;
    isStationary: boolean;
    stationaryAngle: number;
    sourceTd: any;
  };
  const bodyTurrets: BodyTurretInfo[] = [];

  for (const td of turrets) {
    const tTypeRaw = td.TYPE;
    let typeName = '';
    if (typeof tTypeRaw === 'string') typeName = tTypeRaw;
    else if (Array.isArray(tTypeRaw) && typeof tTypeRaw[0] === 'string') typeName = tTypeRaw[0];
    else if (tTypeRaw && typeof tTypeRaw === 'object' && (tTypeRaw as any)._className) typeName = (tTypeRaw as any)._className;
    if (!typeName) continue;

    if (!/Body\d*$/.test(typeName)) continue;
    if (/Layer\d+$/.test(typeName)) continue;

    let turretClass: any = registry.get(typeName);
    if (!turretClass) {
      turretClass = SMASHER_BODY_DEFS[typeName] ?? null;
      if (!turretClass) continue;
    }

    const pos = Array.isArray(td.POSITION)
      ? td.POSITION
      : (td.POSITION && typeof td.POSITION === 'object' ? [td.POSITION.SIZE ?? 20, 0, 0, td.POSITION.ANGLE ?? 0, 360, 0] : [20, 0, 0, 0, 360, 0]);
    const turretSize = pos[0] ?? 20;
    const angleDeg = pos[3] ?? 0;

    const shape = resolveBodyOverlayField(turretClass, 'SHAPE', registry) ?? 6;
    let spinSpd = 0;
    let spinDir: 1 | -1 = 1;
    let isStationary = false;
    let stationaryAngle = 0;
    const ft = resolveBodyOverlayField(turretClass, 'FACING_TYPE', registry);
    if (ft && Array.isArray(ft) && ft[0] === 'spin') {
      const speed = ft[1]?.speed ?? 0;
      spinDir = speed >= 0 ? 1 : -1;
      spinSpd = Math.abs(speed);
    } else if (ft && Array.isArray(ft) && ft[0] === 'noFacing') {
      spinSpd = 0;
      isStationary = true;
      stationaryAngle = ft[1]?.angle ?? 0;
    } else if (ft === 'noFacing') {
      spinSpd = 0;
      isStationary = true;
    }

    bodyTurrets.push({
      sourceTd: td,
      typeName, size: turretSize, angleDeg, shape,
      spinSpeed: spinSpd, spinDir, color: '#484848',
      isStationary, stationaryAngle,
    });
  }

  if (bodyTurrets.length > 0) {
    const groups = new Map<string, BodyTurretInfo[]>();
    for (const bt of bodyTurrets) {
      const key = `${bt.typeName}|${bt.shape}|${bt.color}|${bt.spinSpeed}|${bt.spinDir}|${bt.isStationary}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(bt);
    }

    let layerIdx = 0;
    for (const [, group] of groups) {
      const count = group.length;
      const first = group[0]!;
      const sizeRatio = first.size / 20;
      const iStrongSpinSpeed = Math.round(first.spinSpeed * ARRAS_SPIN_MULTIPLIER);
      const initialAngle = first.isStationary
        ? first.stationaryAngle
        : ((first.angleDeg || 0) * Math.PI / 180);
      const bodyLayer: any = {
        id: `layer-smasher-${layerIdx}`,
        label: first.typeName.replace(/Body$/, '').replace(/^./, (c: string) => c.toUpperCase()),
        sides: first.shape,
        sizeRatio,
        color: first.color,
        colorMap: RAMMER_RING_SLOT,
        useInheritColor: false,
        spinEnabled: first.spinSpeed > 0,
        spinDirection: first.spinDir,
        spinSpeed: iStrongSpinSpeed,
        copies: count > 1 ? count : 1,
        initialAngle: count > 1 ? 0 : initialAngle,
        starDepth: 0,
        starCurved: false,
        intangible: true,
        showHealerCross: false,
        stationary: first.isStationary,
        turretIds: [],
        renderOrder: 0,
        maxAliveEnabled: false,
        maxAlive: 0,
        _currentAngle: 0,
      };
      applyBodyLayerMeta(bodyLayer, first.sourceTd);
      result.push(bodyLayer);
      layerIdx++;
    }
  }

  return result;
}
