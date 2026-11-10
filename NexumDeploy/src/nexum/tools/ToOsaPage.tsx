import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, PickRow, Segmented, Button, IconButton, EmptyState, emptyArt, headerIcon } from '../../istrong/components/kit/kit';
import { DropZone } from '../../istrong/components/kit/DropZone';
import { LongList } from '../../istrong/components/kit/LongList';
import { CodeView } from '../../istrong/components/source/CodeView';
import { useToast } from '../../istrong/components/ui/Toast';
import { Upload, FolderOpen, ContentLibraryIcon, X, Download, Trash2, FileScript, HdFileManagement, HdInboxDownload } from '../../istrong/components/ui/icons';
import { classCodeOf, hasClassCode, kindOf, KIND_WORD, readIstrongFiles, filesOfDrop, type SourceFile } from '../convert';
import { loadMenus } from '../library/catalog';
import { downloadBlob, downloadText, fileSafe, runJob } from '../files';

type Output = 'addon' | 'code';
const NO_STEP = { seq: 0, delta: 0 };
const noFind = () => {};

async function envelopeOf(f: SourceFile): Promise<any> {
  if (f.envelope !== undefined) return f.envelope;
  const r = await fetch('/prebuilt/library/' + f.path!.split('/').map(encodeURIComponent).join('/'));
  if (!r.ok) throw new Error(`${f.name}: could not be loaded`);
  return r.json();
}

