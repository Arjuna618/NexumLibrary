import { ARRAS_BASE, ARRAS_TICK_RATE, ARRAS_RUN_SPEED, OSA_STAT_PER_TANK_SLIDER, OSA_STAT_PER_ROUND_SLIDER, OSA_DRIVE_PER_FILE_SPEED } from '../constants/physics.js';
import type { GunStats } from '../constants/gunStats.js';

const RECOIL_SCALE = 40 / 1.4;

export function convertRecoil(arrasRecoil: number): number {
  return arrasRecoil * RECOIL_SCALE;
}

export function convertBulletSpeed(arrasSpeed: number): number {
  return Math.min(arrasSpeed, arrasSpeed * 2 - 5);
}

export function convertTankBarrelSpeed(arrasSpeed: number): number {
  return arrasSpeed / OSA_STAT_PER_TANK_SLIDER - 5;
}

export const ROUND_BARREL_SLIDER_PER_STAT = 1 / OSA_STAT_PER_ROUND_SLIDER;
export function convertRoundBarrelSpeed(arrasSpeed: number): number {
  return arrasSpeed * ROUND_BARREL_SLIDER_PER_STAT;
}

export function convertReloadToBPS(arrasReloadTicks: number): number {
  if (arrasReloadTicks <= 0) return 10;
  return ARRAS_TICK_RATE / (arrasReloadTicks * ARRAS_RUN_SPEED);
}

const DAMAGE_SCALE = 2.0;

export function convertDamage(arrasDamage: number): number {
  return arrasDamage * DAMAGE_SCALE;
}

export function convertBulletHealth(arrasHealth: number): number {
  return arrasHealth * DAMAGE_SCALE;
}

export function convertPenetration(arrasPen: number): number {
  return arrasPen;
}

const ENTITY_BASE_RANGE: Record<string, number> = {
  bullet: 90,
  trap: 450,
  swarm: 105,
  drone: 90,
  minion: 90,
  hive: 90,
  boomerang: 120,
};

export function convertLifetime(arrasRange: number, entityType: string = 'bullet'): number {
  const baseRange = ENTITY_BASE_RANGE[entityType] ?? 90;
  const lifetimeSec = (baseRange * arrasRange) / ARRAS_TICK_RATE;
  return Math.max(0.1, Math.min(60, lifetimeSec));
}

export const ARRAS_SPD_NO_POINTS = 1.5;
export const FIXED_RANGE_CALCULATORS: ReadonlySet<string> = new Set(['sustained', 'sustainedLowspeed', 'trap', 'drone', 'necro']);
export const SWARM_CLASS_RANGE = 225;
export const CLASS_RANGE_RULED: ReadonlySet<string> = new Set(['baseSwarmTurret_swarm']);
export function convertRoundLifetime(arrasRange: number, entityType: string, statCalc: string, ruledClassRange?: number): number {
  if (entityType === 'swarm' && typeof ruledClassRange === 'number' && ruledClassRange > 0 && ruledClassRange !== SWARM_CLASS_RANGE) {
    const ticks = ENTITY_BASE_RANGE.swarm * (ruledClassRange / SWARM_CLASS_RANGE) * arrasRange;
    return Math.max(0.1, Math.min(60, ticks / ARRAS_TICK_RATE));
  }
  if (entityType !== 'bullet') return convertLifetime(arrasRange, entityType);
  let ticks = ENTITY_BASE_RANGE.bullet * arrasRange;
  if (!FIXED_RANGE_CALCULATORS.has(statCalc)) ticks = Math.floor(ticks / Math.sqrt(ARRAS_SPD_NO_POINTS));
  return Math.max(0.1, Math.min(60, ticks / ARRAS_TICK_RATE));
}

export function convertSpread(arrasSpray: number): number {
  return arrasSpray;
}

const BASIC_SLIDER = 9;
export const SIZE_ANCHOR_K = 48.25 / (24 + (9 - 1) / 9 * 24);
const ENGINE_WIDTH_AT_1 = 24 * SIZE_ANCHOR_K;
const ENGINE_WIDTH_AT_10 = 48 * SIZE_ANCHOR_K;
export const BASIC_LEVEL45_GROWTH = 24.125 / 12;
export function engineWidthOfSlider(slider: number): number {
  if (slider <= 10) return ENGINE_WIDTH_AT_1 + (slider - 1) / 9 * (ENGINE_WIDTH_AT_10 - ENGINE_WIDTH_AT_1);
  return ENGINE_WIDTH_AT_10 * (slider / 10);
}
export function engineSliderOfWidth(width: number): number {
  if (width <= ENGINE_WIDTH_AT_10) return 1 + (width - ENGINE_WIDTH_AT_1) * 9 / (ENGINE_WIDTH_AT_10 - ENGINE_WIDTH_AT_1);
  return width * 10 / ENGINE_WIDTH_AT_10;
}

export function convertTankSize(arrasSize: number, levelsUp: boolean = true): number {
  const width = engineWidthOfSlider(BASIC_SLIDER) * (arrasSize / 12) * (levelsUp ? 1 : 1 / BASIC_LEVEL45_GROWTH);
  const slider = Math.round(engineSliderOfWidth(width) * 1000) / 1000;
  return Math.max(1, Math.min(100, slider));
}

