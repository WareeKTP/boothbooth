/**
 * Dev-only seed (backend-final.md §6, infra open item). Reproduces the mockup's
 * expo/booths/products/sample sales from design-reference/data.js, adapted to the
 * real schema:
 *   - assigns a currency (NGN — the data is Lagos-region; the mockup's ฿ symbol
 *     was a known mockup inconsistency, resolved by data-driven currency)
 *   - generates display_ids via the sale_sequences mechanism (starts at 1042,
 *     matching the mockup's first receipt S-1042)
 *   - creates one owner + one staff account per booth (password: "password123")
 *   - replays the ~18 seed sales through the real checkout path so derived
 *     sold/remaining and totals are internally consistent.
 *
 * Idempotent-ish: wipes app data first so re-running gives a clean known state.
 * NEVER run against production data. Run with `npm run seed`.
 */
import { closePool, query, withTransaction } from './pool.js';
import { executeCheckout } from '../domain/pos.js';
import { hashPassword } from '../lib/password.js';

const CURRENCY = 'NGN';
const SEED_PASSWORD = 'password123';

interface SeedBooth { code: string; name: string; loc: string; staff: string; user: string }
const BOOTHS: SeedBooth[] = [
  { code: 'A1', name: 'Booth A1', loc: 'Hall A · Aisle 2', staff: 'Ngozi Eze', user: 'ngozi' },
  { code: 'B3', name: 'Booth B3', loc: 'Hall B · Aisle 5', staff: 'Tunde Bello', user: 'tunde' },
  { code: 'C2', name: 'Booth C2', loc: 'Hall C · Aisle 1', staff: 'Amara Okafor', user: 'amara' },
];

interface SeedProduct {
  key: string; name: string; sku: string; cat: string;
  price: number; warehouse: number; reorder: number; alloc: Record<string, number>;
}
const PRODUCTS: SeedProduct[] = [
  { key: 'p1', name: 'Wireless Earbuds Pro', sku: 'GAD-EB-PRO', cat: 'Audio', price: 28500, warehouse: 120, reorder: 40, alloc: { A1: 50, B3: 40, C2: 45 } },
  { key: 'p2', name: 'Power Bank 20000mAh', sku: 'GAD-PB-20K', cat: 'Power', price: 19900, warehouse: 80, reorder: 30, alloc: { A1: 40, B3: 35, C2: 30 } },
  { key: 'p3', name: 'Bluetooth Speaker Mini', sku: 'GAD-SP-MIN', cat: 'Audio', price: 15500, warehouse: 26, reorder: 25, alloc: { A1: 30, B3: 28, C2: 24 } },
  { key: 'p4', name: 'Smartwatch Lite', sku: 'GAD-SW-LIT', cat: 'Wearable', price: 42000, warehouse: 34, reorder: 20, alloc: { A1: 25, B3: 22, C2: 20 } },
  { key: 'p5', name: 'USB-C Fast Cable 2m', sku: 'GAD-CB-USC', cat: 'Cables', price: 4500, warehouse: 240, reorder: 60, alloc: { A1: 90, B3: 80, C2: 85 } },
  { key: 'p6', name: 'Phone Stand Aluminium', sku: 'GAD-ST-ALU', cat: 'Accessory', price: 6900, warehouse: 60, reorder: 30, alloc: { A1: 35, B3: 30, C2: 40 } },
  { key: 'p7', name: 'Laptop Sleeve 14"', sku: 'GAD-SL-14', cat: 'Accessory', price: 12500, warehouse: 18, reorder: 20, alloc: { A1: 22, B3: 20, C2: 18 } },
  { key: 'p8', name: 'Desk Lamp LED', sku: 'GAD-DL-LED', cat: 'Home', price: 17800, warehouse: 44, reorder: 20, alloc: { A1: 20, B3: 18, C2: 16 } },
  { key: 'p9', name: 'Mechanical Keyboard', sku: 'GAD-KB-MEC', cat: 'Computing', price: 54000, warehouse: 22, reorder: 15, alloc: { A1: 18, B3: 14, C2: 16 } },
  { key: 'p10', name: 'Webcam 1080p', sku: 'GAD-WC-108', cat: 'Computing', price: 23000, warehouse: 9, reorder: 18, alloc: { A1: 16, B3: 15, C2: 14 } },
];

