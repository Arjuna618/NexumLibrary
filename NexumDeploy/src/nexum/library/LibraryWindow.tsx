import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ContentLibraryIcon, Search, SearchX, X, Check, PanelRightClose, Download, ArrowLeftRight, FileJson, FileScript } from '../../istrong/components/ui/icons';
import { IconButton, SearchEnd, emptyArt } from '../../istrong/components/kit/kit';
import { ThemeSwitch } from '../../istrong/components/kit/ThemeSwitch';
import { SwapText, Fade } from '../../istrong/components/kit/Collapse';
import { InlineMotion } from '../../istrong/components/kit/TagLine';
import { useWindowFrame } from '../../istrong/components/kit/focusScope';
import { useEscapeOwner } from '../../istrong/components/shared/escapeStack';
import { useBackdropClose } from '../../istrong/components/shared/useBackdropClose';
import { gameGridLine } from '../../istrong/components/shared/GameFloor';
import { cmHex, CM, CM_USE } from '../../istrong/utils/colorMap';
import { getMenuScale, usePortalMenuScale, useFitScale } from '../../istrong/utils/useMenuScale';
import { getEffectiveDPR, getEffectiveViewportHeight, getEffectiveViewportWidth } from '../../istrong/utils/zoomCompensation';
import { useToast } from '../../istrong/components/ui/Toast';
import { KINDS, KIND_LABEL, KIND_ONE, itemsOf, itemId, loadManifest, loadMenus, loadEnvelope, type KindId, type LibItem, type Manifest, type ManifestGroup } from './catalog';
import { loadPicture, pictureNow, drawPicture, tickAnimatedColours, isAnimated, type Pic } from './pictures';
import { AddCircle } from './addCircle';
import { classCodeOf, hasClassCode, kindOf, type SourceFile } from '../convert';
import { downloadBlob, downloadText, fileSafe, runJob, type JobProgress } from '../files';

const MARGIN = 28, CLOSE_MS = 120;
function windowSize(): { w: number; h: number } {
  const s = getMenuScale() || 1;
  const w = (getEffectiveViewportWidth() - MARGIN * 2) / s;
  const h = (getEffectiveViewportHeight() - MARGIN * 2) / s;
  return { w: Math.round(Math.max(900, Math.min(1500, w))), h: Math.round(Math.max(560, Math.min(960, h))) };
}

type CardSize = 's' | 'm' | 'l';
const PAD = 18, GAP = 14, TITLE_H = 40, FOOT_H = 58;
const MIN_W: Record<CardSize, number> = { s: 146, m: 178, l: 230 };
const SIZE_KEY = 'nexum_lib_card_size';
const readSize = (): CardSize => { try { const v = localStorage.getItem(SIZE_KEY); return v === 's' || v === 'l' ? v : 'm'; } catch { return 'm'; } };
const storeSize = (s: CardSize) => { try { localStorage.setItem(SIZE_KEY, s); } catch { } };

interface Section { id: string; title: string; items: LibItem[] }
interface Row { kind: 'title' | 'cards'; top: number; h: number; section: number; start: number; count: number }
interface Layout { cols: number; cardW: number; heroH: number; cardH: number; rows: Row[]; contentH: number }

function gridLayout(sections: Section[], vw: number, size: CardSize): Layout {
  const inner = Math.max(120, vw - PAD * 2);
  const cols = Math.max(1, Math.floor((inner + GAP) / (MIN_W[size] + GAP)));
  const cardW = (inner - GAP * (cols - 1)) / cols;
  const heroH = Math.round(cardW * 0.8);
  const cardH = heroH + FOOT_H;
  const rows: Row[] = [];
  let y = PAD;
  sections.forEach((s, si) => {
    if (!s.items.length) return;
    if (s.title) { rows.push({ kind: 'title', top: y, h: TITLE_H, section: si, start: 0, count: 0 }); y += TITLE_H; }
    for (let i = 0; i < s.items.length; i += cols) {
      rows.push({ kind: 'cards', top: y, h: cardH, section: si, start: i, count: Math.min(cols, s.items.length - i) });
      y += cardH + GAP;
    }
    y += GAP;
  });
  return { cols, cardW, heroH, cardH, rows, contentH: Math.max(0, y - GAP * 2 + PAD) };
}

