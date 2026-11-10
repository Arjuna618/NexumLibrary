import type { IstrongTurret } from '../types/istrong.js';
import type { ArrasClassEmit, ArrasGunEmit } from '../types/warnings.js';
import type { WarningCollector } from '../warnings/collector.js';
import { invertAutoTurretSize, invertSpinSpeed, invertBarrelX, invertBarrelY } from './physicsInverter.js';
import { arrasColorOf } from './colorInverter.js';
import { emitTurretMeta } from './istrongMetaEmitter.js';
import { ISTRONG_AUTO_KEY, AUTO_FIELDS } from '../types/istrongMeta.js';

export interface InvertedAutoTurret {
  arrasTurret: { POSITION: number[]; TYPE: string; [key: string]: any };
  childClass?: ArrasClassEmit;
}

const CROSS_TURRET = { POSITION: [13, 0, 0, 0, 360, 1], TYPE: 'healerHat' };

function autoBaseShape(sides: number, depthIn: unknown): number[][] {
  const n = Math.floor(sides);
  const depth = typeof depthIn === 'number' && depthIn > 0 ? Math.min(1, depthIn) : 0;
  const turn = n >= 4 && n % 2 === 0 ? -Math.PI / n : 0;
  const pts: number[][] = [];
  const m = depth > 0 ? 2 * n : n;
  for (let i = 0; i < m; i++) {
    const a = turn + (2 * Math.PI * i) / m, r = depth > 0 && i % 2 ? 1 - depth : 1;
    pts.push([+(r * Math.cos(a)).toFixed(4), +(r * Math.sin(a)).toFixed(4)]);
  }
  return pts;
}

