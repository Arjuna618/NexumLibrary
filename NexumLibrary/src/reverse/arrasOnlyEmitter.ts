export function emitTankArrasOnly(
  classDef: Record<string, any>,
  arrasOnly: Record<string, any> | undefined,
): void {
  if (!arrasOnly || typeof arrasOnly !== 'object') return;
  for (const [key, value] of Object.entries(arrasOnly)) {
    if (key === 'BODY') {
      if (!value || typeof value !== 'object') continue;
      if (!classDef.BODY) classDef.BODY = {};
      for (const [bk, bv] of Object.entries(value)) {
        if (classDef.BODY[bk] === undefined) {
          classDef.BODY[bk] = bv;
        }
      }
      continue;
    }
    classDef[key] = value;
  }
}

export function emitGunArrasOnly(
  properties: Record<string, any>,
  arrasOnly: Record<string, any> | undefined,
): void {
  if (!arrasOnly || typeof arrasOnly !== 'object') return;
  for (const [key, value] of Object.entries(arrasOnly)) {
    properties[key] = value;
  }
}

export function emitProjectileArrasOnly(
  classDef: Record<string, any>,
  arrasOnly: Record<string, any> | undefined,
): void {
  emitTankArrasOnly(classDef, arrasOnly);
}
