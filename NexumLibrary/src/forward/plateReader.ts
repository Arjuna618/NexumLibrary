import type { ArrasClassDef, Registry } from '../types/arras.js';
import { ISTRONG_PLATE_KEY, ISTRONG_MAIN_BODY_KEY } from '../types/istrongMeta.js';
import { resolveFlat } from './classResolver.js';

export interface PlatesRead {
  bodyLayers: any[];
  turrets: any[];
  mainBody: ArrasClassDef | null;
}

const typeName = (t: any): string | null => (typeof t === 'string' ? t : Array.isArray(t) && typeof t[0] === 'string' ? t[0] : null);
const shareOf = (e: any): number => {
  const s = Array.isArray(e?.POSITION) ? e.POSITION[0] : e?.POSITION?.SIZE;
  return (typeof s === 'number' ? s : 10) / 20;
};

export function readPlates(
  flat: ArrasClassDef,
  rawClass: ArrasClassDef | undefined,
  registry: Registry,
  tankArrasSize: number,
  parts: (guns: any[], turrets: any[], arrasSize: number, color: any) => any[],
): PlatesRead | null {
  const entries: any[] = Array.isArray(flat.TURRETS) ? flat.TURRETS : [];
  const marked = entries.map((e) => {
    const n = typeName(e?.TYPE);
    const c: any = n ? registry.get(n) : undefined;
    return { e, n, plate: c?.[ISTRONG_PLATE_KEY] ?? null, main: !!c?.[ISTRONG_MAIN_BODY_KEY] };
  });
  const anchor = (rawClass as any)?.[ISTRONG_PLATE_KEY] ?? null;
  if (!anchor && !marked.some((m) => m.plate || m.main)) return null;

  const main = marked.find((m) => m.main) ?? null;
  const own = marked.filter((m) => !m.plate && !m.main).map((m) => m.e);
  const flatGuns: any[] = Array.isArray(flat.GUNS) ? flat.GUNS : [];
  const layers: { index: number; layer: any }[] = [];
  const turrets: any[] = [];
  const K = main ? 1 / shareOf(main.e) : 1;
  const unpush = (list: any[], gunK: number, autoK: number) => {
    for (const t of list) {
      if (t?.turretType === 'auto' || t?.turretType === 'autoCircle') { for (const s of t.autoSubTurrets ?? []) if (typeof s.knockback === 'number') s.knockback /= autoK; }
      else if (typeof t?.knockback === 'number') t.knockback /= gunK;
    }
    return list;
  };
  const onLayer = (record: any, list: any[]) => {
    const { index, ...layer } = record;
    layers.push({ index: typeof index === 'number' ? index : layers.length, layer: { ...layer, turretIds: list.map((t) => t.id), _currentAngle: 0 } });
  };

  let mainBody: ArrasClassDef | null = null;
  if (main) {
    mainBody = resolveFlat(main.n!, registry);
    const m = unpush(parts(Array.isArray(mainBody.GUNS) ? mainBody.GUNS : [], Array.isArray(mainBody.TURRETS) ? mainBody.TURRETS : [], tankArrasSize * shareOf(main.e), mainBody.COLOR), K, 1 / K);
    turrets.push(...m);
    if (anchor) {
      const a = unpush(parts(flatGuns, own, tankArrasSize, flat.COLOR), 1, K);
      onLayer(anchor, a);
      turrets.push(...a);
    }
  } else {
    turrets.push(...parts(flatGuns, own, tankArrasSize, flat.COLOR));
  }
  for (const m of marked) {
    if (!m.plate) continue;
    const cls = resolveFlat(m.n!, registry);
    const s = shareOf(m.e);
    const list = unpush(parts(Array.isArray(cls.GUNS) ? cls.GUNS : [], Array.isArray(cls.TURRETS) ? cls.TURRETS : [], tankArrasSize * s, cls.COLOR), 1 / s, K * s * s);
    onLayer(m.plate, list);
    turrets.push(...list);
  }
  layers.sort((a, b) => a.index - b.index);
  return { bodyLayers: layers.map((l) => l.layer), turrets, mainBody };
}
