import type { GunStats } from '../constants/gunStats.js';

export interface ArrasGunPosition {
  LENGTH: number;
  WIDTH: number;
  ASPECT: number;
  X: number;
  Y: number;
  ANGLE: number;
  DELAY: number;
}

export interface ArrasGunProperties {
  SHOOT_SETTINGS?: GunStats;
  TYPE?: string;
  COLOR?: any;
  LABEL?: string;
  STAT_CALCULATOR?: string | number;
  AUTOFIRE?: boolean;
  SYNCS_SKILLS?: boolean;
  MAX_CHILDREN?: number;
  ALT_FIRE?: boolean;
  NEGATIVE_RECOIL?: boolean;
  WAIT_TO_CYCLE?: boolean;
  DELAY_SPAWN?: boolean;
  DESTROY_OLDEST_CHILD?: boolean;
  HAS_NO_RECOIL?: boolean;
  INDEPENDENT?: boolean;
  INDEPENDENT_CHILDREN?: boolean;
  PERSISTS_AFTER_DEATH?: boolean;
  SHOOT_ON_DEATH?: boolean;
  NECRO?: boolean;
  HEALER?: boolean;
  GUN_STAT_SCALE?: number;
  IDENTIFIER?: string;
  DRAW_ABOVE?: boolean;
  HITS_OWN_TYPE?: string;
}

export interface ArrasGun {
  POSITION: ArrasGunPosition | number[];
  PROPERTIES?: ArrasGunProperties;
}

export interface ArrasTurretDef {
  POSITION: number[] | { SIZE?: number; X?: number; Y?: number; ANGLE?: number; ARC?: number; LAYER?: number };
  TYPE: string | any;
  INDEPENDENT?: boolean;
  COLOR?: any;
}

export interface ArrasBody {
  ACCELERATION?: number;
  SPEED?: number;
  HEALTH?: number;
  DAMAGE?: number;
  PENETRATION?: number;
  SHIELD?: number;
  REGEN?: number;
  FOV?: number;
  DENSITY?: number;
  PUSHABILITY?: number;
  HETERO?: number;
  RESIST?: number;
  STEALTH?: number;
  SHOCK_ABSORB?: number;
  RECOIL_MULTIPLIER?: number;
  RANGE?: number;
  SPEED_PENALTY?: number;
}

export interface ArrasClassDef {
  PARENT?: string | string[];
  LABEL?: string;
  NAME?: string;
  TYPE?: string;
  DANGER?: number;
  VALUE?: number;
  SHAPE?: number;
  SIZE?: number;
  COLOR?: any;
  BODY?: ArrasBody;
  GUNS?: ArrasGun[];
  TURRETS?: ArrasTurretDef[];
  CONTROLLERS?: any[];
  AI?: any;
  SKILL?: number[];
  LEVEL?: number;
  UPGRADES_TIER_0?: string[];
  UPGRADES_TIER_1?: string[];
  UPGRADES_TIER_2?: string[];
  UPGRADES_TIER_3?: string[];
  FACING_TYPE?: any;
  MOTION_TYPE?: string;
  INDEPENDENT?: boolean;
  DRAW_HEALTH?: boolean;
  ARENA_CLOSER?: boolean;
  HITS_OWN_TYPE?: string;
  HAS_NO_RECOIL?: boolean;
  NECRO?: boolean;
  IS_SMASHER?: boolean;
  HEALER?: boolean;
  HEALING_TANK?: boolean;
  INVISIBLE?: any;
  ALPHA?: any;
  AUTO_SPIN?: boolean;
  STAT_NAMES?: any;
  BROADCAST_MESSAGE?: string;
  MAX_CHILDREN?: number;
  PERSISTS_AFTER_DEATH?: boolean;
  INTANGIBLE?: boolean;
  CAN_GO_OUTSIDE_ROOM?: boolean;
  DAMAGE_CLASS?: number;
  BORDERLESS?: boolean;
  DRAW_FILL?: boolean;
  GLOW?: any;
  GUN_STAT_SCALE?: number;
  BUFF_VS_FOOD?: number;
  HEALTH_WITH_LEVEL?: boolean;
  SKILL_CAP?: number[] | Record<string, number>;
  EXTRA_SKILL?: number;
  ON?: Array<{ event: string; handler: Function }>;
  _className?: string;
  _resolved?: boolean;
  _sourceFile?: string;
}

export type Registry = Map<string, ArrasClassDef>;

export interface ArrasGunPresets {
  [key: string]: any;
}

export interface ArrasParseResult {
  registry: Registry;
  gunPresets: ArrasGunPresets;
}
