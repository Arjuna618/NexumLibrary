import { ARRAS_BASE, ARRAS_TICK_RATE, ARRAS_RUN_SPEED, OSA_STAT_PER_TANK_SLIDER, OSA_STAT_PER_ROUND_SLIDER, OSA_DRIVE_PER_FILE_SPEED, OSA_BLOCK_PUSH_TICK, ENGINE_BLOCK_CRUISE_SHARE, OSA_BOOMERANG_BODY_SPEED, ENGINE_BOOMERANG_DAMP_LN, ENGINE_BOOMERANG_PUSH_SHARE, ENGINE_SUBFRAME } from '../constants/physics.js';
import { BODY_SPEED, engineWidthOfSlider, convertBarrelWidth, BASIC_LEVEL45_GROWTH } from '../forward/physicsCalibrator.js';
import type { WarningCollector } from '../warnings/collector.js';

const RECOIL_SCALE = 40 / 1.4;
const DAMAGE_SCALE = 2.0;

const ENTITY_BASE_RANGE: Record<string, number> = {
  bullet: 90,
  trap: 450,
  swarm: 105,
  drone: 90,
  minion: 90,
  hive: 90,
  boomerang: 120,
};

export function invertRecoil(istrongKnockback: number): number {
  return istrongKnockback / RECOIL_SCALE;
}

export function invertBulletSpeed(istrongSpeed: number, _warn?: WarningCollector): number {
  const safe = Math.max(0, istrongSpeed);
  if (safe >= 5) {
    return safe;
  }
  return (safe + 5) / 2;
}

export function invertTankBarrelSpeed(istrongSpeed: number): number {
  return (istrongSpeed + 5) * OSA_STAT_PER_TANK_SLIDER;
}

export function invertRoundBarrelSpeed(istrongSpeed: number): number {
  return istrongSpeed * OSA_STAT_PER_ROUND_SLIDER;
}

export function invertBPSToReload(istrongBPS: number): number {
  if (istrongBPS <= 0) return 1;
  return ARRAS_TICK_RATE / (istrongBPS * ARRAS_RUN_SPEED);
}

export function invertDamage(istrongDamage: number): number {
  return istrongDamage / DAMAGE_SCALE;
}

export function invertBulletHealth(istrongHealth: number): number {
  return istrongHealth / DAMAGE_SCALE;
}

export function invertPenetration(istrongPen: number): number {
  return istrongPen;
}

export function invertLifetime(istrongLifetimeSec: number, entityType: string = 'bullet'): number {
  const baseRange = ENTITY_BASE_RANGE[entityType] ?? 90;
  if (baseRange === 0) return 0;
  return (istrongLifetimeSec * ARRAS_TICK_RATE) / baseRange;
}

const ARRAS_SPD_NO_POINTS = 1.5;
export const OSA_CLASS_RANGE: Readonly<Record<string, number>> = { bullet: 90, swarm: 225, trap: 450, boomerang: 120, drone: 200, minion: 90, hive: 90 };
const OSA_RANGE_KEPT: ReadonlySet<string> = new Set(['sustained', 'sustainedLowspeed', 'trap', 'block']);
export function invertRoundLifetime(istrongLifetimeSec: number, entityType: string, statCalc: string | undefined): number {
  const classRange = OSA_CLASS_RANGE[entityType] ?? OSA_CLASS_RANGE.bullet;
  let ticks = istrongLifetimeSec * ARRAS_TICK_RATE;
  const kept = OSA_RANGE_KEPT.has(statCalc ?? (entityType === 'trap' ? 'trap' : 'bullet')) || entityType === 'trap' || entityType === 'boomerang';
  if (!kept) ticks = (Math.round(ticks) + 0.5) * Math.sqrt(ARRAS_SPD_NO_POINTS);
  return ticks / classRange;
}

export function invertSpread(istrongSpread: number): number {
  return istrongSpread;
}

export function invertTankSize(istrongSlider: number, levelsUp: boolean = true): number {
  const size = 12 * engineWidthOfSlider(istrongSlider) / engineWidthOfSlider(9);
  const rounded = Math.round(size * 100) / 100;
  return levelsUp ? rounded : Math.round(size * BASIC_LEVEL45_GROWTH * 100) / 100;
}

export function invertBodyHP(istrongHP: number, isBoss: boolean, warn?: WarningCollector): { health: number; healthWithLevel: boolean; level?: number } {
  const healthWithLevel = true;
  const arrasHealth = istrongHP / 2 - 90;
  if (warn) {
    if (isBoss) {
      warn.warn('BODY.HEALTH', 'Boss arras LEVEL is not stored in iStrong data, so LEVEL=45 is assumed (matches iStrong default). If the original boss used a different level, edit BODY.HEALTH and LEVEL by hand.', {
        original: istrongHP,
        recovered: arrasHealth,
        context: 'iStrong level 0 corresponds to arras player level 45. Arras tanks add 90 HP at max level; reverse subtracts that to recover raw HEALTH.',
      });
    } else {
      warn.info('BODY.HEALTH', 'Player tank HP recovered assuming iStrong level 0 = arras level 45 (arras player starting level). No edit needed.', {
        original: istrongHP,
        recovered: arrasHealth,
      });
    }
  }
  return {
    health: Math.max(0, arrasHealth),
    healthWithLevel,
    level: isBoss ? 45 : undefined,
  };
}

