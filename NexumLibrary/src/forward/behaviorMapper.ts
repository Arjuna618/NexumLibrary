const CONTROLLER_MAP: Record<string, string> = {
  'nearestDifferentMaster': 'autoTargetEnemy',
  'canRepel': 'canRepel',
  'mapTargetToGoal': 'followMouse',
  'hangOutNearMaster': 'hangNearOwner',
  'alwaysFire': 'alwaysFire',
  'targetSelf': 'targetSelf',
  'spin': 'spinContinuous',
  'avoid': 'avoid',
  'minion': 'minionControl',
  'boomerang': 'returnToOwner',
  'formulaTarget': 'formulaTarget',
  'moveInCircles': 'patrolCircle',
  'fleeAtLowHealth': 'fleeWhenDamaged',
  'snake': 'snake',
  'snakeSwing': 'snake',
  'goToMasterTarget': 'goToTarget',
  'mapAltToFire': 'mapAltToFire',
  'scaleWithMaster': 'scaleWithMaster',
  'stackGuns': 'stackGuns',
  'disableOnOverride': 'disableOnOverride',
  'healTeamMasters': 'autoTargetEnemy',
  'reverseSpin': 'spinContinuous',
  'spin2': 'reverseSpinOnAlt',
  'listenToPlayer': 'followMouse',
};

export interface BehaviorConfig {
  type: string;
  enabled: boolean;
  [key: string]: any;
}

export function mapControllers(controllers: any[] | undefined): BehaviorConfig[] {
  if (!controllers || !Array.isArray(controllers)) return [];

  const behaviors: BehaviorConfig[] = [];

  for (const ctrl of controllers) {
    let name: string;
    let options: any = {};

    if (typeof ctrl === 'string') {
      name = ctrl;
    } else if (Array.isArray(ctrl)) {
      name = ctrl[0];
      options = ctrl[1] || {};
    } else {
      continue;
    }

    const iStrongType = CONTROLLER_MAP[name];
    if (!iStrongType) continue;

    if (behaviors.some(b => b.type === iStrongType)) continue;

    const config: BehaviorConfig = {
      type: iStrongType,
      enabled: true,
      acceptsFromTop: true,
      responseLag: 0.1,
      maxTurnRate: 360,
      predictionStrength: 50,
      targetRange: 0,
      orbitRadius: 100,
      orbitSpeed: 1.5,
      returnSpeed: 1.5,
      maxDistance: 400,
      cohesion: 0.5,
      separation: 0.3,
      alignment: 0.4,
      spinSpeed: 3,
      targetPriority: 'nearest',
      snakeAmplitude: 150,
      snakePeriod: 5,
      snakeInvert: false,
      snakeYOffset: 0,
      snakeAngle: 0,
      formulaDivisor: 4,
    };

    if (name === 'spin' || name === 'reverseSpin') {
      const rawSpeed = options.speed ?? options.SPEED;
      if (rawSpeed !== undefined) {
        const signed = name === 'reverseSpin' ? -rawSpeed : rawSpeed;
        config.spinSpeed = signed * 30;
      }
    }

    if (name === 'minion') config.orbitRadius = options.turnwiserange ?? 140;
    if (options.radius !== undefined) config.orbitRadius = options.radius;
    if (options.SPEED !== undefined) config.orbitSpeed = options.SPEED;
    if (options.speed !== undefined && name !== 'spin' && name !== 'reverseSpin') {
      config.orbitSpeed = options.speed;
    }

    if (name === 'snakeSwing') {
      if (options.onAlt === true) config.snakeOnAlt = true;
      if (options.swing !== undefined) config.snakeSwing = options.swing;
      if (options.rate !== undefined) config.snakeRate = options.rate;
      if (options.delay !== undefined) config.snakeDelay = options.delay;
      if (options.invert !== undefined) config.snakeInvert = !!options.invert;
    }

    if (name === 'snake') {
      if (options.amplitude !== undefined) config.snakeAmplitude = options.amplitude;
      if (options.period !== undefined) config.snakePeriod = options.period;
      if (options.invert !== undefined) config.snakeInvert = !!options.invert;
      if (options.yOffset !== undefined) config.snakeYOffset = options.yOffset;
      if (options.angle !== undefined) config.snakeAngle = options.angle;
    }

    if (name === 'formulaTarget' && options.divisor !== undefined) {
      config.formulaDivisor = options.divisor;
    }

    if (options.speed !== undefined && (name === 'mapTargetToGoal' || name === 'goToMasterTarget' || name === 'boomerang')) {
      config.returnSpeed = options.speed;
    }

    behaviors.push(config);
  }

  return behaviors;
}

export function mapStatCalculator(calc: string | number | undefined): string {
  if (calc === undefined || calc === null || calc === 0 || calc === 'default') return 'bullet';
  if (typeof calc === 'string') {
    switch (calc) {
      case 'drone': return 'drone';
      case 'trap': case 'block': return 'trap';
      case 'swarm': return 'swarm';
      case 'thruster': return 'thruster';
      case 'necro': return 'necro';
      case 'sustained': return 'sustained';
      case 'sustained+lowspeed': return 'sustainedLowspeed';
      case 'fixedReload': return 'fixedReload';
      default: return 'bullet';
    }
  }
  return 'bullet';
}

export function mapMotionType(arrasMotion: string | undefined): string {
  switch (arrasMotion) {
    case 'glide': return 'glide';
    case 'motor': return 'motor';
    case 'chase': return 'chase';
    case 'swarm': return 'swarm';
    case 'grow': return 'grow';
    case 'withMaster': return 'withMaster';
    default: return 'glide';
  }
}

export function mapFacingType(arras: any): string {
  if (!arras) return 'toTarget';
  const name = typeof arras === 'string' ? arras : (Array.isArray(arras) ? arras[0] : 'toTarget');
  switch (name) {
    case 'toTarget': return 'toTarget';
    case 'smoothToTarget': return 'smoothToTarget';
    case 'smoothWithMotion': return 'smoothWithMotion';
    case 'turnWithSpeed': return 'turnWithSpeed';
    case 'spin': return 'spin';
    case 'fastspin': return 'spin';
    case 'veryfastspin': return 'spin';
    case 'locksFacing': return 'locksFacing';
    case 'looseWithMotion': return 'smoothWithMotion';
    case 'withMotion': return 'smoothWithMotion';
    case 'autospin': return 'spin';
    case 'bound': return 'toTarget';
    default: return 'toTarget';
  }
}
