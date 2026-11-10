import type { Registry } from '../types/arras.js';
import type { ExportFile, TurretPresetData, IstrongTurret } from '../types/istrong.js';
import { resolveFlat } from './classResolver.js';
import { mapGuns, mapAutoTurrets, PRIMARY_SUB_TURRET_OVERRIDES } from './turretMapperFull.js';
import { resetSharedTurretIds } from './turretMapperHelpers.js';
import { resetTurretIdCounter } from './turretMapperBasic.js';
import { WarningCollector } from '../warnings/collector.js';

function camelToTitle(s: string): string {
  return s.replace(/^./, c => c.toUpperCase()).replace(/([A-Z])/g, ' $1').replace(/\s+/g, ' ').trim();
}

export function convertArrasClassToTurretPreset(
  className: string,
  registry: Registry,
  warn?: WarningCollector,
): ExportFile<TurretPresetData> {
  const w = warn ?? new WarningCollector();
  void w;
  resetTurretIdCounter();
  resetSharedTurretIds();

  const flat = resolveFlat(className, registry);
  const arrasGuns = Array.isArray(flat.GUNS) ? flat.GUNS : [];
  const turrets: IstrongTurret[] = mapGuns(arrasGuns, registry, 0) as IstrongTurret[];

  const arrasTurrets = Array.isArray(flat.TURRETS) ? flat.TURRETS : [];
  const autoTurrets = mapAutoTurrets(arrasTurrets, registry, flat.COLOR as any, 0);
  for (const at of autoTurrets) turrets.push(at as IstrongTurret);

  const displayName = (flat as any).NAME || flat.LABEL || camelToTitle(className);

  const primOverride = PRIMARY_SUB_TURRET_OVERRIDES[className];
  const primaryIndex = primOverride !== undefined && primOverride >= 1 && primOverride <= turrets.length
    ? primOverride - 1
    : undefined;

  return {
    version: '1.0.0',
    type: 'TurretPreset',
    name: displayName,
    timestamp: Date.now(),
    category: 'Turrets',
    source: 'nexum-upload',
    data: {
      name: displayName,
      category: 'Turrets',
      primaryIndex,
      turrets,
    },
  };
}