export function entityLevelsUp(def: Record<string, unknown> | undefined | null): boolean {
  if (!def) return true;
  if (def.HEALTH_WITH_LEVEL === false) return false;
  return !(def.ACCEPTS_SCORE === false && def.LEVEL == null && def.VALUE == null);
}

export function convertBodyHP(arrasHealth: number, healthWithLevel: boolean = true): number {
  return ((healthWithLevel ? 90 : 0) + arrasHealth) * 2;
}

export function convertBodyDamage(arrasDamage: number): number {
  return arrasDamage;
}

export function convertMovementSpeed(arrasSpeed: number): number {
  return arrasSpeed * (3 / ARRAS_BASE.SPEED);
}

const DRIVE_DECIMALS = 1e6;
export function convertDrivenSpeed(arrasSpeed: number, arrasAccel: number): number {
  if (!(arrasSpeed > 0)) return 0;
  const accel = arrasAccel > 0 ? arrasAccel : 0;
  return Math.round(((arrasSpeed + accel) / OSA_DRIVE_PER_FILE_SPEED) * DRIVE_DECIMALS) / DRIVE_DECIMALS;
}
export function convertPushShare(arrasSpeed: number, arrasAccel: number): number | undefined {
  if (!(arrasSpeed > 0) || !(arrasAccel >= 0)) return undefined;
  if (arrasSpeed === ARRAS_BASE.SPEED && arrasAccel === ARRAS_BASE.ACCEL) return undefined;
  return Math.round(arrasAccel / (arrasSpeed + arrasAccel) * DRIVE_DECIMALS) / DRIVE_DECIMALS;
}

export function convertShieldCapacity(arrasShield: number, healthWithLevel: boolean = true): number {
  return ((healthWithLevel ? 27 : 0) + arrasShield) * 2;
}

export function convertShieldRegen(arrasRegen: number): number {
  return arrasRegen * (3 / ARRAS_BASE.REGEN);
}

export function convertFOV(arrasFOV: number): number {
  return arrasFOV / ARRAS_BASE.FOV;
}

export function convertPushability(arras: number | undefined): number {
  if (arras === undefined || arras === null) return 0.2;
  return Math.max(0.01, Math.min(10, arras));
}

export function convertBarrelLength(arrasLength: number): number {
  const ratio = arrasLength / 20;
  const slider = 1 + (ratio - 0.01) * 99 / 10.49;
  return Math.max(1, Math.min(100, slider));
}

export const GAME_CANVAS_EXTENT = 256;
export function convertBarrelWidth(arrasWidth: number): number {
  const slider = arrasWidth * 50 / (20 * 0.96);
  return Math.max(0, Math.min(GAME_CANVAS_EXTENT, slider));
}

export function convertBarrelX(arrasX: number): number {
  const r = Math.max(-GAME_CANVAS_EXTENT, Math.min(GAME_CANVAS_EXTENT, arrasX / 10));
  return r + 0;
}

export function convertBarrelY(arrasY: number): number {
  const r = Math.max(-GAME_CANVAS_EXTENT, Math.min(GAME_CANVAS_EXTENT, arrasY / 10));
  return r + 0;
}

export function convertTurretX(arrasX: number): number {
  return arrasX / 10 + 0;
}
export function convertTurretY(arrasY: number): number {
  return arrasY / 10 + 0;
}

export function convertBulletSize(arrasSize: number, arrasWidth?: number, arrasAspect: number = 1): number {
  if (!(typeof arrasWidth === 'number' && arrasWidth > 0)) return arrasSize;
  const raw = arrasWidth * 50 / (20 * 0.96);
  const written = convertBarrelWidth(arrasAspect < 0 ? arrasWidth * Math.abs(arrasAspect) : arrasWidth);
  if (!(written > 0)) return arrasSize;
  const k = raw / written;
  return k === 1 ? arrasSize : arrasSize * k;
}

export const BODY_SPEED: Record<string, number> = {
  bullet: 3.75,
  drone: 3.8,
  swarm: 4.5,
  trap: 0,
  minion: 1.8,
  hive: 3.8,
  boomerang: 1.25,
};

export function computeTopSpeedRatio(
  arrasSpeed: number, arrasMaxSpeed: number, entityType: string, ownBodySpeed?: number
): number {
  const bodySpeed = (typeof ownBodySpeed === 'number' && isFinite(ownBodySpeed)) ? ownBodySpeed : (BODY_SPEED[entityType] ?? 3.75);
  if (arrasSpeed <= 0.01) return bodySpeed > 0 ? 1.0 : 0;
  return (arrasMaxSpeed * bodySpeed) / arrasSpeed;
}

export function convertGunStats(stats: GunStats) {
  return {
    bps: convertReloadToBPS(stats.reload),
    speed: convertBulletSpeed(stats.speed),
    knockback: convertRecoil(stats.recoil),
    spread: convertSpread(stats.spray),
    bulletDamage: convertDamage(stats.damage),
    bulletHealthBase: convertBulletHealth(stats.health),
    bulletPenetration: convertPenetration(stats.pen),
    bulletLifetime: convertLifetime(stats.range),
    shudder: stats.shudder,
    _arrasSize: stats.size,
    _arrasMaxSpeed: stats.maxSpeed,
    _arrasDensity: stats.density,
    _arrasResist: stats.resist,
    _arrasShudder: stats.shudder,
  };
}
