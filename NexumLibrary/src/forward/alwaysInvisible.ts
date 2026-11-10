export function alphaIsCapped(alpha: unknown): boolean {
  if (!Array.isArray(alpha)) return false;
  const max = alpha[1];
  return typeof max === 'number' && max > 0 && max < 1;
}

export function alphaIsFixedBelowOne(alpha: unknown): boolean {
  return typeof alpha === 'number' && alpha > 0 && alpha < 1;
}

export const ALWAYS_INVISIBLE_ARRAS_CAP = 0.2;
