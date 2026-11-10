export * from './types/arras.js';
export * from './types/istrong.js';
export * from './types/warnings.js';

export * from './constants/physics.js';
export * from './constants/gunStats.js';
export * from './constants/colors.js';
export * from './constants/projectileWhitelist.js';

export { WarningCollector } from './warnings/collector.js';

export {
  resolveColor,
  getEntityColor,
} from './forward/colorMapper.js';

export {
  convertRecoil,
  convertBulletSpeed,
  convertTankBarrelSpeed,
  convertReloadToBPS,
  convertDamage,
  convertBulletHealth,
  convertPenetration,
  convertLifetime,
  convertSpread,
  convertTankSize,
  entityLevelsUp,
  convertBodyHP,
  convertBodyDamage,
  convertMovementSpeed,
  convertDrivenSpeed,
  convertPushShare,
  convertShieldCapacity,
  convertShieldRegen,
  convertFOV,
  convertPushability,
  convertBarrelLength,
  convertBarrelWidth,
  convertBarrelX,
  convertBarrelY,
  convertBulletSize,
  computeTopSpeedRatio,
  convertGunStats,
  BODY_SPEED,
} from './forward/physicsCalibrator.js';

export {
  invertRecoil,
  invertBulletSpeed,
  invertTankBarrelSpeed,
  invertBPSToReload,
  invertDamage,
  invertBulletHealth,
  invertPenetration,
  invertLifetime,
  invertSpread,
  invertTankSize,
  invertBodyHP,
  invertBodyDamage,
  invertMovementSpeed,
  invertDrive,
  invertShieldCapacity,
  invertShieldRegen,
  invertFOV,
  invertPushability,
  invertBarrelLength,
  invertBarrelWidth,
  invertBarrelX,
  invertBarrelY,
  invertBulletSize,
  invertTopSpeedRatio,
  invertAutoTurretSize,
  invertSpinSpeed,
} from './reverse/physicsInverter.js';

export { invertColor } from './reverse/colorInverter.js';
export { invertSkills } from './reverse/skillInverter.js';
export { invertBody } from './reverse/bodyInverter.js';
export { invertTurrets, invertTurretsWithDependencies } from './reverse/turretInverter.js';
export {
  invertBehaviors,
  invertMotionType,
  invertFacingType,
  invertStatCalculator,
} from './reverse/behaviorInverter.js';
export { buildCpdClass } from './reverse/cpdInverter.js';
export { buildAutoTurretEntry } from './reverse/autoTurretInverter.js';
export { invertBodyLayers } from './reverse/bodyLayerInverter.js';
export { invertLayeredBoss } from './reverse/layeredBossInverter.js';

export { combineStats, weaponArray, ensureIsClass, makeConfigProxy } from './arras/helpers.js';
export { parseArrasUserCode, buildRegistryFromJson, detectClassesInPaste } from './arras/browserParser.js';
export type { ParseArrasResult } from './arras/browserParser.js';
export { resolveFlat, resolveField, classifyEntity, detectProjectileVisual } from './forward/classResolver.js';
export { mapBasicGun, resetTurretIdCounter, motionForVisual, facingForVisual, shapeForVisual, defaultBehaviors } from './forward/turretMapperBasic.js';
export { mapGuns, mapAutoTurrets, buildCustomProjectileDesign, buildSmasherBodyLayers } from './forward/turretMapperFull.js';
export {
  resetSharedTurretIds,
  nextSharedTurretId,
  resolveProjectileVisual,
  resolveControllers,
  resolveFacingTypeSpin,
  resolveField as resolveFieldOnRawClass,
  resolveBodyOverlayField,
} from './forward/turretMapperHelpers.js';
export { mapControllers, mapStatCalculator, mapMotionType, mapFacingType } from './forward/behaviorMapper.js';
export { convertArrasClassToExport, convertArrasClassToTank } from './forward/exportGeneratorBasic.js';
export { convertArrasClassToTurretPreset } from './forward/exportGeneratorTurretPreset.js';
export { convertArrasClassToCustomProjectile } from './forward/exportGeneratorCustomProjectile.js';
export { detectLayeredBoss } from './forward/layeredBossDetector.js';
export type { LayeredBossDetection, LayeredBossLayer } from './forward/layeredBossDetector.js';

export {
  convertTankToArras,
  convertPresetToArras,
  convertProjectileToArras,
  convertEnvelopeToArras,
  detectEnvelopeType,
  emitTankClass,
  buildReverseResult,
} from './reverse/index.js';

export { emitArrasJS, emitArrasJSBundle } from './emitters/jsEmitter.js';
export { emitArrasJSON, emitArrasJSONBundle } from './emitters/jsonEmitter.js';
export { bundleReverseResult } from './emitters/pairBundler.js';

export { buildOsaPack, osaPackFiles, shapeRecipe, shapeEntry, otherClasses, packClassName, OSA_PACK_NAME } from './osa/pack.js';
export type { OsaPack, PackInput, PackFile, PackGroupedFile, GameMenus, OsaShapeEntry, OsaMenu } from './osa/pack.js';
export { VIEWER_BODY, VIEWER_GUN, viewerGunFiring } from './reverse/viewerTank.js';
export { detectStatNamesType } from './forward/exportGeneratorBasic.js';
