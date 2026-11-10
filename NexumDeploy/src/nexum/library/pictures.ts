import { acTick, AC_UI, acRainbowHex, acTransHex, acFlashIsFirst } from '../../istrong/utils/animColorArras';
import { cmBorderRgb } from '../../istrong/utils/colorMap';
import { borderBlendFor } from '../../istrong/utils/gameTheme';

export type Part = [number, number, number, number, number, number, string, number];
export interface Pic { p: Part[]; a?: string; o?: number }
type MeshDef = { kind: 'outline'; points: [number, number][] } | { kind: 'line' } | { kind: 'star' | 'curvedStar'; sides: number; inner: number };
interface PicIndex {
  version: number; chunk: number; meshStart: number; meshes: MeshDef[];
  flash: Record<string, [string[], string[]]>; flashTypes: Record<string, number>; index: Record<string, number>;
}

const BASE = '/prebuilt/pictures/';
let indexP: Promise<PicIndex | null> | null = null;
let index: PicIndex | null = null;
const chunks = new Map<number, Promise<Record<string, [Pic, Pic]>>>();
const ready = new Map<string, [Pic, Pic] | null>();

function loadIndex(): Promise<PicIndex | null> {
  if (!indexP) {
    indexP = fetch(BASE + 'index.json').then((r) => (r.ok ? r.json() : null)).then((ix: PicIndex | null) => { index = ix; return ix; }).catch(() => null);
  }
  return indexP;
}

