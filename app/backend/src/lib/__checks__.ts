/**
 * Tiny pg-less sanity checks for the pure helpers (stock thresholds, today
 * window). No test framework — just `node:assert` so it runs with `tsx` and
 * adds no dependency. Run ad hoc with: `npx tsx src/lib/__checks__.ts`.
 * Not part of the production build (excluded by being unreferenced; safe to
 * keep — it only imports pure modules).
 */
import assert from 'node:assert/strict';
import { stockStatus, warehouseStatus, boothInventoryStatus } from './stock.js';
import { todayWindow } from './time.js';

// ── stockStatus thresholds (backend-final.md §3.5) ─────────────────────────
assert.equal(stockStatus(0, 20), 'out');
assert.equal(stockStatus(-5, 20), 'out');
assert.equal(stockStatus(20, 20), 'low');     // qty <= reorder
assert.equal(stockStatus(10, 20), 'low');
assert.equal(stockStatus(28, 20), 'watch');   // <= round(20*1.4)=28
assert.equal(stockStatus(29, 20), 'ok');
assert.equal(warehouseStatus(9, 18), 'low');  // mockup webcam: 9 qty, 18 reorder

// ── booth inventory status (proportional bands) ────────────────────────────
assert.equal(boothInventoryStatus(0, 50), 'out');
assert.equal(boothInventoryStatus(50, 50), 'ok');
assert.equal(boothInventoryStatus(5, 50), 'low');    // <= 20% of 50 = 10
assert.equal(boothInventoryStatus(18, 50), 'watch'); // <= 40% of 50 = 20

// ── todayWindow: 24h span, start < end, stable date string ─────────────────
const w = todayWindow('Africa/Lagos', new Date('2026-06-20T08:30:00Z'));
assert.equal(w.endUtc.getTime() - w.startUtc.getTime(), 24 * 60 * 60 * 1000);
assert.ok(w.startUtc < w.endUtc);
// Lagos is UTC+1 (no DST); local 2026-06-20 midnight = 2026-06-19T23:00:00Z.
assert.equal(w.startUtc.toISOString(), '2026-06-19T23:00:00.000Z');
assert.equal(w.localDate, '2026-06-20');

// A UTC instant that is still "yesterday" in Lagos maps to the prior day.
const w2 = todayWindow('Africa/Lagos', new Date('2026-06-20T00:30:00Z')); // 01:30 Lagos
assert.equal(w2.localDate, '2026-06-20');

console.log('[checks] all pure-helper assertions passed');
