import type { PosCatalogRow } from '../types';
import { queryKeys } from './keys';
import { useApiQuery } from './useApiQuery';

export function usePosCatalog() {
  return useApiQuery<PosCatalogRow[]>(queryKeys.posCatalog, '/pos/catalog', 15_000);
}