const animated = new Set<() => void>();
let animRaf = 0;
function animLoop() {
  animRaf = 0;
  if (!animated.size) return;
  tickAnimatedColours();
  for (const draw of animated) draw();
  animRaf = requestAnimationFrame(animLoop);
}
function watchAnimated(draw: () => void): () => void {
  animated.add(draw);
  if (!animRaf) animRaf = requestAnimationFrame(animLoop);
  return () => { animated.delete(draw); };
}

const PictureCanvas: React.FC<{ picKey: string; dark: boolean; w: number; h: number; iconFrac: number; onReady?: (ok: boolean) => void }> = ({ picKey, dark, w, h, iconFrac, onReady }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [pics, setPics] = useState<[Pic, Pic] | null | undefined>(() => pictureNow(picKey));
  useEffect(() => {
    let live = true;
    if (pics === undefined) loadPicture(picKey).then((p) => { if (live) setPics(p); });
    return () => { live = false; };
  }, [picKey, pics]);
  useEffect(() => { if (pics !== undefined) onReady?.(!!pics); }, [pics, onReady]);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c || !pics) return;
    const dpr = getEffectiveDPR();
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const pic = pics[dark ? 1 : 0];
    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      drawPicture(ctx, pic, dark, c.width / 2, c.height / 2, Math.min(c.width, c.height) * iconFrac);
    };
    draw();
    return isAnimated(pic) ? watchAnimated(draw) : undefined;
  }, [pics, dark, w, h, iconFrac]);
  return <canvas ref={ref} aria-hidden className="absolute inset-0 w-full h-full" />;
};

