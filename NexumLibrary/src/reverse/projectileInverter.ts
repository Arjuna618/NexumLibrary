import type { IstrongProjectileType } from '../types/istrong.js';
import type { WarningCollector } from '../warnings/collector.js';

const VISUAL_TO_TYPE: Record<string, string> = {
  bullet: 'bullet',
  drone: 'drone',
  swarm: 'swarm',
  trap: 'setTrap',
  minion: 'minion',
  hive: 'hive',
  boomerang: 'boomerang',
  bomb: 'bomb',
  rocket: 'rocket',
  missile: 'missile',
};

export interface InvertedProjectileType {
  typeName: string;
  hasCustomProjectile: boolean;
  customProjectileChildClass?: string;
}

export function invertProjectileType(pt: IstrongProjectileType, parentTankName: string, gunIndex: number, warn: WarningCollector): InvertedProjectileType {
  if (pt.customProjectileDesign) {
    const childName = `${parentTankName}Projectile${gunIndex}`;
    warn.info('projectile.custom', `Custom projectile design extracted to child class "${childName}"`, {
      original: pt.customProjectileDesign,
      recovered: childName,
    });
    return {
      typeName: childName,
      hasCustomProjectile: true,
      customProjectileChildClass: childName,
    };
  }

  const visual = (pt.visual || 'bullet').toLowerCase();
  const typeName = VISUAL_TO_TYPE[visual] ?? 'bullet';

  if (!VISUAL_TO_TYPE[visual]) {
    warn.warn('projectile.visual', `Unknown projectile visual "${pt.visual}" mapped to 'bullet'`, {
      original: pt.visual,
      recovered: 'bullet',
    });
  }

  return {
    typeName,
    hasCustomProjectile: false,
  };
}

export function getEntityTypeFromVisual(visual: string | undefined): string {
  if (!visual) return 'bullet';
  const lower = visual.toLowerCase();
  if (lower === 'trap') return 'trap';
  if (lower === 'drone') return 'drone';
  if (lower === 'swarm') return 'swarm';
  if (lower === 'minion') return 'minion';
  if (lower === 'hive') return 'hive';
  if (lower === 'boomerang') return 'boomerang';
  return 'bullet';
}