// Seed sales: [boothCode, items[[productKey, qty]]]. display_ids are reassigned
// sequentially by the real sale_sequences mechanism (so they come out S-1042+).
const SALES: Array<{ booth: string; items: Array<[string, number]> }> = [
  { booth: 'A1', items: [['p1', 1], ['p5', 2]] },
  { booth: 'B3', items: [['p4', 1]] },
  { booth: 'C2', items: [['p2', 1], ['p6', 1]] },
  { booth: 'A1', items: [['p1', 2]] },
  { booth: 'C2', items: [['p9', 1], ['p5', 1]] },
  { booth: 'B3', items: [['p3', 1], ['p5', 3]] },
  { booth: 'A1', items: [['p7', 1], ['p6', 2]] },
  { booth: 'B3', items: [['p2', 2]] },
  { booth: 'C2', items: [['p1', 1], ['p8', 1]] },
  { booth: 'A1', items: [['p4', 1], ['p5', 1]] },
  { booth: 'C2', items: [['p10', 1]] },
  { booth: 'B3', items: [['p1', 1], ['p3', 1], ['p5', 2]] },
  { booth: 'A1', items: [['p2', 1]] },
  { booth: 'C2', items: [['p4', 1], ['p6', 1]] },
  { booth: 'B3', items: [['p9', 1]] },
  { booth: 'A1', items: [['p1', 1], ['p2', 1], ['p5', 1]] },
  { booth: 'C2', items: [['p7', 1]] },
  { booth: 'B3', items: [['p1', 2], ['p6', 1]] },
];

async function wipe(): Promise<void> {
  // Order respects FKs. TRUNCATE CASCADE keeps it simple for a dev reset.
  await query(`TRUNCATE
    idempotency_keys, sessions, restock_requests, sale_items, sales,
    sale_sequences, allocations, products, accounts, booths, expos
    RESTART IDENTITY CASCADE`);
}

async function seed(): Promise<void> {
  console.log('[seed] wiping app data...');
  await wipe();

  const pwHash = await hashPassword(SEED_PASSWORD);

  await withTransaction(async (client) => {
    // ── Expo ──────────────────────────────────────────────────────────────
    const expoRes = await client.query<{ id: string }>(
      `INSERT INTO expos (name, currency, starts_on, ends_on)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Lagos Tech & Lifestyle Expo', CURRENCY, '2026-06-18', '2026-06-20'],
    );
    const expoId = expoRes.rows[0]!.id;

    // sale_sequences row (starts at 1042, matching the mockup's S-1042 feel).
    await client.query('INSERT INTO sale_sequences (expo_id, next_seq) VALUES ($1, 1042)', [expoId]);

    // ── Booths + staff accounts ───────────────────────────────────────────
    const boothIdByCode: Record<string, string> = {};
    const staffIdByCode: Record<string, string> = {};
    for (const b of BOOTHS) {
      const bRes = await client.query<{ id: string }>(
        `INSERT INTO booths (expo_id, code, name, location) VALUES ($1, $2, $3, $4) RETURNING id`,
        [expoId, b.code, b.name, b.loc],
      );
      const boothId = bRes.rows[0]!.id;
      boothIdByCode[b.code] = boothId;

      const aRes = await client.query<{ id: string }>(
        `INSERT INTO accounts (expo_id, role, full_name, email, phone, password_hash, booth_id)
         VALUES ($1, 'staff', $2, $3, $4, $5, $6) RETURNING id`,
        [expoId, b.staff, `${b.user}@boothbooth.dev`, null, pwHash, boothId],
      );
      staffIdByCode[b.code] = aRes.rows[0]!.id;
    }

    // ── Owner account ─────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO accounts (expo_id, role, full_name, email, phone, password_hash, booth_id)
       VALUES ($1, 'owner', $2, $3, $4, $5, NULL)`,
      [expoId, 'Expo Owner', 'owner@boothbooth.dev', '+2348000000000', pwHash],
    );

    // ── Products ──────────────────────────────────────────────────────────
    const productIdByKey: Record<string, string> = {};
    for (const p of PRODUCTS) {
      const pRes = await client.query<{ id: string }>(
        `INSERT INTO products (expo_id, name, sku, category, price_minor, warehouse_qty, reorder_point)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [expoId, p.name, p.sku, p.cat, p.price, p.warehouse, p.reorder],
      );
      productIdByKey[p.key] = pRes.rows[0]!.id;
    }

    // ── Allocations ───────────────────────────────────────────────────────
    for (const p of PRODUCTS) {
      for (const [code, qty] of Object.entries(p.alloc)) {
        await client.query(
          `INSERT INTO allocations (booth_id, product_id, allocated_qty) VALUES ($1, $2, $3)`,
          [boothIdByCode[code], productIdByKey[p.key], qty],
        );
      }
    }

    // ── Sales (through the real checkout path) ────────────────────────────
    for (const s of SALES) {
      const boothId = boothIdByCode[s.booth]!;
      const accountId = staffIdByCode[s.booth]!;
      const items = s.items.map(([key, qty]) => ({ productId: productIdByKey[key]!, qty }));
      await executeCheckout(client, { expoId, boothId, accountId, items });
    }

    console.log(`[seed] expo=${expoId} booths=${BOOTHS.length} products=${PRODUCTS.length} sales=${SALES.length}`);
  });

  console.log('[seed] done. Logins (password "password123"): owner@boothbooth.dev, ngozi@boothbooth.dev, tunde@boothbooth.dev, amara@boothbooth.dev');
}

seed()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('[seed] failed:', err);
    await closePool();
    process.exit(1);
  });
