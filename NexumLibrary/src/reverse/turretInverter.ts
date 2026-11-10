import type { IstrongTurret } from '../types/istrong.js';
import type { ArrasGunEmit, ArrasClassEmit } from '../types/warnings.js';
import type { WarningCollector } from '../warnings/collector.js';
import { ALWAYS_INVISIBLE_ARRAS_CAP } from '../forward/alwaysInvisible.js';
import {
  invertBarrelLength,
  invertBarrelWidth,
  invertBarrelX,
  invertBarrelY,
  invertBPSToReload,
  invertBulletSpeed,
  invertTankBarrelSpeed,
  invertRoundBarrelSpeed,
  invertRoundLifetime,
  invertBulletSize,
  invertRecoil,
  invertSpread,
  invertDamage,
  invertBulletHealth,
  invertPenetration,
  invertLifetime,
  invertTopSpeedRatio,
  invertBlockTopSpeed,
  invertBoomerangDrive,
  invertAutoTurretSize,
} from './physicsInverter.js';
import { invertBehaviors, invertMotionType, invertFacingType, invertStatCalculator } from './behaviorInverter.js';
import { buildCpdClass } from './cpdInverter.js';
import { buildAutoTurretEntry } from './autoTurretInverter.js';
import { emitGunArrasOnly, emitProjectileArrasOnly } from './arrasOnlyEmitter.js';
import { emitTurretMeta, emitProjectileMeta, emitProjectileMetaInline } from './istrongMetaEmitter.js';
import { explodeAngleDeg } from '../forward/deathBurst.js';
import { designClasses } from './designInverter.js';
import { ARRAS_RUN_SPEED } from '../constants/physics.js';
import { ISTRONG_LOOK_KEY, ISTRONG_PICTURE_KEY } from '../types/istrongMeta.js';

interface Frame { above: 'aboveTankBody' | 'aboveBase'; lookBody: number; recoilK: number; chain: number[] }
const ON_A_BODY: Frame = { above: 'aboveTankBody', lookBody: 1, recoilK: 1, chain: [] };
let frame: Frame = ON_A_BODY;
let tankK = 1;
export function withFrame<T>(f: Partial<Frame>, fn: () => T): T {
  const was = frame;
  frame = { ...frame, ...f };
  try {
    return fn();
  } finally {
    frame = was;
  }
}
export function withTankK<T>(k: number, fn: () => T): T {
  const was = tankK;
  tankK = k;
  try {
    return fn();
  } finally {
    tankK = was;
  }
}
const product = (xs: number[]) => xs.reduce((a, b) => a * b, 1);
export function holderFrame(bs: number): Partial<Frame> {
  const chain = [...frame.chain, bs];
  return { above: 'aboveTankBody', lookBody: 1, chain, recoilK: product(frame.chain) / bs };
}
export const drawOrderInversions = { count: 0, tanks: new Set<string>() };

const ROUND_PARENT: Record<string, string> = { bullet: 'bullet', drone: 'drone', swarm: 'swarm', trap: 'trap', minion: 'minion', hive: 'hive', boomerang: 'boomerang' };

const MOTION_OF: Record<string, string> = {
  motionGlide: 'glide', motionMotor: 'motor', motionChase: 'chase', motionSwarm: 'swarm', motionGrow: 'grow', motionWithMaster: 'withMaster',
};
const STEERS = new Set(['followMouse', 'autoTargetEnemy', 'hangNearOwner', 'hangNearOwnerV2', 'minionControl', 'goToTarget', 'swarmAI']);
let carrierTouch = 1;
const OSA_ROUND_DEFAULTS: Record<string, { shape: number; own: string }> = {
  bullet: { shape: 0, own: 'never' }, trap: { shape: -3, own: 'push' }, setTrap: { shape: -4, own: 'push' }, unsetTrap: { shape: -4, own: 'push' },
  boomerang: { shape: -5, own: 'never' }, drone: { shape: 3, own: 'droneCollision' }, sunchip: { shape: 4, own: 'hardWithBuffer' },
  swarm: { shape: 3, own: 'normal' }, minion: { shape: 0, own: 'hardWithBuffer' },
};
const OWN_TYPE_TO_ARRAS: Record<string, string> = { none: 'never', push: 'push', drone: 'droneCollision', hardWithBuffer: 'hardWithBuffer', assembler: 'assembler' };
let mountSize: number | null = null;
export function withMount<T>(size: number | null, fn: () => T): T {
  const was = mountSize;
  mountSize = size;
  try {
    return fn();
  } finally {
    mountSize = was;
  }
}
export function touchShareOf(v: unknown): number {
  return typeof v === 'number' && v > 0 ? v : 1;
}
export function withCarrierTouch<T>(share: number, fn: () => T): T {
  const was = carrierTouch;
  carrierTouch = share;
  try {
    return fn();
  } finally {
    carrierTouch = was;
  }
}