export function buildAutoTurretEntry(
  turret: IstrongTurret,
  parentTankName: string,
  turretIndex: number,
  warn: WarningCollector,
  mount: number | null,
  inner: (turrets: IstrongTurret[], parentName: string, warn: WarningCollector) => { GUNS: ArrasGunEmit[]; TURRETS: any[] },
  above: boolean = (turret as any).aboveTankBody === true,
  k: number = 1,
  onRound: boolean = false,
): InvertedAutoTurret {
  const sizeRatio = invertAutoTurretSize(turret.autoCircleSize ?? 25);
  const angle = turret.angle ?? 0;
  const bx = invertBarrelX(turret.xOffset ?? 0);
  const by = invertBarrelY(turret.yOffset ?? 0);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const arrasX = bx * cosA + by * sinA;
  const arrasY = -bx * sinA + by * cosA;
  const arrasAngleDeg = angle * 180 / Math.PI;
  const fov = turret.fov ?? 200;

  const sight = typeof mount === 'number' && mount > 0 && typeof turret.fovSize === 'number' && turret.fovSize > 0
    ? turret.fovSize * 60 / (275 * Math.sqrt(mount * sizeRatio / 20)) : undefined;

  const subTurrets = Array.isArray(turret.autoSubTurrets) ? turret.autoSubTurrets : [];
  const typeName = `${parentTankName}AutoTurret${turretIndex}`;
  const innerResult = inner(subTurrets as IstrongTurret[], typeName, warn);

  const childClass: ArrasClassEmit = {
    className: typeName,
    PARENT: 'autoTurret',
    LABEL: typeName,
    GUNS: innerResult.GUNS,
  };
  const turrets: any[] = [...innerResult.TURRETS];
  if (sight !== undefined) childClass.BODY = { FOV: sight };
  if ((turret as any).fireWithTank === true) childClass.FIRE_WITH_MASTER = true;

  if ((turret as any).autoCircleColorMatch) childClass.COLOR = 'mirror';
  else if (typeof (turret as any).colorMap === 'number') childClass.COLOR = arrasColorOf((turret as any).color, (turret as any).colorMap, warn);
  const sides = (turret as any).autoCircleBaseSides;
  if (typeof sides === 'number' && sides >= 3) childClass.SHAPE = autoBaseShape(sides, (turret as any).autoCircleBaseDepth);
  if ((turret as any).autoCircleHidden) {
    childClass.BORDERLESS = true;
    childClass.DRAW_FILL = false;
  } else if ((turret as any).autoCircleHealer) turrets.push({ ...CROSS_TURRET });
  if (turrets.length > 0) childClass.TURRETS = turrets;

  const spin = (turret as any).autoCircleSpin;
  const spinSpeed = (turret as any).autoCircleSpinSpeed;
  const spinDir = (turret as any).autoCircleSpinDirection;
  const spinMode = (turret as any).autoCircleSpinMode;
  const fixedOn = (turret as any).autoCircleFixed === true;
  const spinning = !!spin && typeof spinSpeed === 'number';
  if (spinning && spinMode !== 'withBody') {
    childClass.FACING_TYPE = ['spin', { speed: invertSpinSpeed(spinSpeed) * (spinDir === -1 ? -1 : 1) }];
  }
  const welded = (spinning && spinMode === 'withBody') || fixedOn;
  if (welded) {
    childClass.CONTROLLERS = [];
    childClass.MIRROR_MASTER_ANGLE = true;
  }
  for (const g of childClass.GUNS ?? []) {
    if (!g.PROPERTIES || !g.PROPERTIES.TYPE) continue;
    if (spinning || fixedOn) g.PROPERTIES.AUTOFIRE = true;
    else delete g.PROPERTIES.AUTOFIRE;
  }

  if ((turret as any).aura === true) {
    if (onRound) warn.info('aura', 'A ring on a round is sized by its tank in OSA: not converted.', { original: 'aura on a round' });
    else {
      const t = turret as any;
      const heal = t.auraType === 'heal';
      const size = typeof t.auraSize === 'number' && t.auraSize > 0 ? t.auraSize : 3;
      const strength = typeof t.auraStrength === 'number' && t.auraStrength >= 0 ? t.auraStrength : 1;
      const opacity = typeof t.auraOpacity === 'number' && t.auraOpacity >= 0 ? Math.min(1, t.auraOpacity) : 0.3;
      (childClass.GUNS ??= []).push({
        POSITION: [0, 20, 1, 0, 0, 0, 0],
        PROPERTIES: {
          SHOOT_SETTINGS: { reload: 0.001, recoil: 0.001, shudder: 0.001, size: 6, health: 1, damage: heal ? -strength : strength, pen: 1, speed: 0.001, maxSpeed: 0.001, range: 1, density: 1, spray: 0.001, resist: 1 },
          TYPE: [heal ? 'healAura' : 'aura', { COLOR: heal ? 'red' : 'blue', ALPHA: opacity, CONTROLLERS: [['scaleWithMaster', { ratio: +(size / k).toFixed(6) }]] }],
          MAX_CHILDREN: 1,
          AUTOFIRE: true,
          SYNCS_SKILLS: true,
          ALPHA: 0,
          BORDERLESS: true,
          DRAW_FILL: false,
        },
      } as ArrasGunEmit);
    }
  }

  if ((turret as any).manualControl === true) {
    if (!childClass.CONTROLLERS) childClass.CONTROLLERS = ['canRepel', 'mapAltToFire', 'onlyAcceptInArc', 'nearestDifferentMaster'];
  } else childClass.INDEPENDENT = true;

  const own: Record<string, any> = {};
  for (const f of AUTO_FIELDS) if ((turret as any)[f] !== undefined) own[f] = (turret as any)[f];
  (childClass as any)[ISTRONG_AUTO_KEY] = own;

  const arrasTurret: { POSITION: number[]; TYPE: any; [key: string]: any } = {
    POSITION: [sizeRatio, arrasX, arrasY, arrasAngleDeg, fov, above ? 1 : 0],
    TYPE: typeName,
  };
  emitTurretMeta(arrasTurret, turret);

  return {
    arrasTurret,
    childClass,
  };
}
