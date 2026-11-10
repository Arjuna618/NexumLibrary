import type { TankData, ExportFile, IstrongTurret } from '../types/istrong.js';
import type { ArrasClassEmit, ReverseResult } from '../types/warnings.js';
import { WarningCollector } from '../warnings/collector.js';
import { invertBody } from './bodyInverter.js';
import { invertSkills } from './skillInverter.js';
import { invertTurretsWithDependencies, touchShareOf, withCarrierTouch, withMount, withTankK } from './turretInverter.js';
import { arrasColorOf } from './colorInverter.js';
import { invertSpinSpeed } from './physicsInverter.js';
import { ALWAYS_INVISIBLE_ARRAS_CAP } from '../forward/alwaysInvisible.js';
import { invertPlates, widestSolidPlate, plateFacing, turnedShape, followsBody } from './plateInverter.js';
import { plateShape, osaPolygonShape } from './plateShape.js';
import { emitTankArrasOnly } from './arrasOnlyEmitter.js';
import { emitTankMeta, emitOuterBodyLayerMeta } from './istrongMetaEmitter.js';
import { ISTRONG_PLATE_KEY, plateRecord } from '../types/istrongMeta.js';

const ARRAS_RESERVED_BUILTINS = new Set<string>([
  'basic', 'twin', 'sniper', 'machineGun', 'flankGuard', 'tank', 'triplet', 'tripleTwin',
  'quadTank', 'tripleShot', 'pentaShot', 'spreadShot', 'gunner', 'overseer', 'manager',
  'overlord', 'necromancer', 'predator', 'destroyer', 'annihilator', 'hybrid', 'autoTurret',
  'autoGunner', 'auto3', 'auto4', 'auto5', 'sentinel', 'tri-trapper', 'trapper', 'gunnerTrapper',
  'overtrapper', 'mothership', 'sanctuary', 'kronos', 'genericTank', 'genericBoss', 'bullet',
  'drone', 'swarm', 'trap', 'minion', 'hive', 'boomerang',
]);

function classNameFromDisplayName(name: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .replace(/[-_\s]+/g, ' ')
    .trim()
    .replace(/\s+(.)/g, (_m, c: string) => c.toUpperCase())
    .replace(/^./, c => c.toLowerCase())
    .replace(/^[0-9]/, m => `_${m}`);
  return cleaned || 'unnamed';
}

function uniqueClassName(base: string, takenNames: Set<string>): string {
  if (!takenNames.has(base) && !ARRAS_RESERVED_BUILTINS.has(base)) {
    takenNames.add(base);
    return base;
  }
  let suffix = 2;
  while (takenNames.has(`${base}${suffix}`) || ARRAS_RESERVED_BUILTINS.has(`${base}${suffix}`)) {
    suffix++;
  }
  const final = `${base}${suffix}`;
  takenNames.add(final);
  return final;
}

function detectIsBoss(envelope: ExportFile<TankData>): boolean {
  const category = (envelope.category || '').toLowerCase();
  if (category.includes('dread')) return false;
  if (category.includes('boss') || category.includes('mystical') || category.includes('celestial') || category.includes('eternal') || category.includes('elite') || category.includes('map entit')) return true;
  if (envelope.data.canEarnSkillPoints === false) return true;
  return false;
}

const LEVEL_45_POINTS = 42;

export interface EmitOptions {
  className?: string;
}

const STAT_NAMES_TEMPLATES: Record<string, Record<string, string>> = {
  drone: {
    RELOAD: 'Respawn Rate',
    BULLET_DAMAGE: 'Drone Damage',
    BULLET_PENETRATION: 'Drone Health',
    BULLET_HEALTH: 'Drone Health',
    BULLET_SPEED: 'Drone Speed',
  },
  swarm: {
    BULLET_SPEED: 'Swarm Speed',
    BULLET_DAMAGE: 'Swarm Damage',
    BULLET_HEALTH: 'Swarm Health',
    BULLET_PENETRATION: 'Swarm Penetration',
  },
  trap: {
    BULLET_SPEED: 'Placement Speed',
    BULLET_DAMAGE: 'Trap Damage',
    BULLET_HEALTH: 'Trap Health',
    BULLET_PENETRATION: 'Trap Penetration',
  },
  necro: {
    RELOAD: 'Max Drone Count',
  },
  mixed: {
    BULLET_SPEED: 'Weapon Speed',
  },
  smasher: {
    RELOAD: 'Engine Acceleration',
  },
};