function roundIsMinion(turret: IstrongTurret): boolean {
  const on = ((turret.projectileBehaviors ?? []) as any[]).filter(b => b && b.enabled !== false);
  let motion: string = (on.find(b => MOTION_OF[b.type]) ? MOTION_OF[on.find(b => MOTION_OF[b.type]).type] : undefined)
    ?? (turret.projectileType as any)?.motionType ?? 'glide';
  if (motion === 'glide' && on.some(b => STEERS.has(b.type))) motion = 'motor';
  return motion === 'motor' && on.some(b => b.type === 'minionControl');
}

const TAP_FULL_TO_MINION: Record<string, string> = {
  sentrySwarm: 'sentrySwarmMinion',
  sentryTrap: 'sentryTrapMinion',
  sentryGun: 'sentryGunMinion',
};

const ENTITY_TYPE_TO_VISUAL: Record<string, string> = {
  bullet: 'bullet',
  drone: 'drone',
  swarm: 'swarm',
  trap: 'trap',
  minion: 'minion',
  hive: 'hive',
  boomerang: 'boomerang',
};

export interface TurretInversionResult {
  GUNS: ArrasGunEmit[];
  TURRETS: any[];
  dependencies: ArrasClassEmit[];
}

function getEntityTypeFromVisual(visual: string | undefined): string {
  if (!visual) return 'bullet';
  const lower = visual.toLowerCase();
  return ENTITY_TYPE_TO_VISUAL[lower] ?? 'bullet';
}

