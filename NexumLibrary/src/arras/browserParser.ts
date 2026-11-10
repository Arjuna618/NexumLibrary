import type { ArrasClassDef, Registry } from '../types/arras.js';
import { combineStats, weaponArray, ensureIsClass, makeConfigProxy } from './helpers.js';

export interface ParseArrasResult {
  registry: Registry;
  newClassNames: string[];
  errors: string[];
}

export function buildRegistryFromJson(registryJson: Record<string, ArrasClassDef>): Registry {
  const map = new Map<string, ArrasClassDef>();
  for (const [name, def] of Object.entries(registryJson)) {
    map.set(name, { ...def, _className: name });
  }
  return map;
}

export type OsaHelperSources = Record<string, string>;

export function parseArrasUserCode(
  userCode: string,
  baseRegistry: Registry,
  gunvals: Record<string, any>,
  helpers?: OsaHelperSources | null,
): ParseArrasResult {
  const errors: string[] = [];
  const ClassObj: Record<string, any> = {};
  for (const [name, def] of baseRegistry) {
    ClassObj[name] = def;
  }

  const before = new Set(Object.keys(ClassObj));
  const g: Record<string, any> = { ...gunvals };
  Object.defineProperty(g, 'g', { value: g, enumerable: false });
  const Config = makeConfigProxy();

  const util = {
    forcePush(obj: any, key: string, value: any) {
      if (!obj[key]) obj[key] = [];
      obj[key].push(value);
    },
    getJackpot: (x: number) => (x > 39450 ? Math.pow(x - 26300, 0.85) + 26300 : x / 1.5),
    getReversedJackpot: (x: number) => (x > 39450 ? Math.pow(x - 26300, 1.15) + 26300 : x * 1.5),
  };

  const modules: Record<string, any> = {};
  const helperFile = (p: string): string | null => {
    const base = p.split(/[\\/]/).pop()!.replace(/\.js$/, '') + '.js';
    return helpers && typeof helpers[base] === 'string' ? base : null;
  };
  const sandboxRequire = (p: string): any => {
    const file = helperFile(p);
    if (file === 'gunvals.js' || (!file && p.includes('gunvals'))) return g;
    if (file) {
      if (!(file in modules)) {
        const mod = { exports: {} as any };
        modules[file] = mod.exports;
        const run = new Function('module', 'exports', 'require', 'Class', 'ensureIsClass', 'Config', 'util', helpers![file]!);
        run(mod, mod.exports, sandboxRequire, ClassObj, (s: any) => ensureIsClass(ClassObj, s), Config, util);
        modules[file] = mod.exports;
      }
      return modules[file];
    }
    if (p.includes('facilitators')) return { combineStats, weaponArray };
    return {};
  };

  const consoleStub = { log: () => {}, warn: () => {}, error: () => {} };

  try {
    const wrapped = `
      var module = { exports: {} };
      var exports = module.exports;
      {
      ${userCode}
      }
      return module.exports;
    `;
    const fn = new Function('Class', 'g', 'combineStats', 'weaponArray', 'ensureIsClass', 'Config', 'require', 'util', 'console', 'Math', 'JSON', 'Array', 'Object', 'String', 'Number', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Infinity', 'NaN', 'key', wrapped);
    fn(
      ClassObj,
      g,
      combineStats,
      weaponArray,
      (s: any) => ensureIsClass(ClassObj, s),
      Config,
      sandboxRequire,
      util,
      consoleStub,
      Math, JSON, Array, Object, String, Number, Boolean,
      parseInt, parseFloat, isNaN, isFinite,
      Infinity, NaN,
      (name: string) => String.fromCharCode(1) + name + String.fromCharCode(1),
    );
  } catch (e) {
    errors.push(friendlyParseError(e as Error));
  }

  const newClassNames: string[] = [];
  for (const name of Object.keys(ClassObj)) {
    if (!before.has(name) && ClassObj[name] && typeof ClassObj[name] === 'object') {
      ClassObj[name]._className = name;
      newClassNames.push(name);
    }
  }

  const mergedRegistry = new Map<string, ArrasClassDef>();
  for (const [name, def] of Object.entries(ClassObj)) {
    if (def && typeof def === 'object') {
      mergedRegistry.set(name, def as ArrasClassDef);
    }
  }

  return { registry: mergedRegistry, newClassNames, errors };
}

export function detectClassesInPaste(text: string): string[] {
  const matches: string[] = [];
  const re = /Class\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!matches.includes(m[1]!)) matches.push(m[1]!);
  }
  return matches;
}

const MAX_ERROR_TEXT = 140;

export function friendlyParseError(err: Error): string {
  const raw = (err.message || String(err)).trim();
  if (/is not defined/.test(raw)) {
    const m = raw.match(/^(.+?)\s+is not defined/);
    const identifier = m && m[1] ? m[1].trim() : 'identifier';
    const short = identifier.length > 32 ? identifier.slice(0, 32) + '...' : identifier;
    return `Undefined identifier: ${short}. Make sure all referenced classes, gun presets, and helpers exist in the bundled arras source.`;
  }
  if (/Unexpected (token|identifier|end)/.test(raw)) {
    const head = raw.length > MAX_ERROR_TEXT ? raw.slice(0, MAX_ERROR_TEXT) + '...' : raw;
    return `Syntax error: ${head}`;
  }
  if (/is not a function/.test(raw)) {
    const m = raw.match(/^(.+?)\s+is not a function/);
    const fn = m && m[1] ? m[1].trim() : 'value';
    const short = fn.length > 32 ? fn.slice(0, 32) + '...' : fn;
    return `Not a function: ${short}. Likely a missing helper or incorrect call.`;
  }
  if (raw.length > MAX_ERROR_TEXT) return raw.slice(0, MAX_ERROR_TEXT) + '...';
  return raw;
}
