import type { ReactNode } from 'react';
import { createLocalStorageContext } from './createLocalStorageContext';

export type Density = 'compact' | 'regular' | 'comfy';

const isDensity = (v: string): v is Density => v === 'compact' || v === 'regular' || v === 'comfy';

const densityCtx = createLocalStorageContext<Density>('bb-density', 'density', 'regular');

export function DensityProvider({ children }: { children: ReactNode }) {
  return <densityCtx.Provider isValid={isDensity}>{children}</densityCtx.Provider>;
}

export function useDensity() {
  const [density, setDensity] = densityCtx.useValue();
  return { density, setDensity };
}
