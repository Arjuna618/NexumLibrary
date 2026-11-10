export interface ExportFile<T = TankData> {
  version: string;
  type: 'Tank' | 'TurretPreset' | 'CustomProjectile';
  name: string;
  timestamp: number;
  category?: string;
  source?: string;
  data: T;
}

export interface IstrongProjectileType {
  visual: string;
  shape: number;
  size: number;
  useMuzzleSize: boolean;
  color: string;
  useTankColor: boolean;
  maxAlive: number;
  lifetime: number;
  dieAtRange: boolean;
  motionType: string;
  facingType: string;
  growRate: number;
  subTurrets: any[];
  customProjectileDesign: any;
  persistsAfterDeath: boolean;
  trapDepth: number;
  trapCurved: boolean;
  friction: number;
  hitsOwnType: string;
  density: number;
  bounciness: number;
  bouncy: boolean;
  statCalculatorType: string;
  topSpeedRatio?: number;
  touchScale?: number;
  necroInfect?: boolean;
  _arrasOnly?: Record<string, any>;
}

export interface IstrongExplodeRing { count: number; startDeg: number; arcDeg: number; fragment: IstrongTurret }
export interface IstrongExplode { enabled: boolean; anyDeath: boolean; rings: IstrongExplodeRing[] }

export interface IstrongTurret {
  id: string;
  length: number;
  width: number;
  aspect: number;
  xOffset: number;
  yOffset: number;
  angle: number;
  bps: number;
  speed: number;
  delay: number;
  knockback: number;
  spread: number;
  shudder: number;
  bulletDamage: number;
  bulletHealthBase: number;
  bulletPenetration: number;
  bulletLifetime: number;
  shootResist: number;
  shootDensity?: number;
  launchReversed?: boolean;
  explode?: IstrongExplode;
  isCustom: boolean;
  animProgress?: number;
  turretType: string;
  alwaysAbove?: boolean;
  alwaysShoot?: boolean;
  independent: boolean;
  fov: number;
  fovSize: number;
  autoTargetPriority?: string;
  maxTurnSpeed?: number;
  autoFireDelay?: number;
  manualControl?: boolean;
  fireWithTank?: boolean;
  autoCircleSize?: number;
  autoTurretLength?: number;
  autoTurretWidth?: number;
  projectileType: IstrongProjectileType;
  projectileBehaviors: any[];
  visualLayers: any[];
  autoCurrentAngle?: number;
  autoTargetId?: any;
  autoShapeLockId?: any;
  aboveTankBody?: boolean;
  renderLayer?: number;
  autoFire?: boolean;
  wifiRange?: boolean;
  wifiRangeValue?: number;
  autoSubTurrets?: any[];
  primarySubTurretId?: any;
  altFire?: boolean;
  syncsSkills?: boolean;
  necro?: boolean;
  healer?: boolean;
  gunStatScale?: number;
  _arrasOnly?: Record<string, any>;
  [key: string]: any;
}

export interface IstrongSkillCaps {
  bodyDamage: number;
  maxHealth: number;
  bulletSpeed: number;
  bulletHealth: number;
  bulletPenetration: number;
  bulletDamage: number;
  reload: number;
  movementSpeed: number;
  shieldRegen: number;
  shieldCapacity: number;
}

export interface TankData {
  _configVersion: number;
  tankSides: number;
  tankShapeDepth: number;
  tankShapeCurved: boolean;
  tankSize: number;
  tankTouchScale?: number;
  tankColor: string;
  tankHP: number;
  tankBodyDamage: number;
  tankMovementSpeed: number;
  tankPushShare?: number;
  tankShieldRegen: number;
  tankShieldCapacity: number;
  fovMultiplier: number;
  turrets: IstrongTurret[];
  maxSkillPoints?: number;
  maxPointsPerSkill?: number;
  bonusSkillPoints?: number;
  skillCaps?: IstrongSkillCaps;
  canEarnSkillPoints?: boolean;
  preDefinedSkills?: Record<string, number>;
  primaryTurretId?: string;
  useCustomAimDirection?: boolean;
  customAimAngle?: number;
  cameraZoomEnabled?: boolean;
  cameraZoomDistance?: number;
  mirrorMode?: boolean;
  autoPlacement?: boolean;
  autoPlacementCount?: number;
  snapPlacement?: boolean;
  snapPlacementCount?: number;
  baseSpinEnabled?: boolean;
  baseSpinSpeed?: number;
  baseSpinDirection?: number;
  tankPushability?: number;
  tankResistBase?: number;
  tankPenetrationBase?: number;
  globalMaxAliveEnabled?: boolean;
  globalMaxAlive?: number;
  statNamesType?: string;
  ignoresWalls?: boolean;
  showHealthBar?: boolean;
  keepOwnColor?: boolean;
  tankColorMap?: number;
  tankColorFree?: string;
  bodyLayers?: any[];
  isHealer?: boolean;
  chargeAI?: boolean;
  arenaCloserAI?: boolean;
  necroInfect?: boolean;
  _arrasOnly?: Record<string, any>;
  [key: string]: any;
}

export interface TurretPresetData {
  name: string;
  category: string;
  primaryIndex?: number;
  turrets: IstrongTurret[];
}

export interface CustomProjectileData {
  visual: string;
  shape: number;
  size: number;
  color: string;
  useTankColor: boolean;
  subTurrets?: IstrongTurret[];
  [key: string]: any;
}

export type AnyIstrongEnvelope = ExportFile<TankData> | ExportFile<TurretPresetData> | ExportFile<CustomProjectileData>;
