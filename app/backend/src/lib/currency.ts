/**
 * Minimal ISO-4217 validation (backend-final.md §4.2). We only need to reject
 * garbage on the rare currency-write path (seed/admin). A full code table is
 * overkill; validate shape + a curated common-currency allowlist, with an env
 * escape hatch avoided per YAGNI. Money is always integer minor units; the
 * server never formats currency.
 */

// Common ISO-4217 codes likely for an expo. Extend if a real expo needs more.
const KNOWN_CURRENCIES = new Set([
  'NGN', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'ZAR', 'KES', 'GHS',
  'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'AED', 'SAR', 'THB', 'BRL',
  'MXN', 'SGD', 'HKD', 'NZD', 'PLN', 'TRY', 'EGP', 'MAD', 'XOF', 'XAF',
]);

export function isValidCurrency(code: string): boolean {
  return /^[A-Z]{3}$/.test(code) && KNOWN_CURRENCIES.has(code);
}
