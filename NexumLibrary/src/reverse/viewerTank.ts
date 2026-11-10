import type { IstrongTurret, TankData } from '../types/istrong.js';

export const VIEWER_BODY: Omit<TankData, 'turrets'> = Object.freeze({
  _configVersion: 5,
  tankSides: 0,
  tankShapeDepth: 0,
  tankShapeCurved: false,
  tankSize: 9,
  tankColor: '#3ca4cb',
  tankHP: 220,
  tankBodyDamage: 3,
  tankMovementSpeed: 3,
  tankPushShare: 0.231165,
  tankShieldRegen: 3,
  tankShieldCapacity: 65.5,
  fovMultiplier: 1,
  maxSkillPoints: 42,
  maxPointsPerSkill: 9,
  bonusSkillPoints: 42,
  skillCaps: { bodyDamage: 9, maxHealth: 9, bulletSpeed: 9, bulletHealth: 9, bulletPenetration: 9, bulletDamage: 9, reload: 9, movementSpeed: 9, shieldRegen: 9, shieldCapacity: 9 },
  canEarnSkillPoints: true,
  useCustomAimDirection: true,
  customAimAngle: 0,
  cameraZoomEnabled: false,
  cameraZoomDistance: 225,
  baseSpinEnabled: false,
  baseSpinSpeed: 50,
  baseSpinDirection: 1,
  tankPushability: 1,
  globalMaxAliveEnabled: false,
  globalMaxAlive: 0,
  statNamesType: 'generic',
}) as any;

export const VIEWER_GUN: IstrongTurret = Object.freeze({
  id: 'viewer__g0', length: 9.399428026692087, width: 20.833333333333336, aspect: 1, xOffset: 0, yOffset: 0, angle: 0,
  bps: 1.888574, speed: 4.38456, delay: 0, knockback: 40, spread: 15, shudder: 0.108, bulletDamage: 1.88929, bulletHealthBase: 1.65631,
  bulletPenetration: 1, bulletLifetime: 2.433333333333333, shootResist: 1, isCustom: false, turretType: 'regular', alwaysShoot: false,
  independent: false, fov: 200, fovSize: 10, autoTargetPriority: 'nearest', maxTurnSpeed: 4.5, autoFireDelay: 0, manualControl: false,
  autoCircleSize: 25, autoTurretLength: 7, autoTurretWidth: 20, aboveTankBody: false, renderLayer: 0, autoSubTurrets: [],
  altFire: false, syncsSkills: false, necro: false, healer: false, gunStatScale: 1, fightResist: 1,
  projectileType: {
    visual: 'bullet', shape: 0, size: 1.006, useMuzzleSize: true, color: 'inherit', useTankColor: true, maxAlive: 0,
    lifetime: 2.433333333333333, dieAtRange: true, motionType: 'glide', facingType: 'smoothWithMotion', growRate: 1, subTurrets: [],
    customProjectileDesign: null, persistsAfterDeath: false, trapDepth: 0, trapCurved: false, friction: 0, hitsOwnType: 'none',
    density: 1, bounciness: 0.9, bouncy: true, statCalculatorType: 'bullet', topSpeedRatio: 0.885215, necroInfect: false,
  },
  projectileBehaviors: [{ type: 'motionGlide', enabled: true }],
  visualLayers: [],
}) as any;

const ROUND_FIELDS = ['visual', 'shape', 'size', 'useMuzzleSize', 'color', 'useTankColor', 'motionType', 'facingType', 'growRate',
  'trapDepth', 'trapCurved', 'friction', 'hitsOwnType', 'density', 'bounciness', 'bouncy'] as const;

export function viewerGunFiring(design: Record<string, any>): IstrongTurret {
  const pt: any = { ...VIEWER_GUN.projectileType, customProjectileDesign: design };
  for (const k of ROUND_FIELDS) if (design[k] !== undefined) pt[k] = design[k];
  return { ...VIEWER_GUN, projectileType: pt } as IstrongTurret;
}
