export type WarningSeverity = 'info' | 'warn' | 'error';

export interface ConversionWarning {
  severity: WarningSeverity;
  field: string;
  original?: any;
  recovered?: any;
  message: string;
  context?: string;
}

export interface ArrasClassEmit {
  className: string;
  PARENT?: string | string[];
  LABEL?: string;
  NAME?: string;
  TYPE?: string;
  SHAPE?: number | number[][];
  SIZE?: number;
  COLOR?: any;
  BODY?: Record<string, number | boolean>;
  GUNS?: ArrasGunEmit[];
  TURRETS?: ArrasTurretEmit[];
  CONTROLLERS?: any[];
  FACING_TYPE?: any;
  MOTION_TYPE?: string;
  SKILL?: (number | null)[];
  SKILL_CAP?: number[];
  EXTRA_SKILL?: number;
  LEVEL?: number;
  HEALTH_WITH_LEVEL?: boolean;
  DANGER?: number;
  VALUE?: number;
  HEALER?: boolean;
  HEALING_TANK?: boolean;
  STAT_NAMES?: string;
  GUN_STAT_SCALE?: number;
  [key: string]: any;
}

export interface ArrasGunEmit {
  POSITION: number[];
  PROPERTIES?: Record<string, any>;
}

export interface ArrasTurretEmit {
  POSITION: number[];
  TYPE: string;
  INDEPENDENT?: boolean;
  COLOR?: any;
  [key: string]: any;
}

export interface ReverseResult {
  primary: ArrasClassEmit;
  dependencies: ArrasClassEmit[];
  warnings: ConversionWarning[];
  suggestedFilenames: {
    js: string;
    json: string;
    paired?: string[];
  };
}