function buildGunEntry(
  turret: IstrongTurret,
  parentTankName: string,
  gunIndex: number,
  warn: WarningCollector,
  innerInverter: (turrets: IstrongTurret[], parentName: string, warn: WarningCollector) => TurretInversionResult,
  depth: number = 0,
  above: boolean = turret.aboveTankBody === true,
): { gun: ArrasGunEmit; dependencies: ArrasClassEmit[] } {
  const dependencies: ArrasClassEmit[] = [];
  const xLocal = turret.xOffset ?? 0;
  const yLocal = turret.yOffset ?? 0;
  const angle = turret.angle ?? 0;
  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);
  const xRotated = xLocal * cosA - yLocal * sinA;
  const yRotated = xLocal * sinA + yLocal * cosA;

  const arrasLength = invertBarrelLength(turret.length ?? 9);
  const aspectVal = turret.aspect ?? 1;
  let arrasWidth = invertBarrelWidth(turret.width ?? 20.83);
  let arrasAspect: number;
  if (aspectVal >= 1) {
    arrasAspect = aspectVal;
  } else if (aspectVal > 0) {
    arrasAspect = -1 / aspectVal;
    arrasWidth = arrasWidth * aspectVal;
  } else {
    arrasAspect = 1;
  }
  const arrasX = invertBarrelX(xRotated);
  const arrasY = invertBarrelY(yRotated);
  const arrasAngle = angle * 180 / Math.PI;
  const arrasDelay = turret.delay ?? 0;

  const position: number[] = [
    arrasLength,
    arrasWidth,
    arrasAspect,
    arrasX,
    arrasY,
    arrasAngle,
    arrasDelay,
  ];

  const isDecorative = turret.turretType === 'decorative' || (turret.bps === 0 && turret.bulletDamage === 0);

  if (isDecorative) {
    return {
      gun: { POSITION: position, PROPERTIES: {} },
      dependencies,
    };
  }

  const visual = (turret.projectileType?.visual || 'bullet').toLowerCase();
  const entityType = getEntityTypeFromVisual(visual);

  const reload = invertBPSToReload(turret.bps ?? 1);
  const speedArras = depth === 0 ? invertTankBarrelSpeed(turret.speed ?? 5) : invertRoundBarrelSpeed(turret.speed ?? 5);
  const recoilArras = invertRecoil(turret.knockback ?? 0) * frame.recoilK;
  const damageArras = invertDamage(turret.bulletDamage ?? 1);
  const healthArras = invertBulletHealth(turret.bulletHealthBase ?? 1);
  const penArras = invertPenetration(turret.bulletPenetration ?? 1);
  const sprayArras = invertSpread(turret.spread ?? 0);
  const shudderArras = turret.shudder ?? 0.1;
  const lifetimeArras = invertRoundLifetime(turret.bulletLifetime ?? 3, entityType, turret.projectileType?.statCalculatorType);

  let maxSpeedArras = 1;
  if (typeof turret.projectileType?.topSpeedRatio === 'number') {
    maxSpeedArras = invertTopSpeedRatio(speedArras, turret.projectileType.topSpeedRatio, entityType);
  }

  const shootSettings: Record<string, number> = {
    reload,
    recoil: recoilArras,
    shudder: shudderArras,
    size: invertBulletSize(turret.projectileType?.size ?? 1, arrasWidth, arrasAspect) * touchShareOf(turret.projectileType?.touchScale) / carrierTouch,
    health: healthArras,
    damage: damageArras,
    pen: penArras,
    speed: speedArras,
    maxSpeed: maxSpeedArras,
    range: lifetimeArras,
    density: turret.shootDensity ?? turret.projectileType?.density ?? 1,
    spray: sprayArras,
    resist: turret.shootResist ?? 1,
  };

  let typeRef: any = 'bullet';

  const cpd = turret.projectileType?.customProjectileDesign;
  if (cpd) {
    const cpdClass = buildCpdClass(cpd, parentTankName, gunIndex, warn, (innerTurrets, innerParent, innerWarn) => {
      const innerResult = withCarrierTouch(touchShareOf(turret.projectileType?.touchScale), () => withMount(null, () => withTankK(1, () => withFrame(ON_A_BODY, () => innerInverter(innerTurrets, innerParent, innerWarn)))));
      dependencies.push(...innerResult.dependencies);
      return { GUNS: innerResult.GUNS, TURRETS: innerResult.TURRETS };
    });
    emitProjectileArrasOnly(cpdClass as any, (turret.projectileType as any)?._arrasOnly);
    emitProjectileMeta(cpdClass as any, turret.projectileType);
    if (roundIsMinion(turret)) for (const g of (cpdClass.GUNS ?? []) as ArrasGunEmit[]) if (g.PROPERTIES) delete g.PROPERTIES.AUTOFIRE;
    dependencies.push(cpdClass);
    typeRef = cpdClass.className;
  } else {
    const tap = (turret.projectileType as any)?.tankAsProjectile;
    if (tap && typeof tap === 'string') {
      typeRef = TAP_FULL_TO_MINION[tap] ?? tap;
      warn.info('tankAsProjectile', `Tank As Projectile reference to "${tap}" emitted as TYPE="${typeRef}". The referenced entity class must exist in the target arras source tree.`, {
        original: tap,
        recovered: typeRef,
      });
    } else {
      typeRef = entityType;
    }
  }

  const ex = turret.explode;
  if (ex && ex.enabled === true && Array.isArray(ex.rings) && ex.rings.length > 0 && typeof typeRef === 'string') {
    let carrier = cpd ? dependencies.find((d) => d.className === typeRef) : undefined;
    if (!carrier) {
      carrier = { className: `${parentTankName}Projectile${gunIndex}`, PARENT: typeRef in ROUND_PARENT ? ROUND_PARENT[typeRef] : typeRef };
      dependencies.push(carrier);
      typeRef = carrier.className;
    }
    const deathGuns: ArrasGunEmit[] = [];
    let k = 0;
    for (const ring of ex.rings) {
      if (!ring || !ring.fragment) continue;
      const count = Math.max(1, Math.min(32, Math.round(ring.count)));
      for (let i = 0; i < count; i++) {
        const deg = explodeAngleDeg(count, ring.startDeg ?? 0, ring.arcDeg ?? 360, i);
        const piece: IstrongTurret = { ...ring.fragment, angle: deg * Math.PI / 180, xOffset: 0, yOffset: 0, alwaysShoot: false };
        const made = withCarrierTouch(touchShareOf(turret.projectileType?.touchScale), () => withMount(null, () => withTankK(1, () => withFrame(ON_A_BODY, () => buildGunEntry(piece, carrier.className, 1000 + k++, warn, innerInverter, depth + 1)))));
        dependencies.push(...made.dependencies);
        const props: Record<string, any> = made.gun.PROPERTIES ?? {};
        delete props.AUTOFIRE;
        props.SHOOT_ON_DEATH = true;
        props.ALPHA = 0;
        props.BORDERLESS = true;
        props.DRAW_FILL = false;
        props.TYPE = Array.isArray(props.TYPE) ? [props.TYPE[0], { ...props.TYPE[1], PERSISTS_AFTER_DEATH: true }] : [props.TYPE ?? 'bullet', { PERSISTS_AFTER_DEATH: true }];
        deathGuns.push({ POSITION: made.gun.POSITION, PROPERTIES: props });
      }
    }
    carrier.GUNS = [...(carrier.GUNS ?? []), ...deathGuns];
    if (ex.anyDeath !== true) {
      warn.info('explode', `This bomb is set to burst only when its lifetime runs out. arras fires a death gun at EVERY death of the round, so the emitted class also bursts when the round is destroyed.`, { original: 'anyDeath: false', recovered: 'SHOOT_ON_DEATH' });
    }
  }

  const behaviorResult = invertBehaviors(turret.projectileBehaviors, warn);
  const motion = invertMotionType(turret.projectileType?.motionType);
  const facing = invertFacingType(turret.projectileType?.facingType);
  const statCalc = invertStatCalculator(turret.projectileType?.statCalculatorType);

  const properties: Record<string, any> = {
    SHOOT_SETTINGS: shootSettings,
  };

  const nameOf = (c: any): string => (Array.isArray(c) ? c[0] : c);
  let controllers: any[] = behaviorResult.controllers;
  let roundMotion = motion && motion !== 'glide' ? motion : undefined;
  let roundBody: Record<string, number> | undefined;
  if (!cpd && typeRef === 'trap') {
    const own = controllers.some((c) => nameOf(c) === 'goToMasterTarget') ? 'setTrap'
      : controllers.some((c) => nameOf(c) === 'boomerang') ? 'boomerang' : null;
    if (own) {
      typeRef = own;
      controllers = controllers.filter((c) => nameOf(c) !== 'goToMasterTarget' && nameOf(c) !== 'boomerang');
      if (roundMotion === 'motor') roundMotion = undefined;
      if (own === 'setTrap') shootSettings.maxSpeed = invertBlockTopSpeed(speedArras, turret.projectileType?.topSpeedRatio);
      if (own === 'boomerang') {
        const drive = invertBoomerangDrive(speedArras, turret.projectileType?.topSpeedRatio, (turret.projectileType as any)?.motorDampLn);
        shootSettings.maxSpeed = drive.maxSpeed;
        shootSettings.range = invertRoundLifetime(turret.bulletLifetime ?? 3, 'boomerang', turret.projectileType?.statCalculatorType);
        roundBody = { ACCELERATION: drive.acceleration };
      }
    }
  }
  const chase = ((turret.projectileBehaviors ?? []) as any[]).find((b) => b && b.enabled !== false && b.type === 'motionChase' && typeof b.chaseAccel === 'number' && b.chaseAccel > 0);
  if (chase) {
    const accel = +(chase.chaseAccel / ARRAS_RUN_SPEED).toFixed(6);
    if (cpd) {
      const own = dependencies.find((d) => d.className === typeRef);
      if (own) own.BODY = { ...((own.BODY as any) ?? {}), ACCELERATION: accel } as any;
    } else roundBody = { ...(roundBody ?? {}), ACCELERATION: accel };
  }
  const isDefaultFacing = (entityType === 'trap' && facing === 'turnWithSpeed') || (entityType !== 'trap' && facing === 'smoothWithMotion');

  if (typeRef !== 'bullet' || controllers.length > 0 || roundMotion || (facing && !isDefaultFacing) || statCalc) {
    const typeOpts: Record<string, any> = {};
    if (controllers.length > 0) typeOpts.CONTROLLERS = controllers;
    if (roundMotion) typeOpts.MOTION_TYPE = roundMotion;
    if (facing && !isDefaultFacing) typeOpts.FACING_TYPE = facing;
    if (roundBody) typeOpts.BODY = roundBody;
    if (Object.keys(typeOpts).length > 0) {
      properties.TYPE = [typeRef, typeOpts];
    } else {
      properties.TYPE = typeRef;
    }
  } else {
    properties.TYPE = 'bullet';
  }
  if ((turret.projectileType as any)?.persistsAfterDeath === true) {
    properties.TYPE = Array.isArray(properties.TYPE)
      ? [properties.TYPE[0], { ...properties.TYPE[1], PERSISTS_AFTER_DEATH: true }]
      : [properties.TYPE, { PERSISTS_AFTER_DEATH: true }];
  }

  const pt0 = turret.projectileType;
  const onRound = (opts: Record<string, any>) => {
    properties.TYPE = Array.isArray(properties.TYPE) ? [properties.TYPE[0], { ...properties.TYPE[1], ...opts }] : [properties.TYPE, opts];
  };
  if (!cpd && pt0) {
    const base = typeof properties.TYPE === 'string' ? properties.TYPE : Array.isArray(properties.TYPE) ? properties.TYPE[0] : undefined;
    const def = typeof base === 'string' ? OSA_ROUND_DEFAULTS[base] : undefined;
    if (def) {
      const opts: Record<string, any> = {};
      if (typeof pt0.shape === 'number') {
        const shape = pt0.shape >= 3 && (pt0.trapDepth ?? 0) > 0 ? -pt0.shape : pt0.shape;
        if (shape !== def.shape) opts.SHAPE = shape;
      }
      const own = OWN_TYPE_TO_ARRAS[pt0.hitsOwnType ?? ''];
      if (own && own !== def.own && !(own === 'never' && def.own === 'normal')) opts.HITS_OWN_TYPE = own;
      if ((pt0 as any).necroInfect === true) opts.NECRO = true;
      if (Object.keys(opts).length > 0) onRound(opts);
    }
  }
  for (const [k, v] of Object.entries(behaviorResult.propertyFlags)) {
    if (k === 'INDEPENDENT') { onRound({ INDEPENDENT: v }); continue; }
    if (k === 'ALWAYS_INVISIBLE') { onRound({ ALPHA: [0, ALWAYS_INVISIBLE_ARRAS_CAP] }); continue; }
    properties[k] = v;
  }

  const tapForm = (turret.projectileType as any)?.tankAsProjectile;
  if (typeof tapForm === 'string' && TAP_FULL_TO_MINION[tapForm]) {
    onRound({ INDEPENDENT: true });
  }

  if (statCalc) properties.STAT_CALCULATOR = statCalc;

  if (turret.launchReversed) properties.NEGATIVE_RECOIL = true;
  if (turret.altFire) properties.ALT_FIRE = true;
  if ((turret as any).pushOnly === true) properties.PUSH_ONLY = true;
  if (typeof (turret as any).fightResist === 'number') properties.FIGHT_RESIST = (turret as any).fightResist;
  if (turret.alwaysShoot) properties.AUTOFIRE = true;
  if (turret.syncsSkills) properties.SYNCS_SKILLS = true;
  if (turret.independent) properties.INDEPENDENT = true;
  if (turret.necro) properties.NECRO = true;
  if (turret.healer) properties.HEALER = true;
  if (above) properties.DRAW_ABOVE = true;
  if (turret.gunStatScale && turret.gunStatScale !== 1) properties.GUN_STAT_SCALE = turret.gunStatScale;

  const maxAlive = turret.projectileType?.maxAlive;
  if (typeof maxAlive === 'number' && maxAlive > 0) {
    properties.MAX_CHILDREN = maxAlive;
  }

  const tapWord = (turret.projectileType as any)?.tankAsProjectile;
  if (tapWord && !(typeof tapWord === 'string' && TAP_FULL_TO_MINION[tapWord])) {
    properties.INDEPENDENT_CHILDREN = true;
    properties.NO_LIMITATIONS = true;
  }

  if (Array.isArray(properties.TYPE) && typeof properties.TYPE[0] === 'string' && properties.TYPE[1] && properties.TYPE[1].SHAPE !== undefined) {
    const own: ArrasClassEmit = { className: `${parentTankName}Round${gunIndex}`, PARENT: properties.TYPE[0], ...properties.TYPE[1] };
    dependencies.push(own);
    properties.TYPE = own.className;
  }

  emitGunArrasOnly(properties, (turret as any)._arrasOnly);
  emitTurretMeta(properties, turret);
  if (!cpd) {
    emitProjectileMetaInline(properties, turret.projectileType);
  }

  return {
    gun: { POSITION: position, PROPERTIES: properties },
    dependencies,
  };
}

