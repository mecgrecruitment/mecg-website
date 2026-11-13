import { blankRow, parseRows, tables, type Parsed, type Row, type TableKey } from "./schema";
/** RFC4180-style text intake. No spreadsheet formulas or embedded code execute. */
export function readCsv(text: string): Parsed<string[][]> {
  if (new TextEncoder().encode(text).length > 600_000) return { ok: false, error: "CSV import is limited to 600 KB." };
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  const value = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quoted) {
      if (c === '"') { if (value[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += c;
    } else if (c === '"') {
      if (cell || closed) return { ok: false, error: "A CSV quote must begin a field. Use doubled quotes inside quoted text." };
      quoted = true;
    } else if (c === ",") { row.push(cell); cell = ""; closed = false; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && value[i + 1] === "\n") i++;
      row.push(cell); if (row.some(v => v !== "")) rows.push(row); row = []; cell = ""; closed = false;
    } else { if (closed) return { ok: false, error: "Unexpected text after a closing CSV quote." }; cell += c; }
  }
  if (quoted) return { ok: false, error: "CSV has an unclosed quoted field." };
  row.push(cell); if (row.some(v => v !== "")) rows.push(row);
  return { ok: true, value: rows };
}
export function importCsv(table: TableKey, text: string, existing: Row[]): Parsed<Row[]> {
  const parsed = readCsv(text); if (!parsed.ok) return parsed;
  const [header, ...data] = parsed.value;
  if (!header || !data.length) return { ok: false, error: "CSV needs a header and at least one data row." };
  const fields = tables[table].fields;
  const keys = header.map(h => fields.find(f => f.key.toLowerCase() === h.trim().toLowerCase() || f.label.toLowerCase() === h.trim().toLowerCase())?.key);
  if (keys.some(k => !k) || new Set(keys).size !== keys.length) return { ok: false, error: "Use unique CSV headers from this register's template; unknown columns are not imported." };
  const used = new Set(existing.map(r => r.id)); let sequence = 1; const rows: Row[] = [];
  for (const cells of data) {
    if (cells.length !== header.length) return { ok: false, error: `CSV row ${rows.length + 2} has a different number of fields from the header.` };
    const row = blankRow(table);
    keys.forEach((key, i) => { if (key) row[key] = cells[i]; });
    if (!row.id.trim()) { while (used.has(`${table}-import-${sequence}`)) sequence++; row.id = `${table}-import-${sequence++}`; }
    used.add(row.id); rows.push(row);
  }
  return parseRows(table, [...existing, ...rows]);
}
export function csvTemplate(table: TableKey): string { return tables[table].fields.map(f => f.key).join(",") + "\n"; }
