import { buildReverseResult } from '../reverse/classEmitter.js';
import { convertPresetToArras, convertProjectileToArras } from '../reverse/index.js';
import { designClasses, partShape } from '../reverse/designInverter.js';
import { WALL_SEE_THROUGH, EYE_ID, EYE_DRAWN_RADIUS } from './gameTables.js';

export interface PackFile { key: string; envelope: any }
export interface PackGroupedFile extends PackFile { group: string }
export interface GameMenus {
  fileOfKey: Record<string, string>;
  tree: Record<string, { layoutTier?: number; upgrades: string[] }[]>;
  menuLabels: Record<string, string>;
  pageCardLabels: Record<string, string>;
  menuColorIdx?: Record<string, number>;
  listColours?: string[];
  treeRootOf?: Record<string, string>;
}
export interface OsaShapeEntry { name: string; label: string; recipe: any; body: Record<string, number>; value: number; size: number | null }
export interface OsaMenu { label: string; items: string[]; color?: number }
export interface OsaPack {
  classes: Record<string, any>;
  shapes: OsaShapeEntry[];
  menus: Record<string, OsaMenu>;
  fileClass: Record<string, string>;
  problems: string[];
  notConverted: string[];
  warnings: number;
  unlisted: number;
}

export const packClassName = (k: string): string => 'istrong_' + k.replace(/[^A-Za-z0-9_]/g, '_');
const stripSideChannel = (v: any): any => {
  if (Array.isArray(v)) return v.map(stripSideChannel);
  if (v && typeof v === 'object') {
    const o: any = {};
    for (const k of Object.keys(v)) if (!k.startsWith('_iStrong')) o[k] = stripSideChannel(v[k]);
    return o;
  }
  return v;
};

const POLYS = ['egg', 'square', 'triangle', 'pentagon', 'hexagon'];
const SHINY = ['', 'shiny', 'legendary', 'shadow', 'rainbow', 'trans'];
const LEVEL = ['', 'beta', 'alpha', 'omega', 'gamma', 'delta'];
const OD: Record<string, string> = { hexagon: 'hexagon_old', septagon: 'septagon', octagon: 'octagon', nonagon: 'nonagon' };
const GEM: Record<string, string> = { none: '', Amethyst: 'Power', Sapphire: 'Space', Ruby: 'Reality', Topaz: 'Soul', Emerald: 'Time', Citrine: 'Mind' };
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export function shapeRecipe(d: any): any | null {
  const key: string | undefined = d.arras?.key;
  if (key && key.startsWith('relic|')) {
    const [, base, gem] = key.split('|');
    return GEM[gem!] === undefined ? null : { cls: `${GEM[gem!]}${cap(base!)}Relic` };
  }
  const words = String(d.name).replace(/\(Scaled\)/, '').trim().split(/\s+/).map(w => w.toLowerCase());
  const shiny = Math.max(0, SHINY.indexOf(words[0] ?? ''));
  const rest = shiny ? words.slice(1) : words;
  const crasher = rest[0] === 'crasher';
  const body = crasher ? rest.slice(1) : rest;
  if (body.join(' ') === 'mega crasher' || (crasher && body[0] === 'mega')) return { crasher: { cls: 'crasher' } };
  if (body[0] === 'od' && OD[body[1] ?? '']) return shiny ? { rare: { cls: OD[body[1]!] }, level: shiny - 1 } : { cls: OD[body[1]!] };
  const level = body.length > 1 ? LEVEL.indexOf(body[0]!) : 0;
  const poly = POLYS.indexOf(body[body.length - 1]!);
  if (poly < 0 || level < 0) return d.correspondsTo ? { cls: d.correspondsTo } : null;
  const food = (SHINY[shiny]! + cap(POLYS[poly]!)).replace(/^./, c => c.toLowerCase());
  let r: any;
  if (level === 0) r = { cls: food };
  else if (level <= 3) r = { cls: `laby_${poly}_${level}_${shiny}_0` };
  else r = { laby: [food, poly, shiny, level] };
  if (crasher) return level === 0 && poly === 2 && shiny === 0 ? { cls: 'crasher' } : level === 0 ? { cls: `laby_${poly}_0_${shiny}_1` } : { crasher: r };
  if (d.correspondsTo && level === 0 && !shiny) return { cls: d.correspondsTo, or: r };
  return r;
}

