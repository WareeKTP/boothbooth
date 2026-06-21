/**
 * Money is always integer minor units server-side (backend-final.md §2/§4.2).
 * Currency is data-driven from `expo.currency` (ISO 4217) — never hardcoded,
 * never a module-level constant. See frontend-final.md §9.
 */
export function formatMoney(minorUnits: number, currencyCode: string, locale = navigator.language): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(minorUnits / 100);
}

/**
 * Compact form for chart axis labels (e.g. "₦12.5k"), mirrors the mockup's
 * `fmtK` but still currency-aware via Intl rather than a hardcoded symbol.
 */
export function formatMoneyCompact(minorUnits: number, currencyCode: string, locale = navigator.language): string {
  const value = minorUnits / 100;
  if (Math.abs(value) < 1000) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(value);
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
