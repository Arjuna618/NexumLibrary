import { convertTankBarrelSpeed } from './physicsCalibrator.js';

export interface MeasuredFlight {
  speed: number;
  lifetime: number;
  reload?: number;
  trail?: readonly (MeasuredTrail | null)[];
}

export interface MeasuredTrail {
  speed: number;
  top: number;
  lifetime: number;
}

export const MEASURED_FLIGHT: Readonly<Record<string, MeasuredFlight>> = Object.freeze({
  sidewinder: Object.freeze({ speed: 177, lifetime: 4, reload: 1.947, trail: Object.freeze([
    Object.freeze({ speed: 48.5, top: 48.5, lifetime: 1.9 }),
    Object.freeze({ speed: 27, top: 110, lifetime: 2.4 }),
  ]) }),
});

export const MEASURE_WINDOW_WIDTH = 2560;
const ENGINE_REF_VIEW = 275 * Math.sqrt((24 + (9 - 1) / 9 * 24) / 2);

export function engineSpeedSliderFor(unitsPerSecond: number): number {
  const movementZoom = MEASURE_WINDOW_WIDTH / ENGINE_REF_VIEW;
  return unitsPerSecond * movementZoom / 60 - 5;
}

export function engineRoundBarrelSliderFor(unitsPerSecond: number): number {
  const movementZoom = MEASURE_WINDOW_WIDTH / ENGINE_REF_VIEW;
  return unitsPerSecond * movementZoom / (60 * 2.25);
}

function ownBarrelsOf(turret: any): any[] | null {
  const cpd = turret?.projectileType?.customProjectileDesign;
  return cpd && Array.isArray(cpd.turrets) && cpd.turrets.length > 0 ? cpd.turrets : null;
}

function setNumber(obj: any, key: string, value: number): boolean {
  if (obj[key] === value) return false;
  obj[key] = value;
  return true;
}

export function applyMeasuredFlight(className: string, turrets: any[]): number {
  const m = MEASURED_FLIGHT[className];
  if (!m) return 0;
  let changed = 0;
  for (const t of turrets) {
    if (!t || t.turretType === 'decorative') continue;
    const own = ownBarrelsOf(t);
    if (!own) continue;
    let touched = false;
    if (setNumber(t, 'speed', engineSpeedSliderFor(m.speed))) touched = true;
    if (setNumber(t.projectileType, 'topSpeedRatio', 1)) touched = true;
    if (setNumber(t, 'bulletLifetime', m.lifetime)) touched = true;
    if (typeof t.projectileType.lifetime === 'number' && t.projectileType.lifetime > 0) {
      if (setNumber(t.projectileType, 'lifetime', m.lifetime)) touched = true;
    }
    if (typeof m.reload === 'number' && m.reload > 0) {
      if (setNumber(t, 'bps', 1 / m.reload)) touched = true;
    }
    let barrel = -1;
    for (const sub of own) {
      if (!sub || sub.turretType === 'decorative') continue;
      barrel++;
      const tr = m.trail ? m.trail[barrel] : null;
      if (tr && sub.projectileType) {
        if (setNumber(sub, 'speed', engineRoundBarrelSliderFor(tr.speed))) touched = true;
        if (setNumber(sub.projectileType, 'topSpeedRatio', tr.top / tr.speed)) touched = true;
        if (setNumber(sub, 'bulletLifetime', tr.lifetime)) touched = true;
        if (typeof sub.projectileType.lifetime === 'number' && sub.projectileType.lifetime > 0) {
          if (setNumber(sub.projectileType, 'lifetime', tr.lifetime)) touched = true;
        }
      }
      if (typeof sub.knockback === 'number' && sub.knockback > 0) { sub.knockback = 0; touched = true; }
    }
    if (touched) changed++;
  }
  return changed;
}

export interface MeasuredBullet { launch: number; cruise: number; }
export const MEASURED_BASIC_BULLET: Readonly<MeasuredBullet> = Object.freeze({ launch: 284.5, cruise: 257.1 });
export const MEASURED_BULLET: Readonly<Record<string, MeasuredBullet>> = Object.freeze({
  sniper: Object.freeze({ launch: 346.8, cruise: 308.1 }),
  assassin: Object.freeze({ launch: 377.4, cruise: 338.7 }),
  ranger: Object.freeze({ launch: 379.0, cruise: 339.1 }),
  stalker: Object.freeze({ launch: 381.3, cruise: 339.2 }),
});
const BASIC_SPEED_STAT = 5, BASIC_TOP_RATIO = 0.75;

export interface MeasuredDrone { sizeOverTank: number; topSpeedFactor: number; }
export const MEASURED_DRONE: Readonly<Record<string, MeasuredDrone>> = Object.freeze({
  director: Object.freeze({ sizeOverTank: 7.4375 / 24.125, topSpeedFactor: 0.9 }),
});
const widthOfSlider = (slider: number) => slider * 20 * 0.96 / 50;

export function applyMeasuredRounds(className: string, turrets: any[]): number {
  const mb = MEASURED_BULLET[className], md = MEASURED_DRONE[className];
  if (!mb && !md) return 0;
  let changed = 0;
  for (const t of turrets) {
    if (!t || t.turretType === 'decorative' || !(t.bps > 0) || !t.projectileType) continue;
    const visual = t.projectileType.visual;
    let touched = false;
    if (mb && visual === 'bullet' && !ownBarrelsOf(t)) {
      const L = mb.launch / MEASURED_BASIC_BULLET.launch, C = mb.cruise / MEASURED_BASIC_BULLET.cruise;
      if (setNumber(t, 'speed', convertTankBarrelSpeed(BASIC_SPEED_STAT * L))) touched = true;
      if (setNumber(t.projectileType, 'topSpeedRatio', BASIC_TOP_RATIO * C / L)) touched = true;
    }
    if (md && visual === 'drone' && !t._measuredDrone) {
      const width = widthOfSlider(t.width);
      if (width > 0) {
        if (setNumber(t.projectileType, 'size', md.sizeOverTank * 20 / width)) touched = true;
        if (setNumber(t.projectileType, 'topSpeedRatio', t.projectileType.topSpeedRatio * md.topSpeedFactor)) touched = true;
        Object.defineProperty(t, '_measuredDrone', { value: true, enumerable: false });
      }
    }
    if (touched) changed++;
  }
  return changed;
}

export const MEASURED_TANK_RADIUS = 24.125;
const SENTRY_RADIUS = 17.625, SENTINEL_RADIUS = 25.6875;
export const MEASURED_BODY_RADIUS: Readonly<Record<string, number>> = Object.freeze({
  sentry: SENTRY_RADIUS, sentrySwarm: SENTRY_RADIUS, sentryGun: SENTRY_RADIUS, sentryTrap: SENTRY_RADIUS,
  sentinelSwarm: SENTRY_RADIUS, sentinelGun: SENTRY_RADIUS, sentinelTrap: SENTRY_RADIUS,
  sentinel: SENTINEL_RADIUS, sentinelLauncher: SENTINEL_RADIUS, sentinelCrossbow: SENTINEL_RADIUS, sentinelMinigun: SENTINEL_RADIUS,
});
export function measuredBodySize(className: string): number | undefined {
  const r = MEASURED_BODY_RADIUS[className];
  return r === undefined ? undefined : 12 * r / MEASURED_TANK_RADIUS;
}
