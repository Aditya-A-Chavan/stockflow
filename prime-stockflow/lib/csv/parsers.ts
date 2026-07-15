import Papa from "papaparse";

export type CsvRow = Record<string, string>;

/** Strip UTF-8 BOM if present. */
export function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

export function normalizeHeader(h: string): string {
  return h.trim().replace(/^"|"$/g, "").toLowerCase();
}

export function parseCsvText(text: string): CsvRow[] {
  const cleaned = stripBom(text);
  const result = Papa.parse<CsvRow>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? "CSV parse error");
  }

  return result.data;
}

export function requireColumns(
  rows: CsvRow[],
  columns: string[],
  aliases: Record<string, string[]> = {}
): void {
  if (rows.length === 0) {
    throw new Error("CSV file is empty");
  }

  const headers = new Set(Object.keys(rows[0] ?? {}));

  for (const col of columns) {
    const alts = aliases[col] ?? [];
    const found = headers.has(col) || alts.some((a) => headers.has(a));
    if (!found) {
      throw new Error(`Missing required column: ${col}`);
    }
  }
}

export function getCell(row: CsvRow, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== "") return String(val).trim();
  }
  return "";
}

/** Last-row-wins dedup by key within a file. */
export function lastRowWins<T>(rows: T[], keyFn: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = keyFn(row);
    if (key) map.set(key, row);
  }
  return Array.from(map.values());
}