function buildStatNames(statNamesType: string | undefined): any {
  if (!statNamesType || statNamesType === 'generic') return undefined;
  return STAT_NAMES_TEMPLATES[statNamesType];
}

function buildControllers(tank: TankData): any[] | undefined {
  const controllers: any[] = [];
  if (tank.cameraZoomEnabled) {
    controllers.push(['zoom', { distance: tank.cameraZoomDistance ?? 225 }]);
  }
  if (tank.useCustomAimDirection && typeof tank.customAimAngle === 'number' && tank.customAimAngle !== 0) {
    controllers.push(['fixedDirection', { angle: tank.customAimAngle }]);
  }
  return controllers.length > 0 ? controllers : undefined;
}

function buildFacingType(tank: TankData): any | undefined {
  if (tank.baseSpinEnabled && typeof tank.baseSpinSpeed === 'number') {
    const arrasSpeed = invertSpinSpeed(tank.baseSpinSpeed * (tank.baseSpinDirection ?? 1));
    return ['spin', { speed: arrasSpeed }];
  }
  return undefined;
}

function buildInvisible(tank: TankData): [number, number] | undefined {
  const inv = (tank as any).invisible;
  if (!inv || typeof inv !== 'object') return undefined;
  const fadeIn = typeof inv.fadeInRate === 'number' ? inv.fadeInRate * 2 : undefined;
  const fadeOut = typeof inv.fadeOutRate === 'number' ? inv.fadeOutRate * 2 : undefined;
  if (fadeIn === undefined && fadeOut === undefined) return undefined;
  return [fadeIn ?? 0.08, fadeOut ?? 0.03];
}

function buildAlphaCap(tank: TankData): [number, number] | undefined {
  const inv = (tank as any).invisible;
  return inv && typeof inv === 'object' && inv.always === true ? [0, ALWAYS_INVISIBLE_ARRAS_CAP] : undefined;
}

export function emitTankClass(envelope: ExportFile<TankData>, warn: WarningCollector, opts: EmitOptions = {}): { primary: ArrasClassEmit; dependencies: ArrasClassEmit[] } {
  return withCarrierTouch(touchShareOf(envelope.data?.tankTouchScale), () => emitTankClassOn(envelope, warn, opts));
}