export function shapeEntry(group: string, key: string, d: any): OsaShapeEntry | null {
  const recipe = shapeRecipe(d);
  if (!recipe) return null;
  const body: Record<string, number> = { HEALTH: d.hp / 2, SHIELD: (d.shield ?? 0) / 2 };
  if (typeof d.hitOnRounds === 'number') body.DAMAGE = d.hitOnRounds;
  return { name: packClassName('shape_' + group + '_' + key), label: d.name, recipe, body, value: d.xpValue, size: d.arras?.baseSize ?? null };
}

export function otherClasses(d: any, name: string): { classes: Record<string, any>; skipped: string[] } | null {
  const b = d.body;
  if (!b || partShape(b, 0) === null) return null;
  const made = designClasses(b, name);
  const classes: Record<string, any> = {};
  for (const p of made.parts) { const { className, ...def } = p as any; classes[className] = def; }
  const { className: _root, INDEPENDENT: _ind, MIRROR_MASTER_ANGLE: _mir, ...root } = made.root as any;
  const drawnRadius = d.otherId === EYE_ID ? EYE_DRAWN_RADIUS : ((b.radius ?? 1) * (d.size ?? 20)) / 2;
  classes[name] = {
    PARENT: 'genericTank', LABEL: d.name, ...root,
    SIZE: +(drawnRadius / (1 + 97 / 96)).toFixed(4), GUNS: [], TURRETS: root.TURRETS ?? [],
  };
  const alpha = WALL_SEE_THROUGH[d.name];
  if (alpha !== undefined) classes[name].ALPHA = alpha;
  return { classes, skipped: made.skipped };
}

export interface PackInput {
  tanks: PackFile[];
  shapes?: PackGroupedFile[];
  others?: PackGroupedFile[];
  presets?: PackGroupedFile[];
  projectiles?: PackGroupedFile[];
  menus?: GameMenus | null;
}

