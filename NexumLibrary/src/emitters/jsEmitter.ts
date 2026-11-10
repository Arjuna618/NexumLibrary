import type { ArrasClassEmit } from '../types/warnings.js';

const INDENT = '    ';

function quoteKey(key: string): string {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) return key;
  return JSON.stringify(key);
}

function formatNumber(n: number): string {
  if (!isFinite(n)) return 'null';
  if (Number.isInteger(n)) return String(n);
  const fixed = n.toFixed(6);
  return parseFloat(fixed).toString();
}

function serialize(value: any, depth: number): string {
  const pad = INDENT.repeat(depth);
  const childPad = INDENT.repeat(depth + 1);

  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const isNumericArray = value.every(v => typeof v === 'number');
    if (isNumericArray && value.length <= 8) {
      return '[' + value.map(formatNumber).join(', ') + ']';
    }
    const parts = value.map(v => childPad + serialize(v, depth + 1));
    return '[\n' + parts.join(',\n') + '\n' + pad + ']';
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const parts = keys.map(k => `${childPad}${quoteKey(k)}: ${serialize(value[k], depth + 1)}`);
    return '{\n' + parts.join(',\n') + '\n' + pad + '}';
  }

  return JSON.stringify(value);
}

export function emitArrasJS(cls: ArrasClassEmit): string {
  const body: Record<string, any> = {};
  const skipKeys = new Set(['className']);
  for (const [key, value] of Object.entries(cls)) {
    if (skipKeys.has(key)) continue;
    if (value === undefined) continue;
    body[key] = value;
  }
  const rendered = serialize(body, 0);
  return `Class.${cls.className} = ${rendered};\n`;
}

export function emitArrasJSBundle(classes: ArrasClassEmit[]): string {
  return classes.map(emitArrasJS).join('\n');
}