const Card: React.FC<{
  it: LibItem; x: number; y: number; w: number; heroH: number; h: number; dark: boolean; floor: string; grid: string;
  selected: boolean; chosen: boolean; badge: string; onSelect: (it: LibItem) => void; onChoose: (it: LibItem) => void;
}> = React.memo(({ it, x, y, w, heroH, h, dark, floor, grid, selected, chosen, badge, onSelect, onChoose }) => {
  const [ready, setReady] = useState(false);
  const cell = Math.max(14, Math.round(w / 9));
  return (
    <div role="gridcell" aria-selected={selected} aria-label={it.e.name} data-ready={ready ? 1 : 0}
      onClick={() => onSelect(it)} onDoubleClick={() => onChoose(it)}
      className="group absolute select-none cursor-pointer" style={{ left: x, top: y, width: w, height: h }}>
      <div className="absolute inset-0 rounded-xl border bg-[var(--k-lib-card-bg)] shadow-[var(--k-card-shadow)] border-[var(--alpha-card-border)]" />
      <div className="absolute inset-0 rounded-xl shadow-[var(--shadow-raise)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />
      <div className="absolute overflow-hidden rounded-t-[11px]" style={{ left: 1, top: 1, right: 1, height: heroH - 1, backgroundColor: floor,
        backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
        backgroundSize: `${cell}px ${cell}px`, backgroundPosition: 'center center' }}>
        <div className="absolute inset-0 skeleton-shimmer transition-opacity duration-200 group-data-[ready=1]:opacity-0" style={{ borderRadius: 0 }} />
        <PictureCanvas picKey={it.pic} dark={dark} w={w - 2} h={heroH - 1} iconFrac={0.62} onReady={setReady} />
        <div aria-hidden={!chosen} className={`absolute left-2.5 bottom-2.5 h-6 w-6 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] grid place-items-center shadow-[var(--shadow-sm)] transition-opacity duration-150 ${chosen ? 'opacity-100' : 'opacity-0'}`}>
          <Check size={14} strokeWidth={3} />
        </div>
      </div>
      <button type="button" onClick={(ev) => { ev.stopPropagation(); onChoose(it); }} onDoubleClick={(ev) => ev.stopPropagation()}
        title={chosen ? 'Unpick' : 'Pick'} aria-label={chosen ? `Unpick ${it.e.name}` : `Pick ${it.e.name}`}
        className={`k-ico absolute right-2 top-2 h-7 w-7 grid place-items-center rounded-md transition-opacity duration-150 text-[var(--text-secondary)] hover:bg-[var(--alpha-hover)] ${chosen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}>
        <AddCircle size={15} />
      </button>
      <div className="absolute left-0 right-0 px-3" style={{ top: heroH + 9 }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] leading-tight truncate text-[var(--text-primary)]">{it.e.name}</span>
        </div>
        {badge && <div className="k-lib-facts k-fade"><span className="k-badge">{badge}</span></div>}
      </div>
      <div className={`absolute inset-0 rounded-xl k-pick-ring pointer-events-none transition-opacity duration-150 ${selected ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
});
Card.displayName = 'NexumLibraryCard';

function badgeOf(it: LibItem): string {
  if (it.kind === 'Shapes' || it.kind === 'Others') return it.e.sub && it.e.sub !== it.e.category ? it.e.sub : '';
  return it.e.category || '';
}

const Grid: React.FC<{
  sections: Section[]; size: CardSize; dark: boolean; selectedId: string | null; chosen: ReadonlySet<string>;
  onSelect: (it: LibItem) => void; onChoose: (it: LibItem) => void; resetKey: string; empty: React.ReactNode;
}> = ({ sections, size, dark, selectedId, chosen, onSelect, onChoose, resetKey, empty }) => {
  const vpRef = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const [top, setTop] = useState(0);
  useLayoutEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => {
      const r = es[0].contentRect;
      setVw((p) => (Math.abs(p - r.width) > 4 ? r.width : p));
      setVh((p) => (Math.abs(p - r.height) > 4 ? r.height : p));
    });
    setVw(el.clientWidth); setVh(el.clientHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => { if (vpRef.current) vpRef.current.scrollTop = 0; setTop(0); }, [resetKey]);
  const raf = useRef(0);
  const onScroll = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => { raf.current = 0; if (vpRef.current) setTop(vpRef.current.scrollTop); });
  }, []);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);
  const L = useMemo(() => gridLayout(sections, vw || 900, size), [sections, vw, size]);
  const floor = cmHex(CM.BACKGROUND, dark, CM_USE.GENERAL);
  const grid = useMemo(() => gameGridLine(dark), [dark]);
  const lo = top - vh * 0.75, hi = top + vh * 1.75;
  const items: React.ReactNode[] = [];
  for (const row of L.rows) {
    if (row.top + row.h < lo || row.top > hi) continue;
    const s = sections[row.section];
    if (row.kind === 'title') {
      items.push(
        <div key={'t@' + s.id} className="absolute flex items-end gap-2 pb-2.5" style={{ left: PAD, right: PAD, top: row.top, height: row.h }}>
          <span className="k-subhead">{s.title}</span>
          <span className="k-count">{s.items.length}</span>
        </div>,
      );
      continue;
    }
    for (let c = 0; c < row.count; c++) {
      const it = s.items[row.start + c];
      const id = itemId(it);
      items.push(<Card key={id + '@' + s.id} it={it} x={PAD + c * (L.cardW + GAP)} y={row.top} w={L.cardW} heroH={L.heroH} h={L.cardH}
        dark={dark} floor={floor} grid={grid} selected={id === selectedId} chosen={chosen.has(id)} badge={badgeOf(it)} onSelect={onSelect} onChoose={onChoose} />);
    }
  }
  return (
    <div ref={vpRef} onScroll={onScroll} role="grid" className="relative flex-1 min-h-0 overflow-y-auto popup-scrollbar">
      {L.rows.length === 0 ? <div className="absolute inset-0 grid place-items-center">{empty}</div>
        : <div className="relative" style={{ height: L.contentH }}>{items}</div>}
    </div>
  );
};

const TagChip: React.FC<{ label: string; on: boolean; onClick: () => void }> = React.memo(({ label, on, onClick }) => (
  <button type="button" onClick={onClick} title={on ? 'Click again to deselect' : `Show only ${label.toLowerCase()}`} aria-pressed={on}
    className={`k-lib-tag${on ? ' k-lib-tag-on' : ''}`}>
    {on && <Check size={12} strokeWidth={2.5} className="-ml-0.5" />}
    <span>{label}</span>
  </button>
));
TagChip.displayName = 'NexumTagChip';