export function buildOsaPack(input: PackInput): OsaPack {
  const classes: Record<string, any> = {};
  const fileClass: Record<string, string> = {};
  const keysOfName: Record<string, string[]> = {};
  const tapWords = new Set<string>();
  const problems: string[] = [];
  const notConverted: string[] = [];
  let warnings = 0;
  const collectTaps = (v: any) => {
    if (Array.isArray(v)) { for (const x of v) collectTaps(x); return; }
    if (!v || typeof v !== 'object') return;
    if (typeof v.tankAsProjectile === 'string' && v.tankAsProjectile) tapWords.add(v.tankAsProjectile);
    for (const k of Object.keys(v)) collectTaps(v[k]);
  };
  for (const { key, envelope: env } of input.tanks) {
    if (typeof env.name === 'string') (keysOfName[env.name] ??= []).push(key);
    collectTaps(env.data);
    const name = packClassName(key);
    try {
      const r = buildReverseResult(env, { className: name });
      for (const c of [r.primary, ...r.dependencies]) {
        const { className, ...def } = c as any;
        if (classes[className]) { problems.push(`${key}: a second class named ${className}`); continue; }
        classes[className] = stripSideChannel(def);
      }
      warnings += r.warnings.length;
      for (const w of r.warnings) if (w.severity === 'error') problems.push(`${key}: ${(w as any).message}`);
      fileClass[key] = name;
    } catch (e: any) { problems.push(`${key}: the reverse threw (${e.message})`); }
  }

  const pages: Record<string, { label: string; groups: Record<string, string[]> }> = {
    shapes: { label: 'Food Shapes', groups: {} }, others: { label: 'Others', groups: {} },
  };
  const onPage = (page: string, group: string, name: string) => { (pages[page]!.groups[group] ??= []).push(name); };
  const viewers = (list: PackGroupedFile[] | undefined, page: string, label: string, prefix: string, convert: (e: any, o: { className: string }) => ReturnType<typeof convertPresetToArras>) => {
    if (!list?.length) return;
    pages[page] = { label, groups: {} };
    for (const { group, key, envelope } of list) {
      const name = packClassName(prefix + key);
      try {
        const r = convert(envelope, { className: name });
        for (const c of [r.primary, ...r.dependencies]) {
          const { className, ...def } = c as any;
          if (classes[className]) { problems.push(`${key}: a second class named ${className}`); continue; }
          classes[className] = stripSideChannel(def);
        }
        warnings += r.warnings.length;
        for (const w of r.warnings) if (w.severity === 'error') problems.push(`${key}: ${w.message}`);
        onPage(page, group, name);
      } catch (e: any) { problems.push(`${key}: the reverse threw (${e.message})`); }
    }
  };
  viewers(input.presets, 'turrets', 'Turrets', 'turret_', convertPresetToArras);
  viewers(input.projectiles, 'projectiles', 'Projectiles', 'projectile_', convertProjectileToArras);
  const shapes: OsaShapeEntry[] = [];
  for (const { group, key, envelope } of input.shapes ?? []) {
    const entry = shapeEntry(group, key, envelope.data);
    if (!entry) { notConverted.push(`Shapes/${group}/${key}.json: OSA has no shape it is`); continue; }
    shapes.push(entry);
    onPage('shapes', group, entry.name + 'Generator');
  }
  for (const { group, key, envelope } of input.others ?? []) {
    const name = packClassName('other_' + group + '_' + key);
    const made = otherClasses(envelope.data, name);
    if (!made) { notConverted.push(`Others/${group}/${key}.json: a body OSA cannot draw`); continue; }
    for (const s of made.skipped) notConverted.push(`Others/${group}/${key}.json: ${s} not drawn`);
    Object.assign(classes, made.classes);
    onPage('others', group, name);
  }

  const tapClass: Record<string, string> = {};
  for (const w of tapWords) {
    if (/^sentry(Gun|Swarm|Trap)$/.test(w)) continue;
    const byName = keysOfName[w] ?? [];
    if (byName.length > 1) problems.push(`Tank as Projectile "${w}" names ${byName.length} files (${byName.join(', ')}): the first is used`);
    const key = byName[0] ?? (fileClass[w] ? w : null);
    if (key && fileClass[key]) tapClass[w] = fileClass[key];
    else problems.push(`Tank as Projectile "${w}" finds no file`);
  }
  for (const def of Object.values(classes)) {
    for (const g of def.GUNS ?? []) {
      const p = g.PROPERTIES;
      if (!p || !p.INDEPENDENT_CHILDREN) continue;
      if (typeof p.TYPE === 'string' && tapClass[p.TYPE]) p.TYPE = tapClass[p.TYPE];
      else if (Array.isArray(p.TYPE) && typeof p.TYPE[0] === 'string' && tapClass[p.TYPE[0]]) p.TYPE = [tapClass[p.TYPE[0]], ...p.TYPE.slice(1)];
    }
  }

  const menus: GameMenus = input.menus ?? { fileOfKey: {}, tree: { developer: [] }, menuLabels: {}, pageCardLabels: {} };
  const menuClass = (k: string) => 'istrong_menu_' + k.replace(/^menu_/, '').replace(/[^A-Za-z0-9_]/g, '_');
  const isMenu = (k: string) => k === 'developer' || k.startsWith('menu_');
  const keyClass: Record<string, string> = {};
  for (const [k, f] of Object.entries(menus.fileOfKey)) {
    if (!fileClass[f]) continue;
    if (k === f) { keyClass[k] = fileClass[f]; continue; }
    const alias = packClassName(k);
    if (!classes[alias]) classes[alias] = { PARENT: fileClass[f], RESET_UPGRADE_MENU: true };
    keyClass[k] = alias;
  }
  const refOf = (k: string): string | null => (isMenu(k) ? menuClass(k) : keyClass[k] ?? null);

  const menuData: Record<string, OsaMenu> = {};
  const reached = new Set<string>();
  const walk = (k: string, seen: Set<string>) => {
    if (seen.has(k)) return;
    seen.add(k);
    const f = menus.fileOfKey[k];
    if (f) reached.add(f);
    for (const e of menus.tree[k] ?? []) for (const u of e.upgrades) walk(u, seen);
  };
  walk('developer', new Set());
  for (const [k, list] of Object.entries(menus.tree)) {
    if (isMenu(k)) {
      const items = list.flatMap(e => e.upgrades).map(refOf).filter((x): x is string => !!x);
      menuData[menuClass(k)] = { label: k === 'developer' ? 'iStrong' : (menus.menuLabels[k] ?? menus.pageCardLabels[k] ?? k), items, color: menus.menuColorIdx?.[k] };
      continue;
    }
    const own = keyClass[k];
    if (!own) continue;
    for (const e of list) {
      const tier = Math.max(1, e.layoutTier ?? 1);
      const ups = e.upgrades.map(refOf).filter((x): x is string => !!x);
      if (!ups.length) continue;
      const field = 'UPGRADES_TIER_' + tier;
      classes[own][field] = [...(classes[own][field] ?? []), ...ups];
      classes[own].UPGRADE_LEVEL = 45;
    }
  }
  const listColours = new Set<string>(menus.listColours ?? []);
  const classOfKey = (k: string): string | null => refOf(k) ?? fileClass[k] ?? null;
  for (const [k, root] of Object.entries(menus.treeRootOf ?? {})) {
    if (isMenu(k) || !reached.has(menus.fileOfKey[k] ?? k)) continue;
    const own = classOfKey(k), to = classOfKey(root);
    if (!own || !to || !classes[own]) continue;
    classes[own].REROOT_UPGRADE_TREE = to;
    classes[own].PASS_UPGRADE_COLOR = !listColours.has(k);
    if (menus.pageCardLabels[k]) classes[own].UPGRADE_LABEL = menus.pageCardLabels[k];
  }
  const developer = menuClass('developer');
  menuData[developer] ??= { label: 'iStrong', items: [] };
  const unlisted = input.tanks.map(t => t.key).filter(k => fileClass[k] && !reached.has(k)).map(k => fileClass[k]!);
  if (unlisted.length) {
    menuData['istrong_menu_unlisted'] = { label: 'Unlisted', items: unlisted };
    menuData[developer].items.push('istrong_menu_unlisted');
  }
  const PAGE_MAX = 48;
  for (const [key, page] of Object.entries(pages)) {
    const groups = Object.entries(page.groups);
    if (!groups.length && !input.menus) continue;
    const top = `istrong_menu_${key}`;
    menuData[top] = { label: page.label, items: [] };
    for (const [group, items] of groups.sort(([a], [b]) => a.localeCompare(b))) {
      const g = `${top}_${group.replace(/[^A-Za-z0-9]/g, '_')}`;
      const parts = Math.ceil(items.length / PAGE_MAX);
      for (let i = 0; i < parts; i++) {
        const name = parts > 1 ? `${g}_${i + 1}` : g;
        menuData[name] = { label: parts > 1 ? `${group} ${i + 1}` : group, items: items.slice(i * PAGE_MAX, (i + 1) * PAGE_MAX) };
        menuData[top].items.push(name);
      }
    }
    menuData[developer].items.push(top);
  }
  return { classes, shapes, menus: menuData, fileClass, problems, notConverted, warnings, unlisted: unlisted.length };
}