function emitTankClassOn(envelope: ExportFile<TankData>, warn: WarningCollector, opts: EmitOptions): { primary: ArrasClassEmit; dependencies: ArrasClassEmit[] } {
  const tank = envelope.data;
  const isBoss = detectIsBoss(envelope);
  let className: string;
  if (opts.className) {
    className = opts.className;
  } else {
    const baseName = classNameFromDisplayName(envelope.name);
    className = uniqueClassName(baseName, new Set<string>());
    if (className !== baseName) {
      warn.warn('className', `Tank name "${envelope.name}" sanitized to "${baseName}" matches a built in arras name; emitted as "${className}".`);
    }
  }

  const body = invertBody(tank, isBoss, warn);
  const skills = invertSkills(tank.skillCaps, tank.preDefinedSkills, tank.canEarnSkillPoints, tank.bonusSkillPoints, warn, isBoss ? 0 : LEVEL_45_POINTS);
  const mountSize = typeof body.SIZE === 'number' ? body.SIZE * (body.HEALTH_WITH_LEVEL ? 1 + 97 / 96 : 1) : null;
  const K = widestSolidPlate(tank).K;
  const plates = withTankK(K, () => invertPlates(tank, className, warn, mountSize));
  const mainParts = (tank.turrets ?? []).filter((t) => !(t && t.id && plates.onPlates.has(t.id)));
  const turretsResult = plates.anchor
    ? { GUNS: plates.anchorGuns, TURRETS: plates.anchorTurrets, dependencies: [] as ArrasClassEmit[] }
    : withTankK(K, () => withMount(mountSize, () => invertTurretsWithDependencies(mainParts, className, warn)));
  const color = arrasColorOf(tank.tankColor, tank.tankColorMap, warn);
  const controllers = buildControllers(tank);
  const facingType = buildFacingType(tank);
  const invisible = buildInvisible(tank);

  const allTurrets = [...plates.before, ...turretsResult.TURRETS, ...plates.after];

  const classDef: ArrasClassEmit = {
    className,
    PARENT: isBoss ? 'genericBoss' : 'genericTank',
    LABEL: envelope.name,
    BODY: body.BODY as any,
  };

  if (body.SIZE !== undefined) classDef.SIZE = K === 1 ? body.SIZE : Math.round(body.SIZE * K * 100) / 100;
  if (K !== 1 && typeof (classDef.BODY as any).FOV === 'number') (classDef.BODY as any).FOV = (classDef.BODY as any).FOV / Math.pow(K, 0.65);

  if (plates.anchor) {
    const a = plates.anchor;
    classDef.SHAPE = turnedShape(plateShape(a, typeof a.sides === 'number' ? a.sides : 6, warn), a.initialAngle ?? 0) as any;
  } else if (typeof body.SHAPE === 'number' && body.SHAPE !== 0) {
    classDef.SHAPE = osaPolygonShape(body.SHAPE, (tank.tankShapeDepth ?? 0) > 0, true);
  }

  if (plates.anchor && !followsBody(plates.anchor, tank)) classDef.COLOR = arrasColorOf(plates.anchor.color ?? '#a7a7af', plates.anchor.colorMap, warn);
  else if (tank.keepOwnColor === true && color !== 'inherit' && color !== -1) classDef.COLOR = color;
  if (body.HEALTH_WITH_LEVEL !== undefined) classDef.HEALTH_WITH_LEVEL = body.HEALTH_WITH_LEVEL;
  if (body.LEVEL !== undefined) classDef.LEVEL = body.LEVEL;

  if (turretsResult.GUNS.length > 0) classDef.GUNS = turretsResult.GUNS;
  if (allTurrets.length > 0) classDef.TURRETS = allTurrets;

  if (skills.SKILL_CAP) classDef.SKILL_CAP = skills.SKILL_CAP;
  if (skills.SKILL) classDef.SKILL = skills.SKILL;
  if (skills.EXTRA_SKILL) classDef.EXTRA_SKILL = skills.EXTRA_SKILL;

  if (controllers) classDef.CONTROLLERS = controllers;

  const effectiveFacing = plates.anchor ? plateFacing(plates.anchor) : facingType;
  if (effectiveFacing) classDef.FACING_TYPE = effectiveFacing;
  else if (isBoss) classDef.FACING_TYPE = 'toTarget';

  if (tank.isHealer) classDef.HEALING_TANK = true;
  if (tank.ignoresWalls === true) classDef.ARENA_CLOSER = true;
  if (tank.showHealthBar === false) classDef.DRAW_HEALTH = false;

  if (invisible) (classDef as any).INVISIBLE = invisible;
  const alphaCap = invisible ? buildAlphaCap(tank) : undefined;
  if (alphaCap) (classDef as any).ALPHA = alphaCap;

  const statNames = buildStatNames(tank.statNamesType);
  if (statNames) classDef.STAT_NAMES = statNames;

  if (tank.statNamesType === 'smasher') (classDef as any).IS_SMASHER = true;

  if (typeof tank.globalMaxAlive === 'number' && tank.globalMaxAliveEnabled) {
    classDef.MAX_CHILDREN = tank.globalMaxAlive;
  }

  if (tank._tapRootId !== undefined || (tank as any).fearHeat !== undefined) {
    warn.info('istrong-only', 'iStrong-only fields (_tapRootId, fearHeat, enemy behavior fields) dropped on reverse export');
  }

  emitTankArrasOnly(classDef as any, (tank as any)._arrasOnly);
  emitTankMeta(classDef as any, tank);
  if (plates.anchor) {
    emitOuterBodyLayerMeta(classDef as any, plates.anchor);
    (classDef as any)[ISTRONG_PLATE_KEY] = plateRecord(plates.anchor, plates.anchorIndex);
  }

  const allDependencies = [...turretsResult.dependencies, ...plates.dependencies];

  return { primary: classDef, dependencies: allDependencies };
}

export function buildReverseResult(envelope: ExportFile<TankData>, opts: EmitOptions = {}): ReverseResult {
  const warn = new WarningCollector();
  const result = emitTankClass(envelope, warn, opts);

  const pairedFilenames = result.dependencies.map(d => `${d.className}.js`);

  return {
    primary: result.primary,
    dependencies: result.dependencies,
    warnings: warn.list(),
    suggestedFilenames: {
      js: `${result.primary.className}.js`,
      json: `${result.primary.className}.json`,
      paired: pairedFilenames.length > 0 ? pairedFilenames : undefined,
    },
  };
}