export async function loadPicture(key: string): Promise<[Pic, Pic] | null> {
  const known = ready.get(key);
  if (known !== undefined) return known;
  const ix = await loadIndex();
  const n = ix?.index[key];
  if (ix == null || n == null) { ready.set(key, null); return null; }
  let c = chunks.get(n);
  if (!c) {
    c = fetch(`${BASE}${n}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    chunks.set(n, c);
  }
  const all = await c;
  const two = all[key] ?? null;
  ready.set(key, two);
  return two;
}
export function pictureNow(key: string): [Pic, Pic] | null | undefined { return ready.get(key); }

const MESH_BARREL = 0, MESH_CIRCLE = 1, MESH_POLY0 = 2, MESH_CROSS = 16;
const CROSS_X = [0.3, 1, 1, 0.3, 0.3, -0.3, -0.3, -1, -1, -0.3, -0.3, 0.3];
const CROSS_Y = [-0.3, -0.3, 0.3, 0.3, 1, 1, 0.3, 0.3, -0.3, -0.3, -1, -1];
const STROKE_HALF = 3, ICON_UNITS = 80;

function tracePart(ctx: CanvasRenderingContext2D, mesh: number, aspect: number, made: MeshDef | undefined): void {
  if (mesh === MESH_BARREL) {
    ctx.moveTo(0, -0.5); ctx.lineTo(1, -0.5 * aspect); ctx.lineTo(1, 0.5 * aspect); ctx.lineTo(0, 0.5); ctx.closePath();
  } else if (mesh === MESH_CIRCLE) {
    ctx.moveTo(1, 0); ctx.arc(0, 0, 1, 0, Math.PI * 2);
  } else if (mesh === MESH_CROSS) {
    ctx.moveTo(CROSS_X[0], CROSS_Y[0]);
    for (let i = 1; i < 12; i++) ctx.lineTo(CROSS_X[i], CROSS_Y[i]);
    ctx.closePath();
  } else if (mesh >= MESH_POLY0 && mesh < MESH_CROSS) {
    const n = mesh - MESH_POLY0 + 3;
    ctx.moveTo(1, 0);
    for (let i = 1; i < n; i++) { const a = (Math.PI * 2 * i) / n; ctx.lineTo(Math.cos(a), Math.sin(a)); }
    ctx.closePath();
  } else if (made) {
    if (made.kind === 'outline') {
      const pts = made.points;
      if (!pts.length) return;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    } else if (made.kind === 'line') {
      ctx.moveTo(-1, 0); ctx.lineTo(1, 0);
    } else if (made.kind === 'star') {
      const n = made.sides * 2;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n, r = i % 2 === 0 ? 1 : made.inner;
        if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a)); else ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
      }
      ctx.closePath();
    } else {
      const n = made.sides;
      ctx.moveTo(1, 0);
      for (let i = 0; i < n; i++) {
        const h = (Math.PI * 2 * (i + 0.5)) / n, nx = (Math.PI * 2 * (i + 1)) / n;
        ctx.quadraticCurveTo(made.inner * Math.cos(h), made.inner * Math.sin(h), Math.cos(nx), Math.sin(nx));
      }
      ctx.closePath();
    }
  }
}

const strokeOf = new Map<string, string>();
function outlineColour(fill: string, dark: boolean): string {
  const k = (dark ? 'd' : 'l') + fill;
  let s = strokeOf.get(k);
  if (!s) {
    const n = parseInt(fill.charCodeAt(0) === 35 ? fill.slice(1) : fill, 16) || 0;
    const ink = cmBorderRgb(dark), b = borderBlendFor(dark);
    const mix = (c: number, i: number) => Math.round(c * (1 - b) + i * b);
    s = `rgb(${mix((n >> 16) & 255, ink[0])},${mix((n >> 8) & 255, ink[1])},${mix(n & 255, ink[2])})`;
    strokeOf.set(k, s);
  }
  return s;
}

function animColour(a: string, dark: boolean): string {
  if (a === 'rainbow') return acRainbowHex(AC_UI);
  const f = index?.flashTypes[a];
  if (f === undefined) return acTransHex(AC_UI);
  const pair = index!.flash[String(f)]?.[dark ? 1 : 0];
  return pair ? (acFlashIsFirst(AC_UI) ? pair[0] : pair[1]) : acTransHex(AC_UI);
}

export function tickAnimatedColours(): void { acTick(Date.now(), AC_UI); }

let scratch: HTMLCanvasElement | null = null;

export function drawPicture(ctx: CanvasRenderingContext2D, pic: Pic, dark: boolean, cx: number, cy: number, size: number): void {
  if (pic.o !== undefined && pic.o < 1) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    if (!scratch) scratch = document.createElement('canvas');
    if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
    const s = scratch.getContext('2d')!;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.clearRect(0, 0, w, h);
    drawParts(s, pic, dark, cx, cy, size);
    ctx.save();
    ctx.globalAlpha = pic.o;
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
    return;
  }
  drawParts(ctx, pic, dark, cx, cy, size);
}

function drawParts(ctx: CanvasRenderingContext2D, pic: Pic, dark: boolean, cx: number, cy: number, size: number): void {
  const unit = size / ICON_UNITS;
  const anim = pic.a ? animColour(pic.a, dark) : '';
  ctx.lineJoin = 'round';
  for (const part of pic.p) {
    const [mesh, x, y, rot, sx, sy, hex, aspect] = part;
    const made = mesh >= (index?.meshStart ?? 17) ? index?.meshes[mesh - (index?.meshStart ?? 17)] : undefined;
    const fill = anim || '#' + hex;
    const c = Math.cos(rot), s = Math.sin(rot);
    ctx.setTransform(c * sx * size, s * sx * size, -s * sy * size, c * sy * size, cx + x * size, cy + y * size);
    ctx.beginPath();
    tracePart(ctx, mesh, aspect, made);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const line = made?.kind === 'line';
    ctx.strokeStyle = outlineColour(fill, dark);
    ctx.lineWidth = STROKE_HALF * 2 * unit * (mesh === MESH_CROSS ? 0.7 : 1);
    ctx.lineCap = line ? 'round' : 'butt';
    ctx.stroke();
    if (!line) { ctx.fillStyle = fill; ctx.fill(); }
  }
}

export const isAnimated = (pic: Pic) => !!pic.a;