export function invertBodyDamage(istrongDamage: number): number {
  return istrongDamage;
}

export function invertMovementSpeed(istrongSpeed: number): number {
  return istrongSpeed * (ARRAS_BASE.SPEED / 3);
}

const DRIVE_BACK_DECIMALS = 1e4;
export function invertDrive(istrongSpeed: number, pushShare: number | undefined): { speed: number; acceleration?: number } {
  const share = (typeof pushShare === 'number' && pushShare >= 0 && pushShare < 1) ? pushShare : ARRAS_BASE.ACCEL / (ARRAS_BASE.SPEED + ARRAS_BASE.ACCEL);
  pushShare = share;
  const whole = istrongSpeed * OSA_DRIVE_PER_FILE_SPEED;
  const back = (v: number) => Math.round(v * DRIVE_BACK_DECIMALS) / DRIVE_BACK_DECIMALS;
  return { speed: back(whole * (1 - pushShare)), acceleration: back(whole * pushShare) };
}

export function invertShieldCapacity(istrongShield: number, isBoss: boolean, warn?: WarningCollector): { shield: number; healthWithLevel: boolean } {
  const healthWithLevel = true;
  const arrasShield = istrongShield / 2 - 27;
  if (isBoss && warn) {
    warn.warn('BODY.SHIELD', 'Shield LEVEL bonus baked in (level 45 assumed).', {
      original: istrongShield,
      recovered: arrasShield,
    });
  }
  return {
    shield: Math.max(0, arrasShield),
    healthWithLevel,
  };
}

export function invertShieldRegen(istrongRegen: number): number {
  return istrongRegen * (ARRAS_BASE.REGEN / 3);
}

export function invertFOV(istrongFOV: number): number {
  return istrongFOV * ARRAS_BASE.FOV;
}

export function invertPushability(istrongPush: number | undefined): number | undefined {
  if (istrongPush === undefined || istrongPush === null) return undefined;
  return istrongPush;
}

export function invertBarrelLength(istrongLength: number): number {
  return ((istrongLength - 1) * 10.49 / 99 + 0.01) * 20;
}

export function invertBarrelWidth(istrongWidth: number): number {
  return istrongWidth * (20 * 0.96) / 50;
}

export function invertBarrelX(istrongX: number): number {
  return istrongX * 10;
}

export function invertBarrelY(istrongY: number): number {
  return istrongY * 10;
}

export function invertBulletSize(istrongSize: number, arrasWidth?: number, arrasAspect: number = 1): number {
  if (!(typeof arrasWidth === 'number' && arrasWidth > 0)) return istrongSize;
  const raw = arrasWidth * 50 / (20 * 0.96);
  const written = convertBarrelWidth(arrasAspect < 0 ? arrasWidth * Math.abs(arrasAspect) : arrasWidth);
  if (!(written > 0)) return istrongSize;
  const k = raw / written;
  return k === 1 ? istrongSize : istrongSize / k;
}

export function invertTopSpeedRatio(arrasSpeed: number, topSpeedRatio: number, entityType: string): number {
  const bodySpeed = BODY_SPEED[entityType] ?? 3.75;
  if (bodySpeed === 0) return 0;
  return (topSpeedRatio * arrasSpeed) / bodySpeed;
}

export function invertBlockTopSpeed(arrasSpeed: number, topSpeedRatio: number | undefined): number {
  const share = typeof topSpeedRatio === 'number' && topSpeedRatio > 0 ? topSpeedRatio : ENGINE_BLOCK_CRUISE_SHARE;
  return Math.max(0, share * arrasSpeed - OSA_BLOCK_PUSH_TICK / (ARRAS_RUN_SPEED * 1.5));
}

export function invertBoomerangDrive(arrasSpeed: number, topSpeedRatio: number | undefined, motorDampLn: number | undefined): { maxSpeed: number; acceleration: number } {
  const share = typeof topSpeedRatio === 'number' && topSpeedRatio > 0 ? topSpeedRatio : 1;
  const own = typeof motorDampLn === 'number' && motorDampLn < -0.001;
  const ln = own ? motorDampLn! : ENGINE_BOOMERANG_DAMP_LN;
  const pushShare = own ? Math.exp(-ln) - 1 : ENGINE_BOOMERANG_PUSH_SHARE;
  const keep = Math.exp(2 * ln);
  const cruise = ARRAS_RUN_SPEED * 1.5 * arrasSpeed * share * pushShare * ENGINE_SUBFRAME / (1 - Math.exp(ln * ENGINE_SUBFRAME));
  return { maxSpeed: keep * cruise / (ARRAS_RUN_SPEED * 1.5 * OSA_BOOMERANG_BODY_SPEED), acceleration: (1 - keep) * cruise / ARRAS_RUN_SPEED };
}

export function invertAutoTurretSize(istrongCircleSize: number): number {
  return istrongCircleSize / 1.86;
}

export function invertSpinSpeed(istrongSpin: number): number {
  const ARRAS_SPIN_MULTIPLIER = 2500 / 3;
  return istrongSpin / ARRAS_SPIN_MULTIPLIER;
}