export const OSA_PACK_NAME = 'iStrong Patch 2026';

const LOADER = [
  'const { combineStats, makeCrasher, makeLaby, makeMenu, makeRare } = require("../../facilitators.js");',
  'const pack = require("./istrong.json");',
  '',
  'for (let name in pack.classes) Class[name] = pack.classes[name];',
  '',
  'function parentOf(type) {',
  '    let p = Array.isArray(type.PARENT) ? type.PARENT[0] : type.PARENT;',
  '    return typeof p === "string" ? Class[p] : p;',
  '}',
  'function find(type, key) {',
  '    for (let c = type; c; c = parentOf(c)) if (c[key] !== undefined) return c[key];',
  '    return Class.genericTank[key];',
  '}',
  'function build(recipe, name) {',
  '    if (recipe.cls) {',
  '        if (Class[recipe.cls]) return recipe.cls;',
  '        return recipe.or ? build(recipe.or, name) : null;',
  '    }',
  '    let made;',
  '    if (recipe.laby) {',
  '        let [food, poly, shiny, level] = recipe.laby;',
  '        if (!Class[food]) return null;',
  '        made = makeLaby(Class[food], poly, shiny, level, poly === 2 ? 2 / 3 : 1);',
  '    } else if (recipe.rare) {',
  '        let base = build(recipe.rare, name + "_base");',
  '        if (!base) return null;',
  '        made = makeRare(Class[base], recipe.level);',
  '    } else if (recipe.crasher) {',
  '        let base = build(recipe.crasher, name + "_base");',
  '        if (!base) return null;',
  '        made = base === "crasher" ? { PARENT: "crasher" } : makeCrasher(Class[base]);',
  '    } else return null;',
  '    Class[name] = made;',
  '    return name;',
  '}',
  'function generator(name) {',
  '    let type = Class[name], size = find(type, "SIZE"), color = find(type, "COLOR");',
  '    return {',
  '        PARENT: "genBody",',
  '        LABEL: `${type.LABEL} Generator`,',
  '        SHAPE: find(type, "SHAPE"),',
  '        COLOR: { BASE: color?.BASE ?? color, BRIGHTNESS_SHIFT: color?.BRIGHTNESS_SHIFT ?? 0, HUE_SHIFT: color?.HUE_SHIFT ?? 0 },',
  '        UPGRADES_TIER_0: [],',
  '        TURRETS: [{',
  '            TYPE: [name, { FACING_TYPE: "toTarget", INDEPENDENT: true }],',
  '            POSITION: { SIZE: Math.sqrt(size) * 2, LAYER: 1, ARC: 0 }',
  '        }],',
  '        GUNS: [',
  '            {',
  '                POSITION: { LENGTH: 2, WIDTH: 10.5, X: 15 },',
  '                PROPERTIES: {',
  '                    SHOOT_SETTINGS: combineStats([{ shudder: 0.1, speed: 1, recoil: 0.1, reload: 6, size: size / 13 }]),',
  '                    TYPE: [name, { INDEPENDENT: true, VARIES_IN_SIZE: false }],',
  '                    NO_LIMITATIONS: true,',
  '                    SPAWN_OFFSET: 0.75',
  '                }',
  '            },',
  '            { POSITION: { LENGTH: 11, WIDTH: 10.5, ASPECT: 1.4, X: 4 } }',
  '        ]',
  '    };',
  '}',
  'for (let shape of pack.shapes) {',
  '    let base = build(shape.recipe, shape.name + "_look");',
  '    if (!base) continue;',
  '    Class[shape.name] = { PARENT: base, LABEL: shape.label, VALUE: shape.value, HEALTH_WITH_LEVEL: false, BODY: shape.body };',
  '    if (shape.size) Class[shape.name].SIZE = shape.size;',
  '    Class[shape.name + "Generator"] = generator(shape.name);',
  '}',
  '',
  'for (let name in pack.menus) {',
  '    Class[name] = makeMenu(pack.menus[name].label, { rerootTree: name, boxColor: pack.menus[name].color });',
  '    Class[name].PASS_UPGRADE_COLOR = true;',
  '}',
  'for (let name in pack.menus) Class[name].UPGRADES_TIER_0 = pack.menus[name].items.filter(item => Class[item]);',
  'Class.menu_special.UPGRADES_TIER_0.push("istrong_menu_developer");',
  ''].join('\n');

export function osaPackFiles(pack: OsaPack): Record<string, string> {
  return {
    'istrong.json': JSON.stringify({ classes: pack.classes, shapes: pack.shapes, menus: pack.menus }),
    'addon.json': JSON.stringify({ name: OSA_PACK_NAME, authors: ['Arjuna'], 'addon-version': 'v0.1.0', 'osa-version': { minimum: 'v2.1.2', target: 'v2.1.2' } }, null, '\t') + '\n',
    'istrong.js': LOADER,
    'not-converted.txt': pack.notConverted.join('\n') + '\n',
  };
}
