export const EXPLODE_MAX_COUNT = 32;
export const EXPLODE_MAX_RINGS = 8;
export const START_DEG_MIN = -180, START_DEG_MAX = 180, ARC_DEG_MIN = 1, ARC_DEG_MAX = 360;
export const EVEN_TOL_DEG = 0.01;

export function explodeAngleDeg(count: number, startDeg: number, arcDeg: number, i: number): number {
  if (count <= 1) return startDeg;
  if (arcDeg >= 360) return startDeg + (360 / count) * i;
  return startDeg - arcDeg / 2 + (arcDeg / (count - 1)) * i;
}

export interface DeathGun {
  angleDeg: number; x: number; y: number;
  template: any;
}
export interface BurstRing { count: number; startDeg: number; arcDeg: number; fragment: any }
export interface DeathBurst { enabled: true; anyDeath: true; rings: BurstRing[] }

const turn = (d: number) => { const a = ((d % 360) + 360) % 360; return a >= 360 - 1e-9 ? 0 : a; };
const signed = (d: number) => { const a = turn(d); return a > 180 ? a - 360 : a; };
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

function pieceKey(template: any): string {
  const strip = (o: any, top: boolean): any => {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) return o.map((x) => strip(x, false));
    const out: any = {};
    for (const k of Object.keys(o).sort()) {
      if (k === 'id' || k === 'primarySubTurretId' || k === 'primaryTurretId') continue;
      if (top && (k === 'angle' || k === 'xOffset' || k === 'yOffset')) continue;
      out[k] = strip(o[k], false);
    }
    return out;
  };
  return JSON.stringify(strip(template, true));
}

function ringsOfAngles(angles: readonly number[], templateOf: (i: number) => any): BurstRing[] {
  const fragmentOf = (i: number) => ({ ...templateOf(i), angle: 0 });
  const n = angles.length;
  if (n === 1) return [{ count: 1, startDeg: r6(signed(angles[0])), arcDeg: 360, fragment: fragmentOf(0) }];
  const order = angles.map((a, i) => ({ a: turn(a), i })).sort((p, q) => p.a - q.a);
  const gaps = order.map((p, k) => (k + 1 < n ? order[k + 1].a : order[0].a + 360) - p.a);
  const even = 360 / n;
  if (gaps.every((g) => Math.abs(g - even) <= EVEN_TOL_DEG)) {
    return [{ count: n, startDeg: r6(signed(order[0].a)), arcDeg: 360, fragment: fragmentOf(order[0].i) }];
  }
  let widest = 0; for (let k = 1; k < n; k++) if (gaps[k] > gaps[widest]) widest = k;
  const first = (widest + 1) % n;
  const fan: number[] = []; let at = order[first].a; fan.push(at);
  for (let k = 0; k < n - 1; k++) { at += gaps[(first + k) % n]; fan.push(at); }
  const step = (fan[n - 1] - fan[0]) / (n - 1);
  const arc = fan[n - 1] - fan[0];
  const steady = fan.every((v, k) => Math.abs(v - (fan[0] + step * k)) <= EVEN_TOL_DEG);
  if (steady && arc >= ARC_DEG_MIN && arc < ARC_DEG_MAX) {
    return [{ count: n, startDeg: r6(signed(fan[0] + arc / 2)), arcDeg: r6(arc), fragment: fragmentOf(order[first].i) }];
  }
  return order.map((p) => ({ count: 1, startDeg: r6(signed(p.a)), arcDeg: 360, fragment: fragmentOf(p.i) }));
}

export function burstOfDeathGuns(guns: readonly DeathGun[], who: string): DeathBurst {
  if (guns.length === 0) throw new Error(`deathBurst: ${who}: no death gun given`);
  for (const g of guns) {
    if (Math.abs(g.x) > 1e-9 || Math.abs(g.y) > 1e-9) {
      throw new Error(`deathBurst: ${who}: a death gun sits off the round's middle (X ${g.x}, Y ${g.y}); the game's pieces appear at the middle, so this cannot be written. Not guessed.`);
    }
  }
  const groups: { key: string; idx: number[] }[] = [];
  guns.forEach((g, i) => { const key = pieceKey(g.template); const at = groups.find((x) => x.key === key); if (at) at.idx.push(i); else groups.push({ key, idx: [i] }); });
  const rings: BurstRing[] = [];
  for (const grp of groups) rings.push(...ringsOfAngles(grp.idx.map((i) => guns[i].angleDeg), (k) => guns[grp.idx[k]].template));
  if (rings.length > EXPLODE_MAX_RINGS) throw new Error(`deathBurst: ${who}: ${rings.length} rings, the game holds ${EXPLODE_MAX_RINGS}. Not cut.`);
  for (const r of rings) {
    if (r.count < 1 || r.count > EXPLODE_MAX_COUNT) throw new Error(`deathBurst: ${who}: a ring of ${r.count} pieces, the game holds 1 to ${EXPLODE_MAX_COUNT}. Not cut.`);
    if (r.startDeg < START_DEG_MIN || r.startDeg > START_DEG_MAX || r.arcDeg < ARC_DEG_MIN || r.arcDeg > ARC_DEG_MAX) throw new Error(`deathBurst: ${who}: ring ${JSON.stringify({ startDeg: r.startDeg, arcDeg: r.arcDeg })} lies outside what the game's load keeps`);
  }
  const want = guns.map((g) => turn(g.angleDeg)).sort((a, b) => a - b);
  const got: number[] = [];
  for (const r of rings) for (let i = 0; i < r.count; i++) got.push(turn(explodeAngleDeg(r.count, r.startDeg, r.arcDeg, i)));
  got.sort((a, b) => a - b);
  const off = (a: number, b: number) => { const d = Math.abs(a - b); return d > 180 ? 360 - d : d; };
  if (got.length !== want.length || got.some((a, i) => off(a, want[i]) > EVEN_TOL_DEG)) {
    throw new Error(`deathBurst: ${who}: the rings give ${JSON.stringify(got.map(r6))} where arras points its guns at ${JSON.stringify(want.map(r6))}`);
  }
  return { enabled: true, anyDeath: true, rings };
}