const groupTitle = (g: ManifestGroup) => g.trail.join(' / ');
const tagLabel = (g: ManifestGroup) => (g.trail.length > 1 ? g.trail.slice(1).join(' / ') : g.trail[0]);

const SidePanel: React.FC<{
  it: LibItem; dark: boolean; chosen: boolean; trail: string; onChoose: () => void; onClose: () => void;
  onConvert: () => void; onDownloadFile: () => void; onDownloadCode: () => void;
}> = ({ it, dark, chosen, trail, onChoose, onClose, onConvert, onDownloadFile, onDownloadCode }) => {
  const floor = cmHex(CM.BACKGROUND, dark, CM_USE.GENERAL);
  const grid = gameGridLine(dark);
  const code = it.kind === 'Tanks' || it.kind === 'Turrets' || it.kind === 'Projectiles';
  return (
    <div className="k-lib-panel-box w-[332px] shrink-0 border-l border-[var(--alpha-divider)] bg-[var(--layer-1)] flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 h-[52px] shrink-0">
        <span className="k-subhead truncate">{KIND_LABEL[it.kind]}</span>
        <IconButton label="Close the panel" onClick={onClose}><PanelRightClose size={16} /></IconButton>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto popup-scrollbar px-4 pb-4">
        <div className="relative w-full aspect-[5/4] rounded-xl overflow-hidden border border-[var(--alpha-card-border)]"
          style={{ backgroundColor: floor, backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`, backgroundSize: '30px 30px', backgroundPosition: 'center center' }}>
          <PictureCanvas key={it.pic} picKey={it.pic} dark={dark} w={300} h={240} iconFrac={0.66} />
        </div>
        <div className="mt-4">
          <h3 className="text-[17px] font-medium leading-snug text-[var(--text-primary)] break-words">{it.e.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {trail && <span className="k-badge">{trail}</span>}
            {badgeOf(it) && <span className="k-badge">{badgeOf(it)}</span>}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={onConvert} className="k-btn k-btn-lg w-full k-btn-primary">
            <span className="k-btn-icon"><ArrowLeftRight size={15} /></span><span className="truncate">Open in the converter</span>
          </button>
          <button type="button" onClick={onChoose} className="k-btn k-btn-lg w-full k-btn-secondary">
            <span className="k-btn-icon"><AddCircle size={15} /></span><SwapText className="truncate">{chosen ? 'Unpick' : 'Pick'}</SwapText>
          </button>
          <button type="button" onClick={onDownloadFile} className="k-btn k-btn-lg w-full k-btn-secondary">
            <span className="k-btn-icon"><FileJson size={15} /></span><span className="truncate">Download the iStrong file</span>
          </button>
          {code && (
            <button type="button" onClick={onDownloadCode} className="k-btn k-btn-lg w-full k-btn-secondary">
              <span className="k-btn-icon"><FileScript size={15} /></span><span className="truncate">Download as OSA class code</span>
            </button>
          )}
        </div>
        <div className="mt-5 text-[11px] text-[var(--text-quaternary)] break-all">File: {it.e.file}</div>
      </div>
    </div>
  );
};

export const LibraryWindow: React.FC<{ isDark: boolean; onClose: () => void; onConvert: (files: SourceFile[]) => void }> = ({ isDark, onClose, onConvert }) => {
  const { showToast } = useToast();
  const portalScale = usePortalMenuScale();
  const scrimRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const close = useCallback((after?: unknown) => {
    if (closingRef.current) return;
    closingRef.current = true;
    const a = document.activeElement;
    if (a instanceof HTMLElement && cardRef.current && cardRef.current.contains(a)) a.blur();
    setClosing(true);
    window.setTimeout(typeof after === 'function' ? (after as () => void) : onClose, CLOSE_MS);
  }, [onClose]);
  useWindowFrame({ scrim: scrimRef, card: cardRef, closing });
  useEscapeOwner(close);
  const backdrop = useBackdropClose(close);
  const [size, setSize] = useState(windowSize);
  useEffect(() => {
    let raf = 0;
    const on = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; setSize((p) => { const n = windowSize(); return n.w === p.w && n.h === p.h ? p : n; }); }); };
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const fit = useFitScale(cardRef, portalScale, true);

  const [manifest, setManifest] = useState<Manifest | null | undefined>(undefined);
  useEffect(() => { let live = true; loadManifest().then((m) => { if (live) setManifest(m); }); return () => { live = false; }; }, []);
  const [kind, setKind] = useState<KindId>('Tanks');
  const [query, setQuery] = useState('');
  const [cardSize, setCardSize] = useState<CardSize>(readSize);
  const [tags, setTags] = useState<Record<KindId, Set<string>>>(() => ({ Tanks: new Set(), Turrets: new Set(), Projectiles: new Set(), Shapes: new Set(), Others: new Set() }));
  const [selected, setSelected] = useState<LibItem | null>(null);
  const [chosen, setChosen] = useState<Map<string, LibItem>>(() => new Map());
  const [busy, setBusy] = useState<string | null>(null);

  const all = useMemo(() => {
    const out = {} as Record<KindId, LibItem[]>;
    if (manifest) for (const k of KINDS) out[k] = itemsOf(manifest, k);
    return out;
  }, [manifest]);
  const byKey = useMemo(() => {
    const out = {} as Record<KindId, Map<string, LibItem>>;
    for (const k of KINDS) out[k] = new Map((all[k] ?? []).map((it) => [it.key, it]));
    return out;
  }, [all]);
  const groups = manifest ? manifest.kinds[kind].groups : [];
  const picked = tags[kind];
  const dq = query.trim().toLowerCase();
  const sections = useMemo<Section[]>(() => {
    if (!manifest) return [];
    const map = byKey[kind];
    const shown = picked.size ? groups.filter((g) => picked.has(g.id)) : groups;
    const out: Section[] = [];
    for (const g of shown) {
      const items: LibItem[] = [];
      for (const k of g.keys) {
        const it = map.get(k);
        if (it && (!dq || it.e.name.toLowerCase().includes(dq) || it.key.toLowerCase().includes(dq))) items.push(it);
      }
      if (items.length) out.push({ id: g.id, title: groupTitle(g), items });
    }
    return out;
  }, [manifest, byKey, kind, groups, picked, dq]);
  const resultN = useMemo(() => { const s = new Set<string>(); for (const sec of sections) for (const it of sec.items) s.add(it.key); return s.size; }, [sections]);
  const trailOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) for (const k of g.keys) if (!m.has(k)) m.set(k, groupTitle(g));
    return m;
  }, [groups]);
  const chosenIds = useMemo(() => new Set(chosen.keys()), [chosen]);

  const toggleTag = useCallback((id: string) => setTags((p) => { const n = new Set(p[kind]); if (n.has(id)) n.delete(id); else n.add(id); return { ...p, [kind]: n }; }), [kind]);
  const clearTags = useCallback(() => setTags((p) => ({ ...p, [kind]: new Set() })), [kind]);
  const onSelect = useCallback((it: LibItem) => setSelected(it), []);
  const onChoose = useCallback((it: LibItem) => setChosen((p) => { const n = new Map(p); const id = itemId(it); if (n.has(id)) n.delete(id); else n.set(id, it); return n; }), []);
  const pickShown = useCallback(() => setChosen((p) => { const n = new Map(p); for (const s of sections) for (const it of s.items) n.set(itemId(it), it); return n; }), [sections]);
  const clearPicked = useCallback(() => {
    const before = chosen;
    setChosen(new Map());
    showToast('info', `Unpicked ${before.size} ${before.size === 1 ? 'file' : 'files'}`, { label: 'Undo', run: () => setChosen(before) });
  }, [chosen, showToast]);

  const sourcesOf = (items: LibItem[]): SourceFile[] => items.map((it) => ({
    id: 'lib:' + itemId(it), name: it.e.name, key: it.key, path: it.e.file,
    kind: it.kind === 'Tanks' ? 'Tank' : it.kind === 'Turrets' ? (it.e.type === 'CustomTurret' ? 'Legacy' : 'TurretPreset') : it.kind === 'Projectiles' ? 'CustomProjectile' : it.kind === 'Shapes' ? 'FoodShape' : 'Other',
    group: it.kind === 'Shapes' || it.kind === 'Others' ? it.e.sub || it.e.category : it.e.category,
  }));
  const progressWord = (p: JobProgress) => (p.stage === 'read' ? `Reading ${p.done} of ${p.total}` : p.stage === 'convert' ? 'Converting' : 'Packing');
  const runDownload = useCallback(async (job: 'addon' | 'files', items: LibItem[]) => {
    if (busy || !items.length) return;
    setBusy('Starting');
    try {
      const menus = job === 'addon' ? await loadMenus() : null;
      const r = await runJob(job === 'addon'
        ? { job, files: sourcesOf(items), menus, zipName: 'istrong-osa-addon.zip' }
        : { job, files: sourcesOf(items), zipName: 'istrong-files.zip' }, (p) => setBusy(progressWord(p)));
      downloadBlob(r.name, r.blob);
      const left = r.notConverted.length + r.problems.length;
      showToast(left ? 'info' : 'success', left ? `Downloaded ${r.name}: ${left} ${left === 1 ? 'file' : 'files'} could not be converted (listed in not-converted.txt)` : `Downloaded ${r.name}`);
    } catch (e) {
      showToast('error', (e as Error).message);
    } finally { setBusy(null); }
  }, [busy, showToast]);

  const downloadOne = useCallback(async (it: LibItem, code: boolean) => {
    try {
      const env = await loadEnvelope(it);
      if (!code) { downloadText(`${fileSafe(it.key)}.json`, JSON.stringify(env, null, 2), 'application/json'); return; }
      const k = kindOf(env);
      if (!hasClassCode(k)) { showToast('info', 'This kind of file goes out only in an OSA addon'); return; }
      const c = classCodeOf({ name: it.e.name, key: it.key, envelope: env, kind: k });
      downloadText(`${fileSafe(it.e.name)}.js`, c.text, 'application/javascript');
    } catch (e) { showToast('error', (e as Error).message); }
  }, [showToast]);

  const handOver = useCallback((items: LibItem[]) => { const files = sourcesOf(items); close(() => onConvert(files)); }, [close, onConvert]);

  const onKeyDown = useCallback((ev: React.KeyboardEvent) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
  }, []);

  const activeChips = groups.filter((g) => picked.has(g.id));
  const sideSections = useMemo(() => {
    const out: { head: string; groups: ManifestGroup[] }[] = [];
    for (const g of groups) {
      const head = g.trail.length > 1 ? g.trail[0] : '';
      const last = out[out.length - 1];
      if (last && last.head === head) last.groups.push(g); else out.push({ head, groups: [g] });
    }
    return out;
  }, [groups]);
  const n = chosen.size;
  const one = KIND_ONE[kind];

  const sizeToggle = (
    <div className="k-lib-tabs k-lib-tabs-sm" role="radiogroup" aria-label="Card size">
      {(['s', 'm', 'l'] as CardSize[]).map((sz) => (
        <button key={sz} type="button" role="radio" aria-checked={cardSize === sz} onClick={() => { setCardSize(sz); storeSize(sz); }}
          title={sz === 's' ? 'Small cards' : sz === 'm' ? 'Medium cards' : 'Large cards'} aria-label={sz === 's' ? 'Small cards' : sz === 'm' ? 'Medium cards' : 'Large cards'}
          className={`k-ico k-lib-tab k-lib-tab-icon${cardSize === sz ? ' k-lib-tab-on' : ''}`}>
          <span className="k-ico-art grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${sz === 's' ? 3 : sz === 'm' ? 2 : 1}, 1fr)` }}>
            {Array.from({ length: sz === 's' ? 9 : sz === 'm' ? 4 : 1 }, (_, i) => <span key={i} className="block rounded-[1.5px] bg-current" style={{ width: sz === 's' ? 3 : sz === 'm' ? 5 : 11, height: sz === 's' ? 3 : sz === 'm' ? 5 : 11 }} />)}
          </span>
        </button>
      ))}
    </div>
  );

  const card = (
    <div ref={scrimRef} className={`modal-scrim z-[70] animate-fadeIn ${closing ? 'pointer-events-none' : ''}`} {...backdrop}>
      <div style={{ zoom: fit }} onClick={(e) => e.stopPropagation()}>
        <div ref={cardRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-label="Tank Library"
          className="modal-card k-lib-window flex flex-col outline-none relative animate-scaleUp" style={{ width: size.w, height: size.h }}>
          <div className="k-win-head shrink-0 flex items-center gap-4 pl-5 pr-3 h-[60px]">
            <div className="flex items-center gap-2.5 min-w-0 w-[280px] shrink-0">
              <ContentLibraryIcon size={20} absoluteStrokeWidth className="text-[var(--text-primary)] shrink-0" />
              <h2 className="k-modal-title min-w-0 truncate">Tank Library</h2>
            </div>
            <div className="relative flex-1 max-w-[560px] mx-auto">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--k-search-icon)] pointer-events-none" />
              <input ref={searchRef} type="text" value={query} autoFocus onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); e.stopPropagation(); setQuery(''); } }}
                placeholder={`Search ${KIND_LABEL[kind].toLowerCase()}`}
                className="k-text-in k-search-bar w-full h-9 pl-9 pr-16 rounded-lg text-[13px] bg-[var(--k-search-bg)] border border-[var(--alpha-card-border)] shadow-[var(--shadow-input)] text-[var(--text-primary)] placeholder:text-[var(--k-placeholder)] outline-none" />
              <SearchEnd query={query} onClear={() => { setQuery(''); searchRef.current?.focus(); }} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {sizeToggle}
              <ThemeSwitch />
              <IconButton label="Close" onClick={() => close()}><X size={18} /></IconButton>
            </div>
          </div>
          <div className="k-win-head shrink-0 flex items-center px-5 pb-3 border-b border-[var(--alpha-divider)]">
            <div className="k-lib-tabs" role="tablist">
              {KINDS.map((k) => (
                <button key={k} type="button" role="tab" aria-selected={k === kind} onClick={() => { setKind(k); setSelected(null); }}
                  className={`k-lib-tab${k === kind ? ' k-lib-tab-on' : ''}`}>
                  {KIND_LABEL[k]}
                  <span className="k-lib-count">{manifest ? manifest.kinds[k].count : ''}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex-1 min-h-0 flex">
            <div className="k-lib-side w-[264px] shrink-0 border-r border-[var(--alpha-divider)] overflow-y-auto popup-scrollbar">
              <div className="space-y-5 p-4">
                {sideSections.map((sec, si) => (
                  <div key={sec.head + si}>
                    <div className="flex items-center justify-between h-5">
                      <span className="k-subhead">{sec.head || (si === 0 ? 'Groups' : 'More')}</span>
                      <Fade when={sec.groups.some((g) => picked.has(g.id))}>
                        <button type="button" onClick={() => setTags((p) => { const nn = new Set(p[kind]); for (const g of sec.groups) nn.delete(g.id); return { ...p, [kind]: nn }; })}
                          className="k-btn k-btn-ghost k-lib-btn-xs -mr-2 -my-0.5">Clear</button>
                      </Fade>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sec.groups.map((g) => <TagChip key={g.id} label={tagLabel(g)} on={picked.has(g.id)} onClick={() => toggleTag(g.id)} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="k-lib-content flex-1 min-w-0 flex flex-col">
              <div className="k-lib-results shrink-0 flex items-center gap-2 px-[18px] min-h-[52px] py-2 border-b border-[var(--alpha-divider)]">
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-y-1.5">
                  <span className="text-[12px] text-[var(--text-secondary)] tabular-nums mr-2.5">
                    <SwapText>{manifest ? `${resultN} ${resultN === 1 ? one : KIND_LABEL[kind].toLowerCase()}` : ''}</SwapText>
                  </span>
                  <InlineMotion items={[
                    ...activeChips.map((g) => ({ key: g.id, node: (
                      <span className="k-lib-chip">
                        <span>{tagLabel(g)}</span>
                        <button type="button" onClick={() => toggleTag(g.id)} className="k-chip-x" aria-label={`Remove ${tagLabel(g)}`}><X size={11} /></button>
                      </span>
                    ) })),
                    ...((activeChips.length > 0 || query) ? [{ key: 'clear-all', node: <button type="button" onClick={() => { clearTags(); setQuery(''); }} className="k-btn k-btn-ghost k-lib-btn-xs">Clear all</button> }] : []),
                  ]} />
                </div>
                <button type="button" onClick={pickShown} disabled={!resultN} className="k-btn k-btn-secondary k-btn-md shrink-0">
                  <span className="k-btn-icon"><AddCircle size={13} /></span><span className="truncate">Pick all shown</span>
                </button>
              </div>
              {manifest === null ? (
                <div className="flex-1 grid place-items-center text-center px-6">
                  <div className="text-[13px] text-[var(--text-secondary)]">The library could not be loaded. Check the connection and open it again.</div>
                </div>
              ) : (
                <Grid sections={sections} size={cardSize} dark={isDark} selectedId={selected ? itemId(selected) : null} chosen={chosenIds}
                  onSelect={onSelect} onChoose={onChoose} resetKey={kind + '|' + dq + '|' + [...picked].join(',')}
                  empty={manifest ? <div className="text-center"><span className="flex justify-center text-[var(--text-primary)]">{emptyArt(SearchX)}</span>
                    <div className="sr-only">Nothing matches.</div>
                    {(activeChips.length > 0 || query) && <button type="button" onClick={() => { clearTags(); setQuery(''); }} className="k-btn k-btn-secondary k-btn-md mt-4">Clear all</button>}</div> : null} />
              )}
            </div>

            {selected && (
              <div className="absolute top-0 bottom-0 right-0 z-[4] overflow-hidden pointer-events-none flex justify-end" style={{ width: 356 }}>
                <div className="k-lib-panel pointer-events-auto flex k-lib-panel-in">
                  <SidePanel key={itemId(selected)} it={selected} dark={isDark} chosen={chosenIds.has(itemId(selected))} trail={trailOf.get(selected.key) ?? ''}
                    onChoose={() => onChoose(selected)} onClose={() => setSelected(null)} onConvert={() => handOver([selected])}
                    onDownloadFile={() => downloadOne(selected, false)} onDownloadCode={() => downloadOne(selected, true)} />
                </div>
              </div>
            )}
          </div>

          <div className="k-pop-foot shrink-0 border-t border-[var(--alpha-divider)] bg-[var(--k-content)]">
            <div className="k-bar bg-[var(--k-foot-bg)] flex items-center gap-2 px-4 h-[56px]">
              <span className="text-[12px] text-[var(--text-secondary)] tabular-nums"><SwapText>{busy ?? (n ? `${n} picked` : 'Pick files to convert or download them')}</SwapText></span>
              <Fade when={n > 0 && !busy}><button type="button" onClick={clearPicked} className="k-btn k-btn-ghost k-btn-md">Unpick all</button></Fade>
              <div className="flex-1" />
              <button type="button" disabled={!n || !!busy} onClick={() => runDownload('files', [...chosen.values()])} className="k-btn k-btn-secondary k-btn-md">
                <span className="k-btn-icon"><Download size={14} /></span><span className="truncate">Download files</span>
              </button>
              <button type="button" disabled={!n || !!busy} onClick={() => runDownload('addon', [...chosen.values()])} className="k-btn k-btn-secondary k-btn-md">
                <span className="k-btn-icon"><Download size={14} /></span><span className="truncate">Download OSA addon</span>
              </button>
              <button type="button" disabled={!n || !!busy} onClick={() => handOver([...chosen.values()])} className="k-btn k-btn-primary k-btn-md">
                <span className="k-btn-icon"><ArrowLeftRight size={14} /></span><span className="truncate">Open in the converter</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  return createPortal(card, document.body);
};
