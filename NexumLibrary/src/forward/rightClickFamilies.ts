import type { Registry } from '../types/arras.js';

export type UpgradeTree = Map<string, string[]>;

export const SIDEWINDER_ROOT = 'sidewinder';
export const TWISTER_ROOT = 'twister';

export const SIDEWINDER_SNAKE = Object.freeze({ snakeSwing: 48.4, snakeRate: 44.9, snakeDelay: 0.475 });

export function upgradeTreeOf(registry: Registry): UpgradeTree {
  const tree: UpgradeTree = new Map();
  for (const [name, def] of registry) {
    if (!def) continue;
    let kids: string[] | null = null;
    for (const key of Object.keys(def)) {
      if (!key.startsWith('UPGRADES_TIER_')) continue;
      const list = (def as any)[key];
      if (!Array.isArray(list)) continue;
      for (const child of list) {
        if (typeof child !== 'string') continue;
        if (!kids) kids = [];
        if (!kids.includes(child)) kids.push(child);
      }
    }
    if (kids) tree.set(name, kids);
  }
  return tree;
}

export function familyMembers(root: string, tree: UpgradeTree): Set<string> {
  const out = new Set<string>([root]);
  const queue: string[] = [root];
  while (queue.length > 0) {
    const cur = queue.pop() as string;
    const kids = tree.get(cur);
    if (!kids) continue;
    for (const k of kids) {
      if (out.has(k)) continue;
      out.add(k);
      queue.push(k);
    }
  }
  return out;
}

export interface RightClickFamilies {
  sidewinder: Set<string>;
  twister: Set<string>;
}

export function resolveRightClickFamilies(tree: UpgradeTree): RightClickFamilies {
  return {
    sidewinder: familyMembers(SIDEWINDER_ROOT, tree),
    twister: familyMembers(TWISTER_ROOT, tree),
  };
}

const familiesByRegistry = new WeakMap<Registry, RightClickFamilies>();
export function rightClickFamiliesOf(registry: Registry): RightClickFamilies {
  let f = familiesByRegistry.get(registry);
  if (!f) {
    f = resolveRightClickFamilies(upgradeTreeOf(registry));
    familiesByRegistry.set(registry, f);
  }
  return f;
}

function projectileDrivesItself(turret: any): boolean {
  const cpd = turret?.projectileType?.customProjectileDesign;
  return !!cpd && Array.isArray(cpd.turrets) && cpd.turrets.length > 0;
}

function projectileSpins(turret: any): boolean {
  return turret?.projectileType?.facingType === 'spin';
}

function hasBehavior(turret: any, type: string): any | undefined {
  const list = turret?.projectileBehaviors;
  if (!Array.isArray(list)) return undefined;
  return list.find((b: any) => b && b.type === type);
}

export function applyRightClickFamilies(
  className: string,
  turrets: any[],
  families: RightClickFamilies,
  makeBehavior: (type: string) => any,
): number {
  const inSidewinder = families.sidewinder.has(className);
  const inTwister = families.twister.has(className);
  if (!inSidewinder && !inTwister) return 0;
  let changed = 0;
  for (const t of turrets) {
    if (!t || t.turretType === 'decorative') continue;
    if (!Array.isArray(t.projectileBehaviors)) continue;
    let touched = false;
    if (inSidewinder && projectileDrivesItself(t)) {
      let snake = hasBehavior(t, 'snake');
      if (!snake) {
        snake = makeBehavior('snake');
        t.projectileBehaviors.push(snake);
      }
      if (snake.snakeOnAlt !== true) { snake.snakeOnAlt = true; touched = true; }
      for (const key of Object.keys(SIDEWINDER_SNAKE) as (keyof typeof SIDEWINDER_SNAKE)[]) {
        if (typeof snake[key] !== 'number') { snake[key] = SIDEWINDER_SNAKE[key]; touched = true; }
      }
    }
    if (inTwister && projectileSpins(t)) {
      if (!hasBehavior(t, 'reverseSpinOnAlt')) {
        t.projectileBehaviors.push(makeBehavior('reverseSpinOnAlt'));
        touched = true;
      }
    }
    if (touched) changed++;
  }
  return changed;
}
