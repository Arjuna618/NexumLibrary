import { convertEnvelopeToArras, emitArrasJS, buildOsaPack, osaPackFiles, type GameMenus, type PackFile, type PackGroupedFile } from 'nexum-library';

export type FileKind = 'Tank' | 'TurretPreset' | 'CustomProjectile' | 'FoodShape' | 'Other' | 'Legacy' | 'Unknown';
export const KIND_WORD: Record<FileKind, string> = {
  Tank: 'Tank', TurretPreset: 'Turret', CustomProjectile: 'Projectile', FoodShape: 'Food Shape', Other: 'Other', Legacy: 'Old style turret', Unknown: 'Not an iStrong file',
};
export function kindOf(env: any): FileKind {
  const t = env?.type;
  if (t === 'Tank' || t === 'TurretPreset' || t === 'CustomProjectile' || t === 'FoodShape' || t === 'Other') return t;
  if (t === 'CustomTurret') return 'Legacy';
  return 'Unknown';
}
export const hasClassCode = (k: FileKind) => k === 'Tank' || k === 'TurretPreset' || k === 'CustomProjectile';
export const inAddon = (k: FileKind) => k !== 'Legacy' && k !== 'Unknown';

export interface LoadedFile { name: string; key: string; envelope: any; kind: FileKind; group?: string }
export interface SourceFile { id: string; name: string; key: string; kind: FileKind; group?: string; envelope?: any; path?: string }

export function classCodeOf(f: LoadedFile): { text: string; className: string; warnings: { severity: string; field: string; message: string }[] } {
  const r = convertEnvelopeToArras(f.envelope);
  const text = [...r.dependencies, r.primary].map((c) => emitArrasJS(c)).join('\n');
  return { text, className: r.primary.className, warnings: r.warnings as any };
}

const safeKey = (s: string) => s.replace(/\.json$/i, '').replace(/[^A-Za-z0-9_-]+/g, '_') || 'file';

export function addonFilesOf(files: LoadedFile[], menus: GameMenus | null): { files: { name: string; content: string }[]; problems: string[]; notConverted: string[] } {
  const tanks: PackFile[] = [], shapes: PackGroupedFile[] = [], others: PackGroupedFile[] = [], presets: PackGroupedFile[] = [], projectiles: PackGroupedFile[] = [];
  const seen = new Set<string>();
  const keyOf = (f: LoadedFile) => { let k = safeKey(f.key), n = 2; while (seen.has(k)) k = `${safeKey(f.key)}_${n++}`; seen.add(k); return k; };
  for (const f of files) {
    const key = keyOf(f);
    const group = f.group || f.envelope?.category || 'Picked';
    if (f.kind === 'Tank') tanks.push({ key, envelope: f.envelope });
    else if (f.kind === 'TurretPreset') presets.push({ group, key, envelope: f.envelope });
    else if (f.kind === 'CustomProjectile') projectiles.push({ group, key, envelope: f.envelope });
    else if (f.kind === 'FoodShape') shapes.push({ group, key, envelope: f.envelope });
    else if (f.kind === 'Other') others.push({ group, key, envelope: f.envelope });
  }
  const pack = buildOsaPack({ tanks, shapes, others, presets, projectiles, menus });
  const out = osaPackFiles(pack);
  return { files: Object.entries(out).map(([n, content]) => ({ name: `istrong/${n}`, content })), problems: pack.problems, notConverted: pack.notConverted };
}

let dropSeq = 0;
export async function readIstrongFiles(picked: (File | { file: File; path: string })[]): Promise<{ files: SourceFile[]; errors: string[] }> {
  const list = picked.map((p) => (p instanceof File ? { file: p, path: (p as any).webkitRelativePath || p.name } : p));
  const files: SourceFile[] = [], errors: string[] = [];
  const add = (name: string, text: string) => {
    try {
      const envelope = JSON.parse(text);
      const kind = kindOf(envelope);
      if (kind === 'Unknown') { errors.push(`${name}: not an iStrong file`); return; }
      const base = name.split('/').pop() || name;
      const parts = name.split('/');
      files.push({ id: `drop-${++dropSeq}`, name: envelope?.name || base, key: base.replace(/\.json$/i, ''), envelope, kind, group: parts.length > 2 ? parts[parts.length - 2] : undefined });
    } catch (e) { errors.push(`${name}: ${(e as Error).message}`); }
  };
  for (const { file, path } of list) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.zip')) {
      try {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        for (const [p, entry] of Object.entries(zip.files)) {
          const e = entry as any;
          if (e.dir || !p.toLowerCase().endsWith('.json')) continue;
          add(p, await e.async('string'));
        }
      } catch (e) { errors.push(`${file.name}: ${(e as Error).message}`); }
    } else if (lower.endsWith('.json')) add(path, await file.text());
  }
  return { files, errors };
}

export async function filesOfDrop(dt: DataTransfer): Promise<{ file: File; path: string }[]> {
  const out: { file: File; path: string }[] = [];
  const entries: any[] = [];
  for (let i = 0; i < dt.items.length; i++) {
    const it = dt.items[i];
    if (it.kind !== 'file') continue;
    const en = typeof (it as any).webkitGetAsEntry === 'function' ? (it as any).webkitGetAsEntry() : null;
    if (en) entries.push(en);
    else { const f = it.getAsFile(); if (f) out.push({ file: f, path: f.name }); }
  }
  const walk = async (en: any, base: string): Promise<void> => {
    if (en.isFile) {
      const f: File = await new Promise((res, rej) => en.file(res, rej));
      out.push({ file: f, path: base + f.name });
    } else if (en.isDirectory) {
      const reader = en.createReader();
      for (;;) {
        const batch: any[] = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const c of batch) await walk(c, base + en.name + '/');
      }
    }
  };
  for (const en of entries) await walk(en, '');
  return out;
}
