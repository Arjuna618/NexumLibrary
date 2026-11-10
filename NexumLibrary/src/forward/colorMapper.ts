import { ARRAS_COLORS, ARRAS_COLOR_SLOTS } from '../constants/colors.js';

export function resolveColor(color: any): string {
  if (color === undefined || color === null) return '#a7a7af';
  if (color === -1) return 'inherit';
  if (typeof color === 'number') {
    return ARRAS_COLORS[color] ?? '#a7a7af';
  }
  if (typeof color === 'string') {
    if (color.startsWith('#')) return color;
    if (ARRAS_COLORS[color]) return ARRAS_COLORS[color];
    const parts = color.split(' ');
    if (parts.length >= 1) {
      const base = isNaN(Number(parts[0])) ? parts[0] : Number(parts[0]);
      return ARRAS_COLORS[base] ?? '#a7a7af';
    }
    return '#a7a7af';
  }
  if (typeof color === 'object' && color.BASE !== undefined) {
    return resolveColor(color.BASE);
  }
  return '#a7a7af';
}

export function isTeamDefaultColor(color: any): boolean {
  if (color === undefined || color === null || color === -1 || color === 'mirror') return true;
  let base: any, hue: any, sat: any, bright: any, invert: any;
  if (typeof color === 'number') {
    base = color;
  } else if (typeof color === 'string') {
    const parts = color.trim().split(/\s+/);
    base = parts[0]; hue = parts[1]; sat = parts[2]; bright = parts[3]; invert = parts[4];
  } else if (typeof color === 'object') {
    base = color.BASE ?? color.base ?? 16;
    hue = color.HUE_SHIFT ?? color.hueShift;
    sat = color.SATURATION_SHIFT ?? color.saturationShift;
    bright = color.BRIGHTNESS_SHIFT ?? color.brightnessShift;
    invert = color.ALLOW_BRIGHTNESS_INVERT ?? color.allowBrightnessInvert;
  } else {
    return false;
  }
  const baseStr = String(base).trim();
  if (baseStr === '-1' || baseStr === 'mirror') return true;
  if (baseStr !== '16') return false;
  if (hue !== undefined && Number(hue) !== 0) return false;
  if (sat !== undefined && Number(sat) !== 1) return false;
  if (bright !== undefined && Number(bright) !== 0) return false;
  if (invert !== undefined && String(invert) !== 'false') return false;
  return true;
}

export function colorSlotOf(color: any): number | undefined {
  if (color === undefined || color === null) return undefined;
  let base: any, hue: any, sat: any, bright: any, invert: any;
  if (typeof color === 'string') {
    const parts = color.trim().split(/\s+/);
    base = parts[0]; hue = parts[1]; sat = parts[2]; bright = parts[3]; invert = parts[4];
  } else if (typeof color === 'object') {
    base = color.BASE ?? color.base;
    hue = color.HUE_SHIFT ?? color.hueShift;
    sat = color.SATURATION_SHIFT ?? color.saturationShift;
    bright = color.BRIGHTNESS_SHIFT ?? color.brightnessShift;
    invert = color.ALLOW_BRIGHTNESS_INVERT ?? color.allowBrightnessInvert;
  } else {
    return undefined;
  }
  if (typeof base !== 'string') return undefined;
  if (hue !== undefined && Number(hue) !== 0) return undefined;
  if (sat !== undefined && Number(sat) !== 1) return undefined;
  if (bright !== undefined && Number(bright) !== 0) return undefined;
  if (invert !== undefined && String(invert) !== 'false') return undefined;
  return Object.prototype.hasOwnProperty.call(ARRAS_COLOR_SLOTS, base) ? ARRAS_COLOR_SLOTS[base] : undefined;
}

export const RAMMER_RING_SLOT: number = ARRAS_COLOR_SLOTS.black!;

export function getEntityColor(colorVal: any, defaultColor: string = '#3ca4cb'): string {
  const resolved = resolveColor(colorVal);
  return resolved === 'inherit' ? defaultColor : resolved;
}
