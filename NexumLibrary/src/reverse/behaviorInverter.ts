import type { WarningCollector } from '../warnings/collector.js';

const BEHAVIOR_TO_CONTROLLER: Record<string, string> = {
  autoTargetEnemy: 'nearestDifferentMaster',
  canRepel: 'canRepel',
  followMouse: 'mapTargetToGoal',
  hangNearOwner: 'hangOutNearMaster',
  alwaysFire: 'alwaysFire',
  targetSelf: 'targetSelf',
  spinContinuous: 'spin',
  avoid: 'avoid',
  minionControl: 'minion',
  returnToOwner: 'boomerang',
  formulaTarget: 'formulaTarget',
  patrolCircle: 'moveInCircles',
  fleeWhenDamaged: 'fleeAtLowHealth',
  snake: 'snake',
  goToTarget: 'goToMasterTarget',
  mapAltToFire: 'mapAltToFire',
  scaleWithMaster: 'scaleWithMaster',
  stackGuns: 'stackGuns',
  disableOnOverride: 'disableOnOverride',
};

const REVERSE_SPIN_ARRAS_SPEED = 0.2;

const SKIP_BEHAVIORS = new Set([
  'motionGlide',
  'motionMotor',
  'motionChase',
  'motionSwarm',
  'motionGrow',
  'motionWithMaster',
  'swarmAI',
  'waitToCycle',
  'startsLoaded',
  'destroyOldest',
  'independentProjectile',
  'invisible',
  'alwaysInvisible',
]);

export interface InvertedBehavior {
  controllers: any[];
  propertyFlags: Record<string, boolean>;
}

export function invertBehaviors(behaviors: any[] | undefined, warn?: WarningCollector): InvertedBehavior {
  const controllers: any[] = [];
  const propertyFlags: Record<string, boolean> = {};
  if (!Array.isArray(behaviors)) return { controllers, propertyFlags };

  for (const b of behaviors) {
    if (!b || !b.enabled) continue;
    const type = b.type as string;
    if (SKIP_BEHAVIORS.has(type)) {
      if (type === 'waitToCycle') propertyFlags.WAIT_TO_CYCLE = true;
      if (type === 'startsLoaded') propertyFlags.DELAY_SPAWN = false;
      if (type === 'destroyOldest') propertyFlags.DESTROY_OLDEST_CHILD = true;
      if (type === 'independentProjectile') propertyFlags.INDEPENDENT = true;
      if (type === 'alwaysInvisible') propertyFlags.ALWAYS_INVISIBLE = true;
      continue;
    }
    if (type === 'reverseSpinOnAlt') {
      controllers.push(['spin2', { speed: REVERSE_SPIN_ARRAS_SPEED }]);
      continue;
    }
    const name = BEHAVIOR_TO_CONTROLLER[type];
    if (!name) {
      if (warn) warn.info('behavior', `Behavior "${type}" has no arras controller mapping; skipped`);
      continue;
    }

    if (name === 'snake') {
      const options: Record<string, any> = {};
      if (b.snakeOnAlt === true) options.onAlt = true;
      if (typeof b.snakeSwing === 'number' && b.snakeSwing !== 48.4) options.swing = b.snakeSwing;
      if (typeof b.snakeRate === 'number' && b.snakeRate !== 44.9) options.rate = b.snakeRate;
      if (typeof b.snakeDelay === 'number' && b.snakeDelay !== 0.475) options.delay = b.snakeDelay;
      if (b.snakeInvert === true) options.invert = true;
      controllers.push(Object.keys(options).length > 0 ? ['snakeSwing', options] : 'snakeSwing');
      continue;
    }

    if (name === 'spin') {
      const speed = typeof b.spinSpeed === 'number' ? b.spinSpeed / 30 : undefined;
      if (typeof speed === 'number') {
        controllers.push(['spin', { speed }]);
      } else {
        controllers.push('spin');
      }
      continue;
    }

    if (name === 'formulaTarget' && typeof b.formulaDivisor === 'number' && b.formulaDivisor !== 4) {
      controllers.push([name, { divisor: b.formulaDivisor }]);
      continue;
    }

    controllers.push(name);
  }

  return { controllers, propertyFlags };
}

const MOTION_TYPE_TO_ARRAS: Record<string, string> = {
  glide: 'glide',
  motor: 'motor',
  chase: 'chase',
  swarm: 'swarm',
  grow: 'grow',
  withMaster: 'withMaster',
};

export function invertMotionType(istrongMotion: string | undefined): string | undefined {
  if (!istrongMotion) return undefined;
  return MOTION_TYPE_TO_ARRAS[istrongMotion];
}

const FACING_TYPE_TO_ARRAS: Record<string, string> = {
  toTarget: 'toTarget',
  smoothToTarget: 'smoothToTarget',
  smoothWithMotion: 'smoothWithMotion',
  turnWithSpeed: 'turnWithSpeed',
  spin: 'spin',
  locksFacing: 'locksFacing',
};

export function invertFacingType(istrongFacing: string | undefined): string | undefined {
  if (!istrongFacing) return undefined;
  return FACING_TYPE_TO_ARRAS[istrongFacing];
}

const STAT_CALCULATOR_TO_ARRAS: Record<string, string> = {
  bullet: 'default',
  drone: 'drone',
  trap: 'trap',
  swarm: 'swarm',
  thruster: 'thruster',
  necro: 'necro',
  sustained: 'sustained',
  sustainedLowspeed: 'sustained+lowspeed',
  fixedReload: 'fixedReload',
};

export function invertStatCalculator(istrongCalc: string | undefined): string | undefined {
  if (!istrongCalc || istrongCalc === 'bullet') return undefined;
  return STAT_CALCULATOR_TO_ARRAS[istrongCalc];
}
