import { ARRAS_COLORS, SLOT_ARRAS_NAME } from '../constants/colors.js';
import type { WarningCollector } from '../warnings/collector.js';

const EXCLUDED_FOR_INVERSE = new Set(['rainbow', 'trans']);

const NAMED_COLOR_PRIORITY = [
  'blue', 'green', 'red', 'magenta', 'yellow', 'grey', 'dgrey', 'vlgrey', 'lgrey',
  'gold', 'orange', 'purple', 'aqua', 'pink', 'lavender', 'teal', 'lgreen',
  'black', 'white', 'mustard', 'tangerine', 'brown', 'cyan',
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

function colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

export function arrasColorOf(istrongHex: string | undefined, colorMap: unknown, _warn?: WarningCollector): string | number {
  if (typeof colorMap === 'number' && Number.isInteger(colorMap) && colorMap >= 0 && colorMap < SLOT_ARRAS_NAME.length) {
    return SLOT_ARRAS_NAME[colorMap]!;
  }
  if (!istrongHex || typeof istrongHex !== 'string') return 'grey';
  if (istrongHex === 'inherit') return -1;
  return hexToRgb(istrongHex) ? istrongHex.toLowerCase() : 'grey';
}

export function invertColor(istrongHex: string, _warn?: WarningCollector): string | number {
  if (!istrongHex || typeof istrongHex !== 'string') return 'grey';
  if (istrongHex === 'inherit') return -1;

  for (const name of NAMED_COLOR_PRIORITY) {
    if (ARRAS_COLORS[name]?.toLowerCase() === istrongHex.toLowerCase()) {
      return name;
    }
  }

  for (const [key, value] of Object.entries(ARRAS_COLORS)) {
    if (typeof key === 'string' && EXCLUDED_FOR_INVERSE.has(key)) continue;
    if (value.toLowerCase() === istrongHex.toLowerCase()) {
      const asNumber = Number(key);
      return isNaN(asNumber) ? key : asNumber;
    }
  }

  if (!hexToRgb(istrongHex)) return 'grey';
  return istrongHex.toLowerCase();
}