export function invertTurretsWithDependencies(
  turrets: IstrongTurret[],
  parentTankName: string,
  warn: WarningCollector,
  depth: number = 0,
): TurretInversionResult {
  const guns: ArrasGunEmit[] = [];
  const arrasTurrets: any[] = [];
  const dependencies: ArrasClassEmit[] = [];

  const recursiveInverter = (innerTurrets: IstrongTurret[], innerParent: string, innerWarn: WarningCollector): TurretInversionResult => {
    return invertTurretsWithDependencies(innerTurrets, innerParent, innerWarn, depth + 1);
  };

  const order = turrets.map((t, i) => ({ t, i })).filter((x) => !!x.t)
    .sort((a, b) => (a.t.renderLayer ?? 0) - (b.t.renderLayer ?? 0) || a.i - b.i);
  const aboveOf = (t: IstrongTurret) => (frame.above === 'aboveBase' ? (t as any).aboveBase === true : t.aboveTankBody === true);
  const drawn: { above: boolean; gun?: ArrasGunEmit; turret?: any }[] = [];
  let gunBelowSeen = false, turretAboveSeen = false, inverted = 0;
  const turretAt = (above: boolean) => { if (!above && gunBelowSeen) inverted++; if (above) turretAboveSeen = true; };
  const gunAt = (above: boolean) => { if (above && turretAboveSeen) inverted++; if (!above) gunBelowSeen = true; };

  for (const { t, i } of order) {
    const above = aboveOf(t);
    const isAuto = t.turretType === 'auto' || t.turretType === 'autoCircle';
    if (isAuto) {
      const bs = invertAutoTurretSize(t.autoCircleSize ?? 25) / 20;
      const subFrame: Partial<Frame> = { above: 'aboveBase', lookBody: 1 / bs, chain: [...frame.chain, bs], recoilK: tankK * product(frame.chain) ** 2 };
      const result = buildAutoTurretEntry(t, parentTankName, i, warn, mountSize, (subT, subP, subW) => {
        const sub = withMount(typeof mountSize === 'number' ? mountSize * bs : null, () => withFrame(subFrame, () => invertTurretsWithDependencies(subT, subP, subW, depth)));
        dependencies.push(...sub.dependencies);
        return { GUNS: sub.GUNS, TURRETS: sub.TURRETS };
      }, above, tankK, depth > 0);
      drawn.push({ above, turret: result.arrasTurret });
      if (result.childClass) dependencies.push(result.childClass);
      turretAt(above);
      continue;
    }
    const look = (t as any).look;
    const fires = !(t.turretType === 'decorative' || (t.bps === 0 && t.bulletDamage === 0));
    if (look && look.design && look.design.body) {
      const made = lookTurret(look, `${parentTankName}Look${i}`, t, above);
      drawn.push({ above, turret: made.turret });
      dependencies.push(...made.classes);
      turretAt(above);
      if (!fires) continue;
    }
    const gunResult = buildGunEntry(t, parentTankName, i, warn, recursiveInverter, depth, above);
    if (look && look.design && look.design.body) {
      gunResult.gun.PROPERTIES = { ...(gunResult.gun.PROPERTIES ?? {}), BORDERLESS: true, DRAW_FILL: false };
    }
    drawn.push({ above, gun: gunResult.gun });
    dependencies.push(...gunResult.dependencies);
    gunAt(above);
  }
  if (inverted) {
    drawOrderInversions.count += inverted;
    drawOrderInversions.tanks.add(parentTankName);
  }

  let pictures: ArrasGunEmit[] = [];
  const holder = (layer: number) => {
    if (!pictures.length) return;
    const name = `${parentTankName}Picture${arrasTurrets.length}`;
    dependencies.push({ className: name, LABEL: '', SHAPE: 0, BORDERLESS: true, DRAW_FILL: false, INDEPENDENT: true, MIRROR_MASTER_ANGLE: true, GUNS: pictures, [ISTRONG_PICTURE_KEY]: 1 } as any);
    arrasTurrets.push({ POSITION: [20, 0, 0, 0, 360, layer], TYPE: name });
    pictures = [];
  };
  const unseen = (g: ArrasGunEmit, late: boolean) => {
    const p = g.PROPERTIES ?? {};
    if (!late || (p.BORDERLESS && p.DRAW_FILL === false)) return g;
    const look: Record<string, any> = {};
    for (const k of ['COLOR', 'ALPHA', 'BORDERLESS', 'DRAW_FILL', 'STROKE_WIDTH']) if (p[k] !== undefined) look[k] = p[k];
    pictures.push({ POSITION: g.POSITION, PROPERTIES: look });
    return { ...g, PROPERTIES: { ...p, BORDERLESS: true, DRAW_FILL: false } };
  };
  const below = drawn.filter((d) => !d.above), over = drawn.filter((d) => d.above);
  const lastUnder = below.map((d) => !!d.turret).lastIndexOf(true);
  below.forEach((d, n) => {
    if (d.turret) { holder(0); arrasTurrets.push(d.turret); } else guns.push(unseen(d.gun!, n < lastUnder));
  });
  holder(0);
  const firstOver = over.findIndex((d) => !!d.turret);
  over.forEach((d, n) => {
    if (d.turret) { holder(1); arrasTurrets.push(d.turret); } else guns.push(unseen(d.gun!, firstOver >= 0 && n > firstOver));
  });
  holder(1);

  return { GUNS: guns, TURRETS: arrasTurrets, dependencies };
}

