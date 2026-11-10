import type { ArrasClassDef, Registry } from '../types/arras.js';
import type { ExportFile, TankData, IstrongTurret, IstrongSkillCaps, AnyIstrongEnvelope } from '../types/istrong.js';
import { resolveFlat, classifyEntity } from './classResolver.js';
import { resetTurretIdCounter } from './turretMapperBasic.js';
import { mapGuns, mapAutoTurrets, buildSmasherBodyLayers, isDreadnoughtV2Class, mergeRestoredLooks, type AutoTurretMount } from './turretMapperFull.js';
import { resetSharedTurretIds, ARRAS_SPIN_MULTIPLIER, makeBehavior } from './turretMapperHelpers.js';
import { rightClickFamiliesOf, applyRightClickFamilies } from './rightClickFamilies.js';
import { launcherFamilyOfRegistry, applyExhaustRule } from './exhaustFamilies.js';
import { underseerFamilyOfRegistry, applyStartsLoadedRule } from './startsLoadedFamilies.js';
import { applyMeasuredFlight, applyMeasuredRounds, measuredBodySize } from './newArrasMeasured.js';
import { alphaIsCapped, alphaIsFixedBelowOne } from './alwaysInvisible.js';
import { getEntityColor, isTeamDefaultColor, colorSlotOf } from './colorMapper.js';
import {
  convertBodyHP,
  convertBodyDamage,
  convertDrivenSpeed,
  convertPushShare,
  convertShieldCapacity,
  convertShieldRegen,
  convertFOV,
  convertPushability,
  convertTankSize,
  entityLevelsUp,
} from './physicsCalibrator.js';
import { WarningCollector } from '../warnings/collector.js';
import { convertArrasClassToTurretPreset } from './exportGeneratorTurretPreset.js';
import { convertArrasClassToCustomProjectile } from './exportGeneratorCustomProjectile.js';
import { detectLayeredBoss } from './layeredBossDetector.js';
import { collectTankArrasOnly } from './arrasOnlyCollector.js';
import { applyTankMeta, applyBodyLayerMeta, applyOuterBodyLayerMeta } from './istrongMetaReader.js';
import { readPlates } from './plateReader.js';

