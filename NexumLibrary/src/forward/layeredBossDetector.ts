import type { Registry, ArrasClassDef } from '../types/arras.js';
import { resolveFlat } from './classResolver.js';

const ARRAS_OUTER_BODY_SIZE = 20;
const SPIN_MULT = 2500 / 3;

export interface LayeredBossLayer {
  layerName: string;
  layerIndex: number;
  arrasSize: number;
  shape: number;
  color: any;
  colorInherit: boolean;
  spinSpeed: number;
  spinDirection: 1 | -1;
  hasExplicitSpin: boolean;
  maxChildren: number;
  layerClass: ArrasClassDef;
  hasHealerSymbol: boolean;
}

export interface LayeredBossDetection {
  isLayered: boolean;
  mainClassName: string;
  layers: LayeredBossLayer[];
  innermost: LayeredBossLayer | null;
}

function readLayerArrasSize(mainTurrets: any[] | undefined, layerName: string): number {
  if (!Array.isArray(mainTurrets)) return ARRAS_OUTER_BODY_SIZE;
  for (const t of mainTurrets) {
    const tType = typeof t.TYPE === 'string'
      ? t.TYPE
      : (Array.isArray(t.TYPE) ? t.TYPE[0] : null);
    if (tType === layerName && Array.isArray(t.POSITION)) {
      return t.POSITION[0] ?? ARRAS_OUTER_BODY_SIZE;
    }
  }
  return ARRAS_OUTER_BODY_SIZE;
}

function detectHealerSymbol(layerDef: ArrasClassDef): boolean {
  const ts = (layerDef as any).TURRETS;
  if (!Array.isArray(ts)) return false;
  for (const td of ts) {
    const tn = typeof td.TYPE === 'string' ? td.TYPE : (Array.isArray(td.TYPE) ? td.TYPE[0] : '');
    if (tn === 'healerSymbol') return true;
  }
  return false;
}

export function detectLayeredBoss(mainClassName: string, registry: Registry): LayeredBossDetection {
  const mainClass = registry.get(mainClassName);
  if (!mainClass) {
    return { isLayered: false, mainClassName, layers: [], innermost: null };
  }
  const flat = resolveFlat(mainClassName, registry);
  const mainTurrets: any[] = Array.isArray(flat.TURRETS) ? flat.TURRETS : [];

  const layers: LayeredBossLayer[] = [];
  for (let i = 1; i <= 10; i++) {
    const layerName = `${mainClassName}Layer${i}`;
    const layerDef = registry.get(layerName);
    if (!layerDef) break;

    const arrasSize = readLayerArrasSize(mainTurrets, layerName);
    const rawColor = (layerDef as any).COLOR;

    let spinSpeed = 50;
    let spinDirection: 1 | -1 = (i % 2 === 0 ? 1 : -1);
    let hasExplicitSpin = false;
    const ft = (layerDef as any).FACING_TYPE;
    if (Array.isArray(ft) && ft[0] === 'spin') {
      const sp = ft[1]?.speed;
      if (typeof sp === 'number') {
        spinDirection = sp >= 0 ? 1 : -1;
        spinSpeed = Math.min(500, Math.round(Math.abs(sp) * SPIN_MULT));
        hasExplicitSpin = true;
      }
    }

    layers.push({
      layerName,
      layerIndex: i,
      arrasSize,
      shape: typeof (layerDef as any).SHAPE === 'number' ? (layerDef as any).SHAPE : 0,
      color: rawColor,
      colorInherit: rawColor === -1,
      spinSpeed,
      spinDirection,
      hasExplicitSpin,
      maxChildren: typeof (layerDef as any).MAX_CHILDREN === 'number' ? (layerDef as any).MAX_CHILDREN : 0,
      layerClass: layerDef as ArrasClassDef,
      hasHealerSymbol: detectHealerSymbol(layerDef as ArrasClassDef),
    });
  }

  if (layers.length === 0) {
    return { isLayered: false, mainClassName, layers: [], innermost: null };
  }

  return {
    isLayered: true,
    mainClassName,
    layers,
    innermost: layers[layers.length - 1]!,
  };
}
