import type { ArrasClassEmit } from '../types/warnings.js';

export function emitArrasJSON(cls: ArrasClassEmit): string {
  const body: Record<string, any> = {};
  const skipKeys = new Set(['className']);
  for (const [key, value] of Object.entries(cls)) {
    if (skipKeys.has(key)) continue;
    if (value === undefined) continue;
    body[key] = value;
  }
  return JSON.stringify({ [cls.className]: body }, null, 2);
}

export function emitArrasJSONBundle(classes: ArrasClassEmit[]): string {
  const obj: Record<string, any> = {};
  for (const cls of classes) {
    const body: Record<string, any> = {};
    for (const [key, value] of Object.entries(cls)) {
      if (key === 'className' || value === undefined) continue;
      body[key] = value;
    }
    obj[cls.className] = body;
  }
  return JSON.stringify(obj, null, 2);
}
