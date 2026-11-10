import type { TankData } from '../types/istrong.js';
import type { WarningCollector } from '../warnings/collector.js';
import {
  invertBodyHP,
  invertBodyDamage,
  invertDrive,
  invertShieldCapacity,
  invertShieldRegen,
  invertFOV,
  invertPushability,
  invertTankSize,
} from './physicsInverter.js';
import { touchShareOf } from './turretInverter.js';

export interface InvertedBody {
  BODY: Record<string, number>;
  SIZE?: number;
  SHAPE?: number;
  COLOR?: any;
  LEVEL?: number;
  HEALTH_WITH_LEVEL?: boolean;
}

export function invertBody(tank: TankData, isBoss: boolean, warn: WarningCollector): InvertedBody {
  const touch = touchShareOf(tank.tankTouchScale);
  const hpResult = invertBodyHP(tank.tankHP, isBoss, warn);
  const shieldResult = invertShieldCapacity(tank.tankShieldCapacity, isBoss, warn);

  const drive = invertDrive(tank.tankMovementSpeed, tank.tankPushShare);
  const body: Record<string, number> = {
    DAMAGE: invertBodyDamage(tank.tankBodyDamage),
    SPEED: drive.speed,
    HEALTH: hpResult.health,
    SHIELD: shieldResult.shield,
    REGEN: invertShieldRegen(tank.tankShieldRegen),
    FOV: invertFOV(tank.fovMultiplier) / Math.pow(touch, 0.65),
  };

  if (drive.acceleration !== undefined) {
    body.ACCELERATION = drive.acceleration;
  }
  if (typeof tank.tankResistBase === 'number' && tank.tankResistBase !== 1) {
    body.RESIST = tank.tankResistBase;
  }
  if (typeof tank.tankPenetrationBase === 'number' && tank.tankPenetrationBase !== 1.05) {
    body.PENETRATION = tank.tankPenetrationBase;
  }

  const push = invertPushability(tank.tankPushability);
  if (push !== undefined && push !== 0.2) {
    body.PUSHABILITY = push;
  }

  const result: InvertedBody = {
    BODY: body,
    SIZE: Math.round(invertTankSize(tank.tankSize) * touch * 100) / 100,
    SHAPE: tank.tankSides,
  };

  if (hpResult.healthWithLevel) {
    result.HEALTH_WITH_LEVEL = true;
  }
  if (hpResult.level !== undefined) {
    result.LEVEL = hpResult.level;
  }

  return result;
}