export const ToOsaPage: React.FC<{ handed: { files: SourceFile[]; at: number } | null; onLibrary: () => void }> = ({ handed, onLibrary }) => {
  const { showToast } = useToast();
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [output, setOutput] = useState<Output>('addon');
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; text: string; notes: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const add = useCallback((more: SourceFile[], from: string) => {
    if (!more.length) return;
    setFiles((p) => { const have = new Set(p.map((f) => f.id)); return [...p, ...more.filter((f) => !have.has(f.id))]; });
    setPickedId((id) => id ?? more[0].id);
    showToast('success', `Added ${more.length} ${more.length === 1 ? 'file' : 'files'} ${from}`);
  }, [showToast]);
  const lastHanded = useRef(0);
  useEffect(() => { if (handed && handed.at !== lastHanded.current) { lastHanded.current = handed.at; add(handed.files, 'from the library'); } }, [handed, add]);

  const read = useCallback(async (list: (File | { file: File; path: string })[]) => {
    const r = await readIstrongFiles(list);
    add(r.files, '');
    if (r.errors.length) showToast('info', r.errors.length === 1 ? r.errors[0] : `${r.errors.length} files were not iStrong files and were left out`);
  }, [add, showToast]);
  const onDrop = useCallback((dt: DataTransfer) => { filesOfDrop(dt).then(read); }, [read]);

  const remove = useCallback((f: SourceFile) => {
    const before = files;
    setFiles(files.filter((x) => x.id !== f.id));
    if (pickedId === f.id) setPickedId(null);
    showToast('info', `Removed ${f.name}`, { label: 'Undo', run: () => setFiles(before) });
  }, [files, pickedId, showToast]);
  const removeAll = useCallback(() => {
    const before = files;
    setFiles([]); setPickedId(null);
    showToast('info', `Removed ${before.length} files`, { label: 'Undo', run: () => setFiles(before) });
  }, [files, showToast]);

  const picked = useMemo(() => files.find((f) => f.id === pickedId) ?? null, [files, pickedId]);
  useEffect(() => {
    if (!picked) { setPreview(null); return; }
    let live = true;
    envelopeOf(picked).then((env) => {
      if (!live) return;
      const kind = kindOf(env);
      if (!hasClassCode(kind)) {
        setPreview({ id: picked.id, text: '', notes: [`A ${KIND_WORD[kind].toLowerCase()} goes out only in an OSA addon (its look is built there).`] });
        return;
      }
      const c = classCodeOf({ name: picked.name, key: picked.key, envelope: env, kind });
      setPreview({ id: picked.id, text: c.text, notes: c.warnings.filter((w) => w.severity !== 'info').map((w) => w.message) });
    }).catch((e) => { if (live) setPreview({ id: picked.id, text: '', notes: [(e as Error).message] }); });
    return () => { live = false; };
  }, [picked]);

  const download = useCallback(async () => {
    if (!files.length || busy) return;
    if (output === 'code' && files.length === 1 && preview?.id === files[0].id && preview.text) {
      downloadText(`${fileSafe(files[0].name)}.js`, preview.text, 'application/javascript');
      return;
    }
    setBusy('Starting');
    try {
      const menus = output === 'addon' ? await loadMenus() : null;
      const r = await runJob(output === 'addon'
        ? { job: 'addon', files, menus, zipName: 'istrong-osa-addon.zip' }
        : { job: 'code', files, zipName: 'istrong-class-code.zip' },
      (p) => setBusy(p.stage === 'read' ? `Reading ${p.done} of ${p.total}` : p.stage === 'convert' ? 'Converting' : 'Packing'));
      downloadBlob(r.name, r.blob);
      const left = r.notConverted.length + r.problems.length;
      showToast(left ? 'info' : 'success', left ? `Downloaded ${r.name}: ${left} ${left === 1 ? 'file' : 'files'} could not be converted` : `Downloaded ${r.name}`);
    } catch (e) { showToast('error', (e as Error).message); } finally { setBusy(null); }
  }, [files, busy, output, preview, showToast]);

  const inputs = (
    <>
      <input ref={fileRef} type="file" accept=".json,.zip" multiple className="hidden" onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; read(l); }} />
      <input ref={folderRef} type="file" multiple className="hidden" {...({ webkitdirectory: '', directory: '' } as any)}
        onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; read(l); }} />
    </>
  );

  return (
    <div className="absolute inset-0 flex min-h-0">
      {inputs}
      <DropZone enabled={!busy} onDrop={onDrop} className="w-[380px] shrink-0 border-r border-[var(--alpha-divider)] flex flex-col min-h-0"
        label="Release files here" sub="iStrong files (.json), a folder or a .zip">
        <div className="flex items-center gap-1.5 px-4 h-12 shrink-0 border-b border-[var(--alpha-divider)]">
          <span className="k-subhead flex-1">Files <span className="k-count">{files.length}</span></span>
          <IconButton label="Add files" onClick={() => fileRef.current?.click()}><Upload size={16} /></IconButton>
          <IconButton label="Add a folder" onClick={() => folderRef.current?.click()}><FolderOpen size={16} /></IconButton>
          <IconButton label="Pick from the Tank Library" onClick={onLibrary}><ContentLibraryIcon size={16} /></IconButton>
          <IconButton label="Remove every file" onClick={removeAll} disabled={!files.length}><Trash2 size={16} /></IconButton>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto popup-scrollbar p-3">
          {files.length === 0 ? (
            <div className="h-full grid place-items-center text-center">
              <div>
                <EmptyState icon={emptyArt(HdFileManagement)} title="No files yet" hint="Drop iStrong files here, add them, or pick them from the Tank Library." words />
                <div className="mt-4 flex justify-center gap-2">
                  <Button variant="primary" icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>Add files</Button>
                  <Button icon={<ContentLibraryIcon size={14} />} onClick={onLibrary}>Tank Library</Button>
                </div>
              </div>
            </div>
          ) : (
            <LongList count={files.length} rowKey={(i) => files[i].id} gap={6} estimate={52}
              renderRow={(i) => {
                const f = files[i];
                return <PickRow title={f.name} selected={f.id === pickedId} onPick={() => setPickedId(f.id)} facts={[{ key: 'k', text: KIND_WORD[f.kind] }]}
                  actions={<IconButton label={`Remove ${f.name}`} onClick={() => remove(f)}><X size={14} /></IconButton>} />;
              }} />
          )}
        </div>
      </DropZone>
      <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto popup-scrollbar p-4 space-y-3">
        <Group title="Output" icon={headerIcon(HdInboxDownload)}>
          <Segmented<Output> block value={output} onChange={setOutput} options={[
            { value: 'addon', label: 'OSA addon', title: 'A folder for server\\lib\\definitions\\entityAddons, with a menu to become every file' },
            { value: 'code', label: 'Class code', title: 'Plain Class definitions, one .js file a tank, turret or projectile' },
          ]} />
          <p className="k-row-desc mt-3">
            {output === 'addon'
              ? 'Unzip it into your Open Source Arras folder at server\\lib\\definitions\\entityAddons. Every tank, turret, projectile, food shape and Other is then in the developer menu, on the iStrong page.'
              : 'Each tank, turret or projectile as Class code you can paste into a definitions file of Open Source Arras. Food shapes and Others need the OSA addon.'}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Button variant="primary" icon={<Download size={14} />} disabled={!files.length || !!busy} onClick={download}>
              {busy ?? (files.length > 1 || output === 'addon' ? 'Download .zip' : 'Download .js')}
            </Button>
            <span className="text-[12px] text-[var(--text-tertiary)]">{files.length ? `${files.length} ${files.length === 1 ? 'file' : 'files'}` : 'Add files first'}</span>
          </div>
        </Group>
        <Group title={picked ? picked.name : 'Preview'} icon={headerIcon(FileScript)}>
          {!picked ? <p className="k-row-desc">Pick a file to see its class code.</p> : (
            <>
              {preview && preview.id === picked.id && preview.notes.length > 0 && (
                <div className="mb-3 space-y-1">{preview.notes.slice(0, 12).map((n, i) => <p key={i} className="k-row-desc">{n}</p>)}</div>
              )}
              {preview && preview.id === picked.id && preview.text && (
                <div className="h-[460px] rounded-lg border border-[var(--alpha-card-border)] overflow-hidden relative">
                  <CodeView text={preview.text} lang="js" find="" step={NO_STEP} onFind={noFind} goLine={null} />
                </div>
              )}
            </>
          )}
        </Group>
      </div>
    </div>
  );
};
