import type { ArrasClassEmit } from '../types/warnings.js';
import { arrasColorOf } from './colorInverter.js';

export interface DesignItem { part: any; lx: number; ly: number; rot: number }

export function designItems(body: any): DesignItem[] {
  const items: DesignItem[] = [];
  const walk = (p: any, px: number, py: number, f: number): void => {
    const kids: any[] = Array.isArray(p.parts) ? p.parts : [];
    const c = Math.cos(f), s = Math.sin(f);
    const child = (k: any) => walk(k, px + (k.x ?? 0) * c - (k.y ?? 0) * s, py + (k.x ?? 0) * s + (k.y ?? 0) * c, f + (k.angle ?? 0));
    for (const k of kids) if (!k.above) child(k);
    items.push({ part: p, lx: px, ly: py, rot: f + (p.turn ?? 0) });
    for (const k of kids) if (k.above) child(k);
  };
  walk(body, 0, 0, 0);
  return items;
}

const round4 = (v: number) => +v.toFixed(4);

export function partShape(p: any, rot: number): number | number[][] | null {
  const c = Math.cos(rot), s = Math.sin(rot);
  const turned = (q: number[][]) => q.map(([x, y]) => [round4(x! * c - y! * s), round4(x! * s + y! * c)]);
  if (p.kind === 'circle') return 0;
  if (p.kind === 'line') return turned([[1, 0], [-1, 0]]);
  if (p.kind === 'outline' && Array.isArray(p.points)) return turned(p.points);
  const n = p.sides;
  if (!(typeof n === 'number' && n >= 3)) return null;
  const pts: number[][] = [];
  if (p.kind === 'polygon') for (let i = 0; i < n; i++) pts.push([Math.cos((2 * Math.PI * i) / n), Math.sin((2 * Math.PI * i) / n)]);
  else if (p.kind === 'star') for (let i = 0; i < 2 * n; i++) { const r = i % 2 ? p.inner ?? 0.5 : 1; pts.push([r * Math.cos((Math.PI * i) / n), r * Math.sin((Math.PI * i) / n)]); }
  else return null;
  return turned(pts);
}

export function partColor(p: any): string | number {
  if (p.team === true) return 'mirror';
  return arrasColorOf(p.color, p.colorMap);
}

export interface DesignClasses {
  root: ArrasClassEmit;
  parts: ArrasClassEmit[];
  skipped: string[];
}

export function designClasses(body: any, className: string): DesignClasses {
  const items = designItems(body);
  const at = items.findIndex((it) => it.part === body);
  const R = body.radius ?? 1;
  const skipped: string[] = [];
  const shape = partShape(body, body.turn ?? 0);
  const root: ArrasClassEmit = {
    className, LABEL: '', SHAPE: shape ?? 0, COLOR: partColor(body), INDEPENDENT: true, MIRROR_MASTER_ANGLE: true,
  } as any;
  if (body.kind === 'line') (root as any).DRAW_FILL = false;
  const parts: ArrasClassEmit[] = [];
  const turrets: any[] = [];
  items.forEach((it, i) => {
    if (i === at) return;
    const p = it.part;
    const own = partShape(p, 0);
    if (own === null) { skipped.push(`${className}: a ${p.kind} part`); return; }
    const name = `${className}_part${parts.length}`;
    const cls: any = { className: name, LABEL: '', SHAPE: own, COLOR: partColor(p), INDEPENDENT: true, MIRROR_MASTER_ANGLE: true };
    if (p.kind === 'line') cls.DRAW_FILL = false;
    parts.push(cls);
    const a = it.rot, ca = Math.cos(-a), sa = Math.sin(-a);
    const x = (10 * it.lx) / R, y = (10 * it.ly) / R;
    turrets.push({ POSITION: [round4((20 * (p.radius ?? 1)) / R), round4(x * ca - y * sa), round4(x * sa + y * ca), round4((a * 180) / Math.PI), 360, i < at ? 0 : 1], TYPE: name });
  });
  if (turrets.length) (root as any).TURRETS = turrets;
  return { root, parts, skipped };
}
