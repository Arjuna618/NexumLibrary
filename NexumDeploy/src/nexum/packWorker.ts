import JSZip from 'jszip';
import type { GameMenus } from 'nexum-library';
import { addonFilesOf, classCodeOf, kindOf, hasClassCode, type LoadedFile, type SourceFile } from './convert';

export type JobIn =
  | { id: number; job: 'addon'; files: SourceFile[]; menus: GameMenus | null; zipName: string }
  | { id: number; job: 'code'; files: SourceFile[]; zipName: string }
  | { id: number; job: 'files'; files: SourceFile[]; zipName: string };
export type JobOut =
  | { id: number; kind: 'progress'; done: number; total: number; stage: 'read' | 'convert' | 'zip' }
  | { id: number; kind: 'done'; blob: Blob; name: string; problems: string[]; notConverted: string[]; count: number }
  | { id: number; kind: 'failed'; error: string };

const post = (m: JobOut) => (self as unknown as Worker).postMessage(m);

async function read(id: number, files: SourceFile[]): Promise<LoadedFile[]> {
  const out: LoadedFile[] = new Array(files.length);
  let done = 0, next = 0;
  const one = async () => {
    while (next < files.length) {
      const i = next++;
      const f = files[i];
      let envelope = f.envelope;
      if (envelope === undefined && f.path) {
        const r = await fetch('/prebuilt/library/' + f.path.split('/').map(encodeURIComponent).join('/'));
        if (!r.ok) throw new Error(`${f.name}: could not be loaded`);
        envelope = await r.json();
      }
      out[i] = { name: f.name, key: f.key, envelope, kind: kindOf(envelope), group: f.group };
      if (++done % 20 === 0 || done === files.length) post({ id, kind: 'progress', done, total: files.length, stage: 'read' });
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, files.length) }, one));
  return out;
}

const safe = (s: string) => s.replace(/\.json$/i, '').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'file';

self.onmessage = async (ev: MessageEvent<JobIn>) => {
  const m = ev.data;
  try {
    const files = await read(m.id, m.files);
    const zip = new JSZip();
    let problems: string[] = [], notConverted: string[] = [];
    if (m.job === 'addon') {
      post({ id: m.id, kind: 'progress', done: 0, total: files.length, stage: 'convert' });
      const r = addonFilesOf(files, m.menus);
      for (const f of r.files) zip.file(f.name, f.content);
      problems = r.problems; notConverted = r.notConverted;
    } else if (m.job === 'code') {
      const used = new Set<string>();
      files.forEach((f, i) => {
        if (!hasClassCode(f.kind)) { notConverted.push(`${f.name}: a ${f.kind === 'FoodShape' ? 'food shape' : 'file of this kind'} goes out only in an OSA addon`); return; }
        try {
          const c = classCodeOf(f);
          let n = safe(f.name), k = 2;
          while (used.has(n.toLowerCase())) n = `${safe(f.name)} ${k++}`;
          used.add(n.toLowerCase());
          zip.file(`${n}.js`, c.text);
          for (const w of c.warnings) if (w.severity === 'error') problems.push(`${f.name}: ${w.message}`);
        } catch (e) { problems.push(`${f.name}: ${(e as Error).message}`); }
        if ((i + 1) % 20 === 0) post({ id: m.id, kind: 'progress', done: i + 1, total: files.length, stage: 'convert' });
      });
    } else {
      const used = new Set<string>();
      for (const f of files) {
        const folder = f.kind === 'Tank' ? 'Tanks' : f.kind === 'TurretPreset' || f.kind === 'Legacy' ? 'Turrets' : f.kind === 'CustomProjectile' ? 'Projectiles' : f.kind === 'FoodShape' ? 'Shapes' : 'Others';
        let n = `${folder}/${safe(f.key)}.json`, k = 2;
        while (used.has(n.toLowerCase())) n = `${folder}/${safe(f.key)} ${k++}.json`;
        used.add(n.toLowerCase());
        zip.file(n, JSON.stringify(f.envelope, null, 2));
      }
    }
    post({ id: m.id, kind: 'progress', done: files.length, total: files.length, stage: 'zip' });
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    post({ id: m.id, kind: 'done', blob, name: m.zipName, problems, notConverted, count: files.length });
  } catch (e) {
    post({ id: m.id, kind: 'failed', error: (e as Error).message });
  }
};
