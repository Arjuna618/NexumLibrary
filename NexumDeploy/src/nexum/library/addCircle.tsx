import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AddCircleIcon } from '@hugeicons/core-free-icons';

export const AddCircle: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <HugeiconsIcon icon={AddCircleIcon} size={size} strokeWidth={Math.max(1.5, (1.25 * 24) / size)}
    className={className ? `k-svg ${className}` : 'k-svg'} style={{ ['--k-ico' as string]: size } as React.CSSProperties} />
);
