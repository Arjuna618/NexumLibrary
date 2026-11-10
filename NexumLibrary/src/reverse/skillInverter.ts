import type { IstrongSkillCaps } from '../types/istrong.js';
import type { WarningCollector } from '../warnings/collector.js';

const SKILL_NAME_ORDER: (keyof IstrongSkillCaps)[] = [
  'reload',
  'bulletPenetration',
  'bulletHealth',
  'bulletDamage',
  'bulletSpeed',
  'shieldCapacity',
  'bodyDamage',
  'maxHealth',
  'shieldRegen',
  'movementSpeed',
];

export interface InvertedSkills {
  SKILL_CAP?: number[];
  SKILL?: (number | null)[];
  EXTRA_SKILL?: number;
}

export function invertSkills(
  skillCaps: IstrongSkillCaps | undefined,
  preDefinedSkills: Record<string, number> | undefined,
  canEarnSkillPoints: boolean | undefined,
  bonusSkillPoints: number | undefined,
  warn?: WarningCollector,
  levelPoints: number = 0,
): InvertedSkills {
  const result: InvertedSkills = {};

  if (skillCaps) {
    const cap: number[] = [];
    for (const name of SKILL_NAME_ORDER) {
      cap.push(skillCaps[name] ?? 9);
    }
    result.SKILL_CAP = cap;
  }

  if (preDefinedSkills && Object.keys(preDefinedSkills).length > 0) {
    const skill: (number | null)[] = [];
    for (const name of SKILL_NAME_ORDER) {
      const val = preDefinedSkills[name];
      skill.push(typeof val === 'number' ? val : null);
    }
    result.SKILL = skill;
  } else if (canEarnSkillPoints === false) {
    result.SKILL = SKILL_NAME_ORDER.map(() => 0);
    if (warn) {
      warn.info('SKILL', 'canEarnSkillPoints=false detected. Emitting SKILL=[0, ...]: a boss or another entity that does not gain skills.');
    }
  }

  const extra = typeof bonusSkillPoints === 'number' ? bonusSkillPoints - levelPoints : 0;
  if (extra > 0) {
    result.EXTRA_SKILL = extra;
  }

  return result;
}
