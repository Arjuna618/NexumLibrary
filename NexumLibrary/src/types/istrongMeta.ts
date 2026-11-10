export const ISTRONG_META_KEY = '_iStrongMeta';

export const ISTRONG_INLINE_PROJECTILE_KEY = '_iStrongProj';

export const ISTRONG_OUTER_BODY_KEY = '_iStrongOuter';

export const ISTRONG_META_VERSION = 1;

export const ISTRONG_PLATE_KEY = '_iStrongLayer';
export const ISTRONG_MAIN_BODY_KEY = '_iStrongMainBody';
export const ISTRONG_LOOK_KEY = '_iStrongLook';
export const ISTRONG_PICTURE_KEY = '_iStrongPicture';
export const ISTRONG_AUTO_KEY = '_iStrongAuto';
export const AUTO_FIELDS = ['aura', 'auraType', 'auraSize', 'auraStrength', 'auraOpacity', 'autoCircleSize', 'autoCircleColorMatch',
  'autoCircleBaseSides', 'autoCircleBaseDepth', 'autoCircleHidden', 'autoCircleHealer', 'autoCircleFixed', 'autoCircleSpin',
  'autoCircleSpinMode', 'autoCircleSpinSpeed', 'autoCircleSpinDirection', 'color', 'colorMap', 'fireWithTank', 'manualControl'] as const;
export function plateRecord(layer: Record<string, any>, index: number): Record<string, any> {
  const { turretIds: _ids, _currentAngle: _a, ...rest } = layer;
  return { ...rest, index };
}

export interface IstrongTankMeta {
  v?: number;
  tankSides?: number;
  tankShapeDepth?: number;
  tankShieldCapacity?: number;
  tankSize?: number;
  tankShapeCurved?: boolean;
  statNamesType?: string;
  primaryTurretId?: string;
  mirrorMode?: boolean;
  autoPlacement?: boolean;
  autoPlacementCount?: number;
  snapPlacement?: boolean;
  snapPlacementCount?: number;
  maxSkillPoints?: number;
  maxPointsPerSkill?: number;
  configVersion?: number;
  fovMultiplier?: number;
  tankColor?: string;
  tankColorMap?: number;
  tankColorFree?: string;
  chargeAI?: boolean;
  arenaCloserAI?: boolean;
}

export interface IstrongTurretMeta {
  v?: number;
  id?: string;
  alwaysAbove?: boolean;
  autoTargetPriority?: string;
  maxTurnSpeed?: number;
  autoFireDelay?: number;
  manualControl?: boolean;
  fireWithTank?: boolean;
  wifiRange?: boolean;
  wifiRangeValue?: number;
  visualLayers?: any[];
  renderLayer?: number;
  isCustom?: boolean;
  primarySubTurretId?: string;
  bulletLifetime?: number;
}

export interface IstrongProjectileMeta {
  v?: number;
  growRate?: number;
  trapCurved?: boolean;
  useMuzzleSize?: boolean;
  bouncy?: boolean;
  bounciness?: number;
  friction?: number;
  dieAtRange?: boolean;
  hitsOwnType?: string;
  density?: number;
  necroInfect?: boolean;
  rangeDamage?: boolean;
  buffVsFood?: boolean;
  tankAsProjectileCycle?: string[];
  cycleProjectilesEnabled?: boolean;
  shape?: number;
  size?: number;
  color?: string;
  useTankColor?: boolean;
}

export interface IstrongBodyLayerMeta {
  v?: number;
  id?: string;
  label?: string;
  copies?: number;
  initialAngle?: number;
  starDepth?: number;
  starCurved?: boolean;
  showHealerCross?: boolean;
  intangible?: boolean;
  invisible?: boolean;
  stationary?: boolean;
  useInheritColor?: boolean;
  colorMap?: number;
  colorFree?: string;
  renderOrder?: number;
  maxAliveEnabled?: boolean;
  maxAlive?: number;
}

export type AnyIstrongMeta =
  | IstrongTankMeta
  | IstrongTurretMeta
  | IstrongProjectileMeta
  | IstrongBodyLayerMeta;

const TANK_KEYS: ReadonlyArray<keyof IstrongTankMeta> = [
  'tankShieldCapacity',
  'tankSides',
  'tankShapeDepth',
  'tankSize',
  'tankShapeCurved',
  'statNamesType',
  'primaryTurretId',
  'mirrorMode',
  'autoPlacement',
  'autoPlacementCount',
  'snapPlacement',
  'snapPlacementCount',
  'maxSkillPoints',
  'maxPointsPerSkill',
  'configVersion',
  'fovMultiplier',
  'tankColor',
  'tankColorMap',
  'tankColorFree',
  'chargeAI',
  'arenaCloserAI',
];

const TURRET_KEYS: ReadonlyArray<keyof IstrongTurretMeta> = [
  'id',
  'alwaysAbove',
  'autoTargetPriority',
  'maxTurnSpeed',
  'autoFireDelay',
  'manualControl',
  'fireWithTank',
  'wifiRange',
  'wifiRangeValue',
  'visualLayers',
  'renderLayer',
  'isCustom',
  'primarySubTurretId',
  'bulletLifetime',
];

const PROJECTILE_KEYS: ReadonlyArray<keyof IstrongProjectileMeta> = [
  'growRate',
  'trapCurved',
  'useMuzzleSize',
  'bouncy',
  'bounciness',
  'friction',
  'dieAtRange',
  'hitsOwnType',
  'density',
  'necroInfect',
  'rangeDamage',
  'buffVsFood',
  'tankAsProjectileCycle',
  'cycleProjectilesEnabled',
  'shape',
  'size',
  'color',
  'useTankColor',
];

const BODY_LAYER_KEYS: ReadonlyArray<keyof IstrongBodyLayerMeta> = [
  'id',
  'label',
  'copies',
  'initialAngle',
  'starDepth',
  'starCurved',
  'showHealerCross',
  'intangible',
  'invisible',
  'stationary',
  'useInheritColor',
  'colorMap',
  'colorFree',
  'renderOrder',
  'maxAliveEnabled',
  'maxAlive',
];

export const META_FIELD_KEYS = {
  tank: TANK_KEYS,
  turret: TURRET_KEYS,
  projectile: PROJECTILE_KEYS,
  bodyLayer: BODY_LAYER_KEYS,
} as const;
