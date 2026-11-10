import type { GameMenus } from 'nexum-library';
import { kindOf, type LoadedFile } from '../convert';

export type KindId = 'Tanks' | 'Turrets' | 'Projectiles' | 'Shapes' | 'Others';
export const KINDS: KindId[] = ['Tanks', 'Turrets', 'Projectiles', 'Shapes', 'Others'];
export const KIND_LABEL: Record<KindId, string> = { Tanks: 'Tanks', Turrets: 'Turrets', Projectiles: 'Projectiles', Shapes: 'Food Shapes', Others: 'Others' };
export const KIND_ONE: Record<KindId, string> = { Tanks: 'tank', Turrets: 'turret', Projectiles: 'projectile', Shapes: 'food shape', Others: 'other' };

export interface ManifestEntry { file: string; name: string; type: string; category: string; sub: string; bytes: number; fp: string }
export interface ManifestGroup { id: string; trail: string[]; tree?: string; keys: string[] }
export interface Manifest {
  version: number; fingerprint: string; counts: Record<KindId, number>;
  kinds: Record<KindId, { label: string; count: number; entries: Record<string, ManifestEntry>; groups: ManifestGroup[] }>;
}

export interface LibItem { kind: KindId; key: string; e: ManifestEntry; pic: string }
export const itemId = (it: LibItem) => `${it.kind}:${it.key}`;

let manifestP: Promise<Manifest | null> | null = null;
export function loadManifest(): Promise<Manifest | null> {
  if (!manifestP) manifestP = fetch('/prebuilt/library-manifest.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return manifestP;
}

let menusP: Promise<GameMenus | null> | null = null;
export function loadMenus(): Promise<GameMenus | null> {
  if (!menusP) menusP = fetch('/prebuilt/game/menus.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return menusP;
}

const fileCache = new Map<string, Promise<any>>();
export function loadEnvelope(it: LibItem): Promise<any> {
  let p = fileCache.get(it.e.file);
  if (!p) {
    p = fetch('/prebuilt/library/' + it.e.file.split('/').map(encodeURIComponent).join('/')).then((r) => {
      if (!r.ok) throw new Error(`${it.e.name}: could not be loaded`);
      return r.json();
    });
    fileCache.set(it.e.file, p);
    p.catch(() => fileCache.delete(it.e.file));
  }
  return p;
}

export async function loadedFilesOf(items: LibItem[], onProgress?: (done: number) => void): Promise<LoadedFile[]> {
  const out: LoadedFile[] = new Array(items.length);
  let done = 0, next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      const it = items[i];
      const envelope = await loadEnvelope(it);
      const group = it.kind === 'Shapes' || it.kind === 'Others' ? it.e.sub || it.e.category : it.e.category;
      out[i] = { name: it.e.name, key: it.key, envelope, kind: kindOf(envelope), group };
      done++;
      onProgress?.(done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, items.length) }, worker));
  return out;
}

export function itemsOf(m: Manifest, kind: KindId): LibItem[] {
  const k = m.kinds[kind];
  return Object.entries(k.entries).map(([key, e]) => ({ kind, key, e, pic: e.file.replace(/\.json$/i, '') }));
}
