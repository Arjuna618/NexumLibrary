import type { ReverseResult } from '../types/warnings.js';
import { emitArrasJS } from './jsEmitter.js';
import { emitArrasJSON } from './jsonEmitter.js';

export interface BundledFiles {
  js: Record<string, string>;
  json: Record<string, string>;
}

export function bundleReverseResult(result: ReverseResult): BundledFiles {
  const js: Record<string, string> = {};
  const json: Record<string, string> = {};

  const primaryName = result.primary.className;
  js[`${primaryName}.js`] = emitArrasJS(result.primary);
  json[`${primaryName}.json`] = emitArrasJSON(result.primary);

  for (const dep of result.dependencies) {
    js[`${dep.className}.js`] = emitArrasJS(dep);
    json[`${dep.className}.json`] = emitArrasJSON(dep);
  }

  return { js, json };
}