function lookTurret(look: any, name: string, t: IstrongTurret, above: boolean): { turret: { POSITION: number[]; TYPE: string }; classes: ArrasClassEmit[] } {
  const body = look.design.body;
  const d = designClasses(body, name);
  const size = 20 * (body.radius ?? 1) * ((look.size ?? 12) / 50) * 0.96 * frame.lookBody;
  const a = t.angle ?? 0, ca = Math.cos(a), sa = Math.sin(a);
  const bx = invertBarrelX(t.xOffset ?? 0), by = invertBarrelY(t.yOffset ?? 0);
  (d.root as any)[ISTRONG_LOOK_KEY] = JSON.parse(JSON.stringify(t));
  return {
    turret: { POSITION: [+size.toFixed(4), +(bx * ca + by * sa).toFixed(4), +(-bx * sa + by * ca).toFixed(4), +((a * 180) / Math.PI).toFixed(4), 360, above ? 1 : 0], TYPE: name },
    classes: [d.root, ...d.parts],
  };
}

export function invertTurrets(
  turrets: IstrongTurret[],
  parentTankName: string,
  warn: WarningCollector,
  depth: number = 0,
): { GUNS: ArrasGunEmit[]; TURRETS: any[]; dependencies: ArrasClassEmit[] } {
  return invertTurretsWithDependencies(turrets, parentTankName, warn, depth);
}
