/**
 * Tiny client-only CSV export — no backend endpoint exists for this
 * (backend-final.md §3.9 has no export route, today-only daily log is v1
 * scope), and no new dependency is justified for "build a CSV string and
 * download it." Replaces a fake demo-toast stub on Daily Log's "Export day"
 * button that didn't actually produce a file — PRODUCT.md's calm/trustworthy
 * principle means a button either does the real thing or doesn't exist.
 */

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return lines.join('\r\n');
}

/** Triggers a browser download of `content` as `filename` — no server round-trip. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
