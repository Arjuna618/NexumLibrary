import type { ExportFile, TankData, TurretPresetData, CustomProjectileData } from '../types/istrong.js';
import type { ReverseResult } from '../types/warnings.js';
import { buildReverseResult, emitTankClass } from './classEmitter.js';
import { WarningCollector } from '../warnings/collector.js';
import { VIEWER_BODY, viewerGunFiring } from './viewerTank.js';
import type { EmitOptions } from './classEmitter.js';

export { buildReverseResult, emitTankClass };

export function convertTankToArras(envelope: ExportFile<TankData>): ReverseResult {
  return buildReverseResult(envelope);
}

export function convertPresetToArras(envelope: ExportFile<TurretPresetData>, opts: EmitOptions = {}): ReverseResult {
  const tank: ExportFile<TankData> = {
    version: envelope.version ?? '1.0.0', type: 'Tank', name: envelope.name || envelope.data?.name || 'preset', timestamp: 0,
    category: 'Tanks', data: { ...VIEWER_BODY, turrets: (envelope.data?.turrets ?? []) as any } as TankData,
  };
  const r = buildReverseResult(tank, opts);
  return { ...r, warnings: [...r.warnings, { severity: 'info', field: 'preset', message: 'A turret preset holds no tank: it is written on the body of the Basic, its turrets as they are. Move them onto your own tank class.' }] };
}

export function convertProjectileToArras(envelope: ExportFile<CustomProjectileData>, opts: EmitOptions = {}): ReverseResult {
  const design: any = { ...envelope.data };
  if (!Array.isArray(design.turrets) && Array.isArray(design.subTurrets)) design.turrets = design.subTurrets;
  const tank: ExportFile<TankData> = {
    version: envelope.version ?? '1.0.0', type: 'Tank', name: envelope.name || design.name || 'projectile', timestamp: 0,
    category: 'Tanks', data: { ...VIEWER_BODY, turrets: [viewerGunFiring(design)] } as TankData,
  };
  const r = buildReverseResult(tank, opts);
  return { ...r, warnings: [...r.warnings, { severity: 'info', field: 'projectile', message: 'A projectile file holds no barrel: its round is fired by the barrel of the Basic (its speed, damage and reload). Put the round class on your own gun.' }] };
}

export function detectEnvelopeType(envelope: any): 'Tank' | 'TurretPreset' | 'CustomProjectile' | 'Unknown' {
  if (!envelope || typeof envelope !== 'object') return 'Unknown';
  const t = envelope.type;
  if (t === 'Tank' || t === 'TurretPreset' || t === 'CustomProjectile') return t;
  return 'Unknown';
}

export function convertEnvelopeToArras(envelope: any): ReverseResult {
  const type = detectEnvelopeType(envelope);
  if (type === 'Tank') return convertTankToArras(envelope);
  if (type === 'TurretPreset') return convertPresetToArras(envelope);
  if (type === 'CustomProjectile') return convertProjectileToArras(envelope);
  const warn = new WarningCollector();
  warn.error('envelope', `Unknown envelope type: ${envelope?.type ?? 'undefined'}`);
  return {
    primary: { className: 'unknown' },
    dependencies: [],
    warnings: warn.list(),
    suggestedFilenames: { js: 'unknown.js', json: 'unknown.json' },
  };
}
