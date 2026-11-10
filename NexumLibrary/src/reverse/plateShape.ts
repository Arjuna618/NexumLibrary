import type { WarningCollector } from '../warnings/collector.js';

export function osaPolygonShape(sides: number, star: boolean, evenTurn: boolean): number {
  const n = Math.floor(sides);
  let frac = sides - n;
  if (evenTurn && n >= 4 && n % 2 === 0) frac = (((frac - 1 / (2 * n)) % 1) + 1) % 1;
  const s = +(n + frac).toFixed(6);
  return star ? -s : s;
}

export function realSizeFactor(sides: number): number {
  if (!(sides >= 3)) return 1;
  const c = (2 * Math.PI) / Math.floor(sides);
  return Math.sqrt(c / Math.sin(c));
}

export function plateShape(layer: any, sides: number, warn: WarningCollector): number | number[][] {
  if (Array.isArray(layer.outline) && layer.outline.length >= 3) return layer.outline.map((p: number[]) => [p[0], p[1]]);
  const depth = typeof layer.starDepth === 'number' ? layer.starDepth : 0;
  if (depth > 0 && sides >= 3) {
    if (layer.starCurved) warn.warn('bodyLayers', `layer "${layer.label ?? ''}": a curved star goes to OSA with straight sides`);
    const k = realSizeFactor(sides);
    const pts: number[][] = [];
    for (let i = 0; i < sides * 2; i++) {
      const a = (Math.PI * i) / sides, r = (i % 2 ? 1 - depth : 1) * k;
      pts.push([+(r * Math.cos(a)).toFixed(4), +(r * Math.sin(a)).toFixed(4)]);
    }
    return pts;
  }
  return sides;
}
