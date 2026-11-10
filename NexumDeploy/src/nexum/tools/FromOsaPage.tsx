import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildRegistryFromJson, parseArrasUserCode, convertArrasClassToExport, classifyEntity, WarningCollector, type Registry } from 'nexum-library';
import { Group, PickRow, Button, IconButton, EmptyState, emptyArt, headerIcon } from '../../istrong/components/kit/kit';
import { DropZone } from '../../istrong/components/kit/DropZone';
import { LongList } from '../../istrong/components/kit/LongList';
import { CodeView } from '../../istrong/components/source/CodeView';
import { useToast } from '../../istrong/components/ui/Toast';
import { Upload, Download, FileScript, FileJson, X, HdFileManagement } from '../../istrong/components/ui/icons';
import { downloadText, downloadZip, fileSafe } from '../files';
import { filesOfDrop } from '../convert';

interface Found { name: string; label: string; kind: string; envelope: any | null; json: string; notes: string[] }
const KIND: Record<string, string> = { tank: 'Tank', boss: 'Boss', projectile: 'Projectile', turret: 'Turret', other: 'Other' };
const NO_STEP = { seq: 0, delta: 0 };
const noFind = () => {};

let baseP: Promise<{ registry: Registry; gunvals: any; helpers: any }> | null = null;
function loadBase() {
  if (!baseP) {
    baseP = Promise.all(['osa-registry', 'osa-gunvals', 'osa-helpers'].map((n) => fetch(`/prebuilt/${n}.json`).then((r) => { if (!r.ok) throw new Error('The OSA definitions could not be loaded'); return r.json(); })))
      .then(([reg, gunvals, helpers]) => ({ registry: buildRegistryFromJson(reg), gunvals, helpers }));
    baseP.catch(() => { baseP = null; });
  }
  return baseP;
}

function topClasses(names: string[], registry: Registry): string[] {
  const set = new Set(names);
  const objs = new Map<any, string>();
  for (const n of names) objs.set(registry.get(n), n);
  const used = new Set<string>();
  const seen = new Set<any>();
  const walk = (v: any, self: string, depth: number) => {
    if (v == null || depth > 12) return;
    if (typeof v === 'string') { if (v !== self && set.has(v)) used.add(v); return; }
    if (typeof v !== 'object') return;
    const o = objs.get(v);
    if (o && o !== self && depth > 0) { used.add(o); return; }
    if (seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) walk(x, self, depth + 1); return; }
    for (const k of Object.keys(v)) if (k !== 'PARENT' && k !== '_className') walk(v[k], self, depth + 1);
  };
  for (const n of names) { seen.clear(); walk(registry.get(n), n, 0); }
  return names.filter((n) => !used.has(n));
}

