/** Centralized React Query key factory — keeps invalidation call sites consistent. */
export const queryKeys = {
  session: ['session'] as const,
  dashboard: ['dashboard'] as const,
  booths: ['booths'] as const,
  boothDetail: (boothId: string) => ['booths', boothId] as const,
  myBooth: ['me', 'booth'] as const,
  warehouse: ['warehouse'] as const,
  posCatalog: ['pos', 'catalog'] as const,
  restockRequests: ['restock-requests'] as const,
  dailyLog: ['me', 'daily-log'] as const,
  recentSales: (limit: number) => ['sales', 'recent', limit] as const,
};
