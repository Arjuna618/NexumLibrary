export const GUN_STAT_KEYS = [
  'reload', 'recoil', 'shudder', 'size', 'health', 'damage',
  'pen', 'speed', 'maxSpeed', 'range', 'density', 'spray', 'resist'
] as const;

export interface GunStats {
  reload: number;
  recoil: number;
  shudder: number;
  size: number;
  health: number;
  damage: number;
  pen: number;
  speed: number;
  maxSpeed: number;
  range: number;
  density: number;
  spray: number;
  resist: number;
}

export const DEFAULT_GUN_STATS: GunStats = {
  reload: 1, recoil: 1, shudder: 1, size: 1, health: 1, damage: 1,
  pen: 1, speed: 1, maxSpeed: 1, range: 1, density: 1, spray: 1, resist: 1
};
