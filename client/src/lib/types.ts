/**
 * Shared API DTOs — mirror backend-final.md §3 verbatim (field names, nullability,
 * status enums). This is the contract; the backend doesn't exist yet, so these
 * types ARE the source of truth for what the client assumes it's talking to.
 *
 * Money: integer minor units, fields end in `Minor`. Timestamps: ISO-8601 UTC strings.
 */

export type Role = 'owner' | 'staff';

export type StockStatus = 'out' | 'low' | 'watch' | 'ok';

export type RestockStatus = 'pending' | 'fulfilled' | 'rejected';

export interface BoothRef {
  id: string;
  code: string;
  name: string;
  location: string;
}

export interface AccountPrefs {
  notifyLowStock: boolean;
  notifyDailySummary: boolean;
}

export interface ExpoRef {
  id: string;
  name: string;
  currency: string; // ISO 4217, e.g. "NGN"
  startsOn: string; // date
  endsOn: string; // date
}

export interface AccountDTO {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  phone: string | null;
  booth: BoothRef | null; // null for owner
  prefs: AccountPrefs;
  expo: ExpoRef;
}

// ---------- Dashboard (owner) ----------

export interface DashboardKpis {
  revenueTodayMinor: number;
  unitsSoldToday: number;
  activeBooths: number;
  warehouseLowCount: number;
}

export interface BoothSeriesBooth {
  boothId: string;
  code: string;
  color?: string;
}

export interface BoothSeriesPoint {
  saleSeq: number;
  cumulativeByBooth: Record<string, number>;
}

export interface BoothSeries {
  booths: BoothSeriesBooth[];
  points: BoothSeriesPoint[];
}

export interface SalesByBoothRow {
  boothId: string;
  code: string;
  name: string;
  staffName: string;
  revenueMinor: number;
  units: number;
  txnCount: number;
}

export interface TopProductRow {
  productId: string;
  name: string;
  units: number;
  revenueMinor: number;
}

export interface RecentSaleRow {
  id: string;
  displayId: string;
  boothId: string;
  boothCode: string;
  units: number;
  totalMinor: number;
  soldAt: string;
}

export interface DashboardDTO {
  kpis: DashboardKpis;
  boothSeries: BoothSeries;
  salesByBooth: SalesByBoothRow[];
  topProducts: TopProductRow[];
  recentSales: RecentSaleRow[];
}

// ---------- Booths (owner) ----------

export interface BoothListRow {
  id: string;
  code: string;
  name: string;
  location: string;
  staffName: string;
  revenueMinor: number;
  units: number;
  txnCount: number;
  topProductName: string | null;
  lowLineCount: number;
}

export interface SaleLineItem {
  productId: string;
  name: string;
  qty: number;
  unitPriceMinor: number;
}

export interface TransactionRow {
  id: string;
  displayId: string;
  soldAt: string;
  items: SaleLineItem[];
  totalMinor: number;
}

export interface BoothInventoryRow {
  productId: string;
  name: string;
  sku: string;
  allocatedQty: number;
  soldQty: number;
  remaining: number;
  // Server always populates this now (server/src/domain/booths.ts ->
  // boothInventoryStatus, proportional to allocatedQty: 20%/40% bands).
  // Previously optional while backend-final.md §11's open item #1 was
  // unresolved; backend has since closed that gap, so this is required.
  status: StockStatus;
}

export interface BoothSummary {
  revenueMinor: number;
  txnCount: number;
  units: number;
  avgSaleMinor: number;
}

export interface BoothDetailDTO {
  booth: { id: string; code: string; name: string; location: string; staffName: string };
  summary: BoothSummary;
  productBreakdown: TopProductRow[];
  transactions: TransactionRow[];
  inventory: BoothInventoryRow[];
}

// ---------- Warehouse ----------

export interface WarehouseRow {
  productId: string;
  name: string;
  sku: string;
  category: string;
  warehouseQty: number;
  allocatedTotal: number;
  soldTotal: number;
  reorderPoint: number;
  status: StockStatus;
}

export interface ReceiveStockResponse {
  productId: string;
  warehouseQty: number;
}

// ---------- POS / checkout (staff) ----------

export interface PosCatalogRow {
  productId: string;
  name: string;
  sku: string;
  category: string;
  priceMinor: number;
  remaining: number;
}

export interface CheckoutItemReq {
  productId: string;
  qty: number;
}

export interface CheckoutResponse {
  id: string;
  displayId: string;
  boothId: string;
  totalMinor: number;
  soldAt: string;
  items: SaleLineItem[];
}

// ---------- Restock ----------

export interface RestockRequestRow {
  id: string;
  boothCode: string;
  productName: string;
  requestedQty: number;
  status: RestockStatus;
  createdAt: string;
  resolvedQty: number | null;
  resolvedAt: string | null;
}

export interface CreateRestockResponse {
  id: string;
  productId: string;
  boothId: string;
  requestedQty: number;
  status: 'pending';
  createdAt: string;
}

export interface FulfillRestockResponse {
  id: string;
  status: 'fulfilled';
  resolvedQty: number;
}

// ---------- Daily log (staff) ----------

export interface DailyLogDTO {
  summary: BoothSummary;
  productBreakdown: TopProductRow[];
  transactions: TransactionRow[];
}

// ---------- Account settings ----------

export interface UpdateProfileReq {
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface UpdatePasswordReq {
  currentPassword: string;
  newPassword: string;
}

export interface UpdatePrefsReq {
  notifyLowStock?: boolean;
  notifyDailySummary?: boolean;
}

export interface UpdatePrefsResponse {
  prefs: AccountPrefs;
}

// ---------- Error envelope ----------

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}