export const FromOsaPage: React.FC = () => {
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  const [hidden, setHidden] = useState(0);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { loadBase().catch(() => {}); }, []);

  const convert = useCallback(async (text: string, packClasses?: Record<string, any>) => {
    setBusy(true);
    try {
      const base = await loadBase();
      let registry: Registry, names: string[];
      if (packClasses) {
        registry = new Map(base.registry);
        names = [];
        for (const [n, d] of Object.entries(packClasses)) { registry.set(n, { ...(d as any), _className: n }); names.push(n); }
      } else {
        const r = parseArrasUserCode(text, base.registry, base.gunvals, base.helpers);
        if (r.errors.length) { showToast('error', r.errors[0]); return; }
        registry = r.registry; names = r.newClassNames;
      }
      if (!names.length) { showToast('info', 'No new Class definitions were found. The code must set Class.name = { ... }'); return; }
      const tops = topClasses(names, registry);
      const out: Found[] = [];
      for (const n of tops) {
        const warn = new WarningCollector();
        const def: any = registry.get(n);
        try {
          const envelope = convertArrasClassToExport(n, registry, warn);
          out.push({ name: n, label: (def?.LABEL as string) || n, kind: KIND[classifyEntity(n, registry)] ?? 'Tank', envelope, json: JSON.stringify(envelope, null, 2), notes: warn.list().filter((w: any) => w.severity !== 'info').map((w: any) => w.message) });
        } catch (e) {
          out.push({ name: n, label: (def?.LABEL as string) || n, kind: 'Not converted', envelope: null, json: '', notes: [(e as Error).message] });
        }
      }
      setFound(out); setHidden(names.length - tops.length); setPickedName(out[0]?.name ?? null);
      showToast('success', `Found ${out.length} ${out.length === 1 ? 'class' : 'classes'}`);
    } catch (e) { showToast('error', (e as Error).message); } finally { setBusy(false); }
  }, [showToast]);

  const readFiles = useCallback(async (list: (File | { file: File; path: string })[]) => {
    const texts: string[] = [];
    let pack: Record<string, any> | null = null;
    for (const it of list) {
      const file = it instanceof File ? it : it.file;
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.zip')) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        for (const [p, e] of Object.entries(zip.files)) {
          const en = e as any;
          if (en.dir) continue;
          if (p.toLowerCase().endsWith('.js') && !p.toLowerCase().endsWith('istrong/istrong.js')) texts.push(await en.async('string'));
          else if (p.toLowerCase().endsWith('istrong.json')) { try { pack = { ...(pack ?? {}), ...JSON.parse(await en.async('string')).classes }; } catch { } }
        }
      } else if (lower.endsWith('.js')) texts.push(await file.text());
      else if (lower.endsWith('.json')) { try { const j = JSON.parse(await file.text()); if (j && j.classes) pack = { ...(pack ?? {}), ...j.classes }; } catch { } }
    }
    if (pack) { convert('', pack); return; }
    if (!texts.length) { showToast('info', 'No OSA code was found in those files (.js, a .zip of them, or an iStrong OSA addon)'); return; }
    const joined = texts.join('\n\n');
    setCode(joined);
    convert(joined);
  }, [convert, showToast]);
  const onDrop = useCallback((dt: DataTransfer) => { filesOfDrop(dt).then(readFiles); }, [readFiles]);

  const picked = useMemo(() => found.find((f) => f.name === pickedName) ?? null, [found, pickedName]);
  const good = found.filter((f) => f.envelope);
  const downloadAll = useCallback(() => {
    if (good.length === 1) { downloadText(`${fileSafe(good[0].label)}.json`, good[0].json, 'application/json'); return; }
    const used = new Set<string>();
    downloadZip('istrong-files.zip', good.map((f) => {
      let n = fileSafe(f.label), k = 2;
      while (used.has(n.toLowerCase())) n = `${fileSafe(f.label)} ${k++}`;
      used.add(n.toLowerCase());
      return { name: `${n}.json`, content: f.json };
    })).catch((e) => showToast('error', (e as Error).message));
  }, [good, showToast]);

  return (
    <div className="absolute inset-0 flex min-h-0">
      <input ref={fileRef} type="file" accept=".js,.json,.zip" multiple className="hidden" onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; readFiles(l); }} />
      <DropZone enabled={!busy} onDrop={onDrop} className="w-[420px] shrink-0 border-r border-[var(--alpha-divider)] flex flex-col min-h-0 p-4 gap-3"
        label="Release files here" sub="OSA code (.js), a .zip of it, or an iStrong OSA addon">
        <div className="flex items-center gap-2">
          <span className="k-subhead flex-1">OSA code</span>
          <Button size="sm" icon={<Upload size={13} />} onClick={() => fileRef.current?.click()}>Open files</Button>
        </div>
        <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false}
          placeholder={'Paste Class code of Open Source Arras here, for example:\n\nClass.myTank = {\n    PARENT: "genericTank",\n    LABEL: "My Tank",\n    GUNS: [{\n        POSITION: [18, 8, 1, 0, 0, 0, 0],\n        PROPERTIES: { SHOOT_SETTINGS: combineStats([g.basic]), TYPE: "bullet" },\n    }],\n};'}
          className="k-field flex-1 min-h-0 resize-none font-mono text-[12px] leading-[1.5] p-3" />
        <Button variant="primary" block disabled={!code.trim() || busy} onClick={() => convert(code)}>{busy ? 'Converting' : 'Convert'}</Button>
      </DropZone>
      <div className="flex-1 min-w-0 flex min-h-0">
        <div className="w-[300px] shrink-0 border-r border-[var(--alpha-divider)] flex flex-col min-h-0">
          <div className="flex items-center gap-1.5 px-4 h-12 shrink-0 border-b border-[var(--alpha-divider)]">
            <span className="k-subhead flex-1">Classes <span className="k-count">{found.length}</span></span>
            <IconButton label="Download every converted file" onClick={downloadAll} disabled={!good.length}><Download size={16} /></IconButton>
            <IconButton label="Clear the list" onClick={() => { setFound([]); setPickedName(null); }} disabled={!found.length}><X size={16} /></IconButton>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto popup-scrollbar p-3">
            {found.length === 0 ? <div className="h-full grid place-items-center"><EmptyState icon={emptyArt(HdFileManagement)} title="Nothing converted yet" /></div> : (
              <LongList count={found.length} rowKey={(i) => found[i].name} gap={6} estimate={52}
                renderRow={(i) => { const f = found[i]; return <PickRow title={f.label} selected={f.name === pickedName} onPick={() => setPickedName(f.name)} facts={[{ key: 'k', text: f.kind }]} />; }} />
            )}
            {hidden > 0 && <p className="k-row-desc mt-3">{hidden} more {hidden === 1 ? 'class is' : 'classes are'} part of the ones above (bullets, layers, auto turrets).</p>}
          </div>
        </div>
        <div className="flex-1 min-w-0 overflow-y-auto popup-scrollbar p-4 space-y-3">
          <Group title={picked ? picked.label : 'iStrong file'} icon={headerIcon(FileJson)}
            right={picked?.envelope ? <Button size="sm" icon={<Download size={13} />} onClick={() => downloadText(`${fileSafe(picked.label)}.json`, picked.json, 'application/json')}>Download</Button> : undefined}>
            {!picked ? <p className="k-row-desc">Convert some code, then pick a class to see its iStrong file.</p> : (
              <>
                {picked.notes.length > 0 && <div className="mb-3 space-y-1">{picked.notes.slice(0, 12).map((n, i) => <p key={i} className="k-row-desc">{n}</p>)}</div>}
                {picked.json && <div className="h-[520px] rounded-lg border border-[var(--alpha-card-border)] overflow-hidden relative"><CodeView text={picked.json} lang="json" find="" step={NO_STEP} onFind={noFind} goLine={null} /></div>}
              </>
            )}
          </Group>
          <p className="k-row-desc flex items-center gap-1.5"><FileScript size={13} /> Open the file in iStrong with Import in the Content Library.</p>
        </div>
      </div>
    </div>
  );
};