const SKCNV_ORDER: (keyof IstrongSkillCaps)[] = [
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

const SMASHER_STAT_NAMES_OVERRIDES = new Set<string>(['bob', 'nemesis']);
export function detectStatNamesType(statNames: any, className?: string): string {
  if (className && SMASHER_STAT_NAMES_OVERRIDES.has(className)) return 'smasher';
  if (!statNames || typeof statNames !== 'object') return 'generic';
  const reload = statNames.RELOAD;
  const speed = statNames.BULLET_SPEED;
  if (reload === 'Max Drone Count') return 'necro';
  if (reload === 'Respawn Rate') return 'drone';
  if (reload === 'Engine Acceleration') return 'smasher';
  if (speed === 'Placement Speed') return 'trap';
  if (speed === 'Swarm Speed') return 'swarm';
  if (speed === 'Weapon Speed') return 'mixed';
  if (speed === 'Drone Speed') return 'drone';
  return 'generic';
}

function camelToTitle(s: string): string {
  return s.replace(/^./, c => c.toUpperCase()).replace(/([A-Z])/g, ' $1').replace(/\s+/g, ' ').trim();
}

function buildSkillCaps(arrasCap: any): IstrongSkillCaps {
  const out: any = {
    reload: 9,
    bulletPenetration: 9,
    bulletHealth: 9,
    bulletDamage: 9,
    bulletSpeed: 9,
    shieldCapacity: 9,
    bodyDamage: 9,
    maxHealth: 9,
    shieldRegen: 9,
    movementSpeed: 9,
  };
  if (Array.isArray(arrasCap)) {
    for (let i = 0; i < SKCNV_ORDER.length; i++) {
      const v = arrasCap[i];
      if (typeof v === 'number') out[SKCNV_ORDER[i]!] = v;
    }
  }
  return out as IstrongSkillCaps;
}

function buildPreDefinedSkills(arrasSkill: any): Record<string, number> | undefined {
  if (!Array.isArray(arrasSkill)) return undefined;
  const out: Record<string, number> = {};
  let hasAny = false;
  for (let i = 0; i < SKCNV_ORDER.length; i++) {
    const v = arrasSkill[i];
    if (typeof v === 'number') {
      out[SKCNV_ORDER[i]!] = v;
      hasAny = true;
    }
  }
  return hasAny ? out : undefined;
}

export function convertArrasClassToTank(
  className: string,
  registry: Registry,
  warn?: WarningCollector,
): ExportFile<TankData> {
  const w = warn ?? new WarningCollector();
  resetTurretIdCounter();
  resetSharedTurretIds();

  const flat = resolveFlat(className, registry);
  const kind = classifyEntity(className, registry);

  const body = flat.BODY ?? {};
  const healthWithLevel = (flat as any).HEALTH_WITH_LEVEL !== false;
  const tankHP = convertBodyHP(body.HEALTH ?? 20, healthWithLevel);
  const tankShield = convertShieldCapacity(body.SHIELD ?? 0, healthWithLevel);

  const layered = detectLayeredBoss(className, registry);
  const rawClass = registry.get(className);
  const bodySlot = colorSlotOf(flat.COLOR);

  const arrasGuns = Array.isArray(flat.GUNS) ? flat.GUNS : [];
  const arrasTurrets = Array.isArray(flat.TURRETS) ? flat.TURRETS : [];
  const rcFamilies = rightClickFamiliesOf(registry);
  const nexumMade = !!(rawClass as any)?._iStrongMeta;
  const _measuredSIZE = nexumMade ? undefined : measuredBodySize(className);
  const tankArrasSize = _measuredSIZE !== undefined ? _measuredSIZE * 2 : ((flat.SIZE as number | undefined) ?? 12) * (entityLevelsUp(flat as Record<string, unknown>) ? 2 : 1);
  const tankMount: AutoTurretMount = { size: tankArrasSize, dreadBody: isDreadnoughtV2Class(rawClass, registry) };

  let turrets: IstrongTurret[];
  let bodyLayersOut: any[] = [];
  let layeredTankSides: number | undefined;
  let layeredTankColor: string | undefined;
  let layeredBaseSpin: { enabled: boolean; speed: number; direction: 1 | -1 } | undefined;

  const plates = readPlates(flat, rawClass, registry, tankArrasSize, (guns, autos, size, color) => {
    const g = mapGuns(guns, registry, 0, undefined, size) as IstrongTurret[];
    applyRightClickFamilies(className, g, rcFamilies, makeBehavior);
    if (!nexumMade) applyMeasuredFlight(className, g);
    if (!nexumMade) applyMeasuredRounds(className, g);
    return [...g, ...mapAutoTurrets(autos, registry, color, 0, { size, dreadBody: tankMount.dreadBody })];
  });

  if (plates) {
    turrets = plates.turrets as IstrongTurret[];
    bodyLayersOut = plates.bodyLayers;
    const mf = plates.mainBody ? (plates.mainBody as any).FACING_TYPE : undefined;
    if (plates.mainBody) {
      const spin = Array.isArray(mf) && mf[0] === 'spin' && typeof mf[1]?.speed === 'number' ? mf[1].speed : null;
      layeredBaseSpin = spin === null
        ? { enabled: false, speed: 50, direction: 1 }
        : { enabled: true, speed: Math.round(Math.abs(spin) * ARRAS_SPIN_MULTIPLIER), direction: spin >= 0 ? 1 : -1 };
    }
  } else if (layered.isLayered) {
    const mainGuns = mapGuns(arrasGuns, registry, 0, undefined, tankArrasSize);
    applyRightClickFamilies(className, mainGuns, rcFamilies, makeBehavior);
    if (!nexumMade) applyMeasuredFlight(className, mainGuns);
    if (!nexumMade) applyMeasuredRounds(className, mainGuns);
    const outerAuto = mapAutoTurrets(arrasTurrets, registry, flat.COLOR as any, 0, tankMount);
    const outerTurretIds: string[] = [...mainGuns.map((t: any) => t.id), ...outerAuto.map((t: any) => t.id)];

    turrets = [...mainGuns, ...outerAuto] as IstrongTurret[];

    const innermost = layered.innermost!;
    const innermostSize = innermost.arrasSize;
    const outerSizeRatio = innermostSize > 0 ? 20 / innermostSize : 1;

    const outerColor = getEntityColor(flat.COLOR as any, '#3ca4cb');
    const firstInner = layered.layers[0]!;

    const outerBodyLayer: any = {
      id: 'layer-boss-body',
      label: 'Outer Body',
      sides: typeof flat.SHAPE === 'number' ? Math.abs(flat.SHAPE) : 0,
      sizeRatio: outerSizeRatio,
      color: outerColor,
      colorMap: bodySlot,
      useInheritColor: true,
      spinEnabled: true,
      spinDirection: (firstInner.spinDirection === 1 ? -1 : 1) as 1 | -1,
      spinSpeed: firstInner.spinSpeed,
      copies: 1,
      initialAngle: 0,
      starDepth: 0,
      starCurved: false,
      intangible: false,
      showHealerCross: false,
      stationary: false,
      turretIds: outerTurretIds,
      renderOrder: 0,
      maxAliveEnabled: ((flat as any).MAX_CHILDREN ?? 0) > 0,
      maxAlive: (flat as any).MAX_CHILDREN ?? 0,
      _currentAngle: 0,
    };
    applyOuterBodyLayerMeta(outerBodyLayer, rawClass as any);
    bodyLayersOut.push(outerBodyLayer);

    for (let i = 0; i < layered.layers.length - 1; i++) {
      const layer = layered.layers[i]!;
      const flatLayer = resolveFlat(layer.layerName, registry);
      const layerArrasSize = tankArrasSize * layer.arrasSize / 20;
      const layerGuns = mapGuns(Array.isArray(flatLayer.GUNS) ? flatLayer.GUNS : [], registry, 0, undefined, layerArrasSize);
      applyRightClickFamilies(className, layerGuns, rcFamilies, makeBehavior);
      if (!nexumMade) applyMeasuredFlight(className, layerGuns);
      const layerAuto = mapAutoTurrets(Array.isArray(flatLayer.TURRETS) ? flatLayer.TURRETS : [], registry, layer.color, 0, { size: layerArrasSize, dreadBody: tankMount.dreadBody });
      const layerTurretIds = [...layerGuns.map((t: any) => t.id), ...layerAuto.map((t: any) => t.id)];

      for (const lt of layerGuns) turrets.push(lt as IstrongTurret);
      for (const lt of layerAuto) turrets.push(lt as IstrongTurret);

      const layerSlot = colorSlotOf(layer.color);
      const innerBodyLayer: any = {
        id: `layer-${i + 1}`,
        label: `Layer ${String.fromCharCode(65 + i)}`,
        sides: layer.shape,
        sizeRatio: innermostSize > 0 ? layer.arrasSize / innermostSize : 1,
        color: getEntityColor(layer.color, '#3ca4cb'),
        colorMap: layerSlot,
        useInheritColor: layer.colorInherit || (layerSlot !== undefined && layerSlot === bodySlot),
        spinEnabled: true,
        spinDirection: layer.spinDirection,
        spinSpeed: layer.spinSpeed,
        copies: 1,
        initialAngle: 0,
        starDepth: 0,
        starCurved: false,
        intangible: false,
        showHealerCross: layer.hasHealerSymbol,
        stationary: false,
        turretIds: layerTurretIds,
        renderOrder: i + 1,
        maxAliveEnabled: layer.maxChildren > 0,
        maxAlive: layer.maxChildren,
        _currentAngle: 0,
      };
      applyBodyLayerMeta(innerBodyLayer, layer.layerClass as any);
      bodyLayersOut.push(innerBodyLayer);
    }

    const flatInner = resolveFlat(innermost.layerName, registry);
    const innerArrasSize = tankArrasSize * innermost.arrasSize / 20;
    const innerGuns = mapGuns(Array.isArray(flatInner.GUNS) ? flatInner.GUNS : [], registry, 0, undefined, innerArrasSize);
    applyRightClickFamilies(className, innerGuns, rcFamilies, makeBehavior);
    if (!nexumMade) applyMeasuredFlight(className, innerGuns);
    const innerAuto = mapAutoTurrets(Array.isArray(flatInner.TURRETS) ? flatInner.TURRETS : [], registry, innermost.color, 0, { size: innerArrasSize, dreadBody: tankMount.dreadBody });
    for (const lt of innerGuns) turrets.push(lt as IstrongTurret);
    for (const lt of innerAuto) turrets.push(lt as IstrongTurret);

    layeredTankSides = innermost.shape;
    layeredTankColor = outerColor;
    if (innermost.hasExplicitSpin) {
      layeredBaseSpin = {
        enabled: true,
        speed: innermost.spinSpeed,
        direction: innermost.spinDirection,
      };
    }

    if ((flat as any).HAS_NO_RECOIL === true) {
      for (const t of turrets) {
        (t as any).knockback = 0;
        if ((t as any).autoSubTurrets) {
          for (const sub of (t as any).autoSubTurrets) sub.knockback = 0;
        }
      }
    }
  } else {
    turrets = mapGuns(arrasGuns, registry, 0, undefined, tankArrasSize) as IstrongTurret[];
    applyRightClickFamilies(className, turrets, rcFamilies, makeBehavior);
    if (!nexumMade) applyMeasuredFlight(className, turrets);
    if (!nexumMade) applyMeasuredRounds(className, turrets);
    const mainGunCount = turrets.length;

    const autoTurrets = mapAutoTurrets(arrasTurrets, registry, flat.COLOR as any, 0, tankMount);
    for (const at of autoTurrets) turrets.push(at);

    if (mainGunCount > 0 && autoTurrets.length > 0) {
      const hasLayer0Auto = autoTurrets.some((at: any) => at.turretType === 'auto' && (at.renderLayer ?? 0) === 0);
      if (hasLayer0Auto) {
        for (let gi = 0; gi < mainGunCount; gi++) {
          if ((turrets[gi].renderLayer ?? 0) === 0) {
            turrets[gi].renderLayer = 1;
          }
        }
      }
    }

    if ((flat as any).HAS_NO_RECOIL === true) {
      for (const t of turrets) {
        (t as any).knockback = 0;
        if ((t as any).autoSubTurrets) {
          for (const sub of (t as any).autoSubTurrets) sub.knockback = 0;
        }
      }
    }

    bodyLayersOut = buildSmasherBodyLayers(arrasTurrets, registry);
  }

  const skillCaps = buildSkillCaps((flat as any).SKILL_CAP);
  const preDefinedSkills = buildPreDefinedSkills(flat.SKILL);
  if (preDefinedSkills && Object.values(preDefinedSkills).some(v => v > 0)) {
    for (const k of Object.keys(skillCaps) as (keyof typeof skillCaps)[]) {
      if ((skillCaps as any)[k] > 9) { (skillCaps as any)[k] = 9; if (typeof preDefinedSkills[k as string] === 'number') preDefinedSkills[k as string] = Math.min(preDefinedSkills[k as string]!, 9); }
    }
  }
  const isBoss = kind === 'boss';
  const canEarnSkillPoints = !preDefinedSkills && !isBoss;

  const bonusSkillPoints = typeof (flat as any).EXTRA_SKILL === 'number'
    ? (flat as any).EXTRA_SKILL
    : (isBoss ? 0 : 42);

  const directFacingType = (rawClass as any)?.FACING_TYPE;
  const rawBaseSpinEnabled = Array.isArray(directFacingType) && directFacingType[0] === 'spin';
  const rawBaseSpinSpeed = rawBaseSpinEnabled && typeof directFacingType[1]?.speed === 'number'
    ? Math.round(Math.abs(directFacingType[1].speed) * ARRAS_SPIN_MULTIPLIER)
    : 50;
  const rawBaseSpinDirection: 1 | -1 = rawBaseSpinEnabled && typeof directFacingType[1]?.speed === 'number'
    ? (directFacingType[1].speed >= 0 ? 1 : -1)
    : 1;
  const baseSpinEnabled = layeredBaseSpin ? layeredBaseSpin.enabled : rawBaseSpinEnabled;
  const baseSpinSpeed = layeredBaseSpin ? layeredBaseSpin.speed : rawBaseSpinSpeed;
  const baseSpinDirection: 1 | -1 = layeredBaseSpin ? layeredBaseSpin.direction : rawBaseSpinDirection;

  const controllers = Array.isArray((flat as any).CONTROLLERS) ? (flat as any).CONTROLLERS : [];
  if (controllers.some((c: any) => (typeof c === 'string' ? c : (Array.isArray(c) ? c[0] : '')) === 'canRepel')) {
    for (const t of turrets) if ((t as any).autoSubTurrets && (t as any).autoSubTurrets.length > 0) (t as any).manualControl = true;
  }
  let cameraZoomEnabled = false;
  let cameraZoomDistance = 225;
  const useCustomAimDirection = true;
  let customAimAngle = 0;
  for (const c of controllers) {
    const name = typeof c === 'string' ? c : (Array.isArray(c) ? c[0] : '');
    const opts = Array.isArray(c) ? (c[1] ?? {}) : {};
    if (name === 'zoom') {
      cameraZoomEnabled = true;
      if (typeof opts.distance === 'number') cameraZoomDistance = opts.distance;
    }
    if (name === 'fixedDirection') {
      if (typeof opts.angle === 'number') customAimAngle = opts.angle;
    }
  }

  const displayName = (flat as any).NAME || flat.LABEL || camelToTitle(className);
  const colorDefault = isBoss ? '#a7a7af' : '#3ca4cb';
  const rawTankColor = (flat.COLOR === undefined || flat.COLOR === null || flat.COLOR === -1)
    ? colorDefault
    : getEntityColor(flat.COLOR, colorDefault);
  const tankColor = layeredTankColor ?? rawTankColor;

  const rawTankSides = typeof flat.SHAPE === 'number' ? Math.abs(flat.SHAPE) : 0;
  const tankSides = layeredTankSides ?? rawTankSides;
  const tankShapeDepth = layered.isLayered
    ? 0
    : ((typeof flat.SHAPE === 'number' && flat.SHAPE < 0)
        ? 6 / (Math.abs(flat.SHAPE) * Math.abs(flat.SHAPE))
        : 0);

  turrets = mergeRestoredLooks(turrets) as IstrongTurret[];
  const data: TankData = {
    _configVersion: 5,
    tankSides,
    tankShapeDepth,
    tankShapeCurved: false,
    tankSize: _measuredSIZE !== undefined ? convertTankSize(_measuredSIZE, true) : convertTankSize(flat.SIZE ?? 12, entityLevelsUp(flat as Record<string, unknown>)),
    tankColor,
    tankColorMap: bodySlot,
    keepOwnColor: isTeamDefaultColor(flat.COLOR) ? undefined : true,
    chargeAI: ['eliteGunner', 'deltaGunner', 'gunnerLegion'].includes(className) ? true : undefined,
    arenaCloserAI: className === 'arenaCloser' ? true : undefined,
    tankHP,
    tankBodyDamage: convertBodyDamage(body.DAMAGE ?? 3),
    tankMovementSpeed: convertDrivenSpeed(body.SPEED ?? 5.25, typeof body.ACCELERATION === 'number' ? body.ACCELERATION : 1.6),
    tankPushShare: convertPushShare(body.SPEED ?? 5.25, typeof body.ACCELERATION === 'number' ? body.ACCELERATION : 1.6),
    tankShieldRegen: convertShieldRegen(body.REGEN ?? 0.01),
    tankShieldCapacity: tankShield,
    fovMultiplier: convertFOV(body.FOV ?? 1.02),
    turrets,
    maxSkillPoints: 42,
    maxPointsPerSkill: 9,
    bonusSkillPoints,
    skillCaps,
    canEarnSkillPoints,
    preDefinedSkills,
    primaryTurretId: turrets.find(t => t.turretType !== 'decorative')?.id ?? null as any,
    useCustomAimDirection,
    customAimAngle,
    cameraZoomEnabled,
    cameraZoomDistance,
    mirrorMode: false,
    autoPlacement: false,
    autoPlacementCount: 2,
    snapPlacement: false,
    snapPlacementCount: 4,
    baseSpinEnabled,
    baseSpinSpeed,
    baseSpinDirection,
    tankPushability: convertPushability(body.PUSHABILITY),
    tankResistBase: typeof body.RESIST === 'number' && body.RESIST !== 1 ? body.RESIST : undefined,
    tankPenetrationBase: typeof body.PENETRATION === 'number' && body.PENETRATION !== 1.05 ? body.PENETRATION : undefined,
    globalMaxAliveEnabled: typeof (flat as any).MAX_CHILDREN === 'number' && (flat as any).MAX_CHILDREN > 0,
    globalMaxAlive: (flat as any).MAX_CHILDREN ?? 0,
    statNamesType: detectStatNamesType((flat as any).STAT_NAMES, className),
    isSmasher: (flat as any).IS_SMASHER ?? undefined,
    isHealer: (flat as any).HEALING_TANK ? true : undefined,

    ignoresWalls: (flat as any).ARENA_CLOSER === true ? true : undefined,
    showHealthBar: (flat as any).DRAW_HEALTH === false ? false : undefined,

    bodyLayers: bodyLayersOut.length > 0 ? bodyLayersOut : undefined,
  };

  const rawInvisible = (flat as any).INVISIBLE;
  if (Array.isArray(rawInvisible)) {
    (data as any).invisible = {
      fadeInRate: (rawInvisible[0] ?? 0.08) / 2,
      fadeOutRate: (rawInvisible[1] ?? 0.03) / 2,
    };
    if (alphaIsCapped((flat as any).ALPHA)) (data as any).invisible.always = true;
  } else if (!rawInvisible && alphaIsFixedBelowOne((flat as any).ALPHA)) {
    (data as any).invisible = { fadeInRate: 0.04, fadeOutRate: 0.015, always: true };
  }

  const arrasOnly = collectTankArrasOnly(rawClass);
  if (arrasOnly) data._arrasOnly = arrasOnly;

  applyExhaustRule(data, className, launcherFamilyOfRegistry(registry), isDreadnoughtV2Class(rawClass, registry));
  applyStartsLoadedRule(data, className, underseerFamilyOfRegistry(registry), makeBehavior);
  applyTankMeta(data as any, rawClass as any);

  return {
    version: '1.0.0',
    type: 'Tank',
    name: displayName,
    timestamp: Date.now(),
    category: kind === 'boss' ? 'Bosses' : 'Tanks',
    source: 'nexum-upload',
    data,
  };
}

export function convertArrasClassToExport(
  className: string,
  registry: Registry,
  warn?: WarningCollector,
): AnyIstrongEnvelope {
  const kind = classifyEntity(className, registry);
  if (kind === 'turret') return convertArrasClassToTurretPreset(className, registry, warn);
  if (kind === 'projectile') return convertArrasClassToCustomProjectile(className, registry, warn);
  return convertArrasClassToTank(className, registry, warn);
}
