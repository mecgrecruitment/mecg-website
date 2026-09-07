type GroupCaseCriterion = {
  id: string;
  key: string;
  name: string;
  weight: number;
  required: boolean;
  position: number;
};

type GroupCaseBackupRow = {
  groupId: string | null;
  groupName: string;
  assignmentId: string | null;
  evaluatorId: string | null;
  evaluatorName: string;
  applicationId: string;
  applicantName: string;
  status: string;
};

export type GroupCaseBackup = {
  fileId: string;
  cycleId: string;
  cycleName: string;
  roundId: string;
  roundName: string;
  rubricVersion: number;
  exportedAt: string;
  criteria: GroupCaseCriterion[];
  rows: GroupCaseBackupRow[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function parseGroupCaseBackup(value: unknown): GroupCaseBackup | null {
  const input = record(value);
  if (!input
    || typeof input.fileId !== "string"
    || typeof input.cycleId !== "string"
    || typeof input.cycleName !== "string"
    || typeof input.roundId !== "string"
    || typeof input.roundName !== "string"
    || !Number.isInteger(input.rubricVersion)
    || typeof input.exportedAt !== "string"
    || !Array.isArray(input.criteria)
    || !Array.isArray(input.rows)
    || input.criteria.length < 1
    || input.criteria.length > 20
    || input.rows.length > 5000) return null;

  const criteria = input.criteria.flatMap((value): GroupCaseCriterion[] => {
    const criterion = record(value);
    if (!criterion
      || typeof criterion.id !== "string"
      || typeof criterion.key !== "string"
      || !/^[a-z][a-z0-9_]*$/.test(criterion.key)
      || typeof criterion.name !== "string"
      || typeof criterion.weight !== "number"
      || !Number.isFinite(criterion.weight)
      || criterion.weight <= 0
      || criterion.weight > 100
      || typeof criterion.required !== "boolean"
      || !Number.isInteger(criterion.position)
      || Number(criterion.position) < 0) return [];
    return [criterion as GroupCaseCriterion];
  });
  if (criteria.length !== input.criteria.length || new Set(criteria.map((criterion) => criterion.key)).size !== criteria.length) return null;

  const rows = input.rows.flatMap((value): GroupCaseBackupRow[] => {
    const row = record(value);
    if (!row
      || !stringOrNull(row.groupId)
      || typeof row.groupName !== "string"
      || !stringOrNull(row.assignmentId)
      || !stringOrNull(row.evaluatorId)
      || typeof row.evaluatorName !== "string"
      || typeof row.applicationId !== "string"
      || typeof row.applicantName !== "string"
      || typeof row.status !== "string") return [];
    return [row as GroupCaseBackupRow];
  });
  if (rows.length !== input.rows.length) return null;

  return { ...input, criteria, rows } as GroupCaseBackup;
}

export function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildGroupCaseCsv(backup: GroupCaseBackup) {
  const headers = [
    "file_id",
    "cycle_id",
    "cycle_name",
    "round_id",
    "round_name",
    "rubric_version",
    "group_id",
    "group_name",
    "assignment_id",
    "evaluator_id",
    "evaluator_name",
    "application_id",
    "applicant_name",
    ...backup.criteria.map((criterion) => `${criterion.key}_${criterion.weight}pct_rating`),
    "evidence",
    "flags",
    "status",
  ];
  const rows = backup.rows.map((row) => [
    backup.fileId,
    backup.cycleId,
    backup.cycleName,
    backup.roundId,
    backup.roundName,
    backup.rubricVersion,
    row.groupId,
    row.groupName,
    row.assignmentId,
    row.evaluatorId,
    row.evaluatorName,
    row.applicationId,
    row.applicantName,
    ...backup.criteria.map(() => ""),
    "",
    "",
    row.status,
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

function worksheet(rows: Array<Array<string | number>>, options: { freezeColumns?: number; ratingColumns?: [number, number] } = {}) {
  const xmlRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
    const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
    return typeof value === "number"
      ? `<c r="${reference}"><v>${value}</v></c>`
      : `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const freeze = options.freezeColumns
    ? `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${options.freezeColumns}" topLeftCell="${columnName(options.freezeColumns)}2" activePane="topRight" state="frozen"/></sheetView></sheetViews>`
    : "";
  const validations = options.ratingColumns && rows.length > 1
    ? `<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Invalid rating" error="Choose 1, 2, 3, 4, 5, or N/O." sqref="${columnName(options.ratingColumns[0])}2:${columnName(options.ratingColumns[1])}${rows.length}"><formula1>&quot;1,2,3,4,5,N/O&quot;</formula1></dataValidation></dataValidations>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}<sheetData>${xmlRows}</sheetData>${validations}</worksheet>`;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  const write16 = (view: DataView, position: number, value: number) => view.setUint16(position, value, true);
  const write32 = (view: DataView, position: number, value: number) => view.setUint32(position, value, true);
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 6, 0x0800);
    write32(localView, 14, checksum);
    write32(localView, 18, data.length);
    write32(localView, 22, data.length);
    write16(localView, 26, name.length);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    chunks.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800);
    write32(centralView, 16, checksum);
    write32(centralView, 20, data.length);
    write32(centralView, 24, data.length);
    write16(centralView, 28, name.length);
    write32(centralView, 42, offset);
    central.set(name, 46);
    directory.push(central);
    offset += local.length;
  }
  const directoryLength = directory.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 8, files.length);
  write16(endView, 10, files.length);
  write32(endView, 12, directoryLength);
  write32(endView, 16, offset);
  const output = new Uint8Array(offset + directoryLength + end.length);
  let cursor = 0;
  for (const chunk of [...chunks, ...directory, end]) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

export function buildGroupCaseXlsx(backup: GroupCaseBackup) {
  const scoreHeaders = [
    "file_id", "round_id", "group_id", "group_name", "assignment_id", "evaluator_id", "evaluator_name",
    "application_id", "applicant_name", ...backup.criteria.map((criterion) => `${criterion.key}_${criterion.weight}pct_rating`),
    "evidence", "flags", "status",
  ];
  const scoreRows: Array<Array<string | number>> = [scoreHeaders, ...backup.rows.map((row) => [
    backup.fileId, backup.roundId, row.groupId ?? "", row.groupName, row.assignmentId ?? "", row.evaluatorId ?? "",
    row.evaluatorName, row.applicationId, row.applicantName, ...backup.criteria.map(() => ""), "", "", row.status,
  ])];
  const groups = new Map<string, { name: string; applicants: Set<string>; judges: Set<string> }>();
  for (const row of backup.rows) {
    const key = row.groupId ?? "UNASSIGNED";
    const group = groups.get(key) ?? { name: row.groupName, applicants: new Set<string>(), judges: new Set<string>() };
    group.applicants.add(row.applicantName);
    if (row.evaluatorId) group.judges.add(row.evaluatorName);
    groups.set(key, group);
  }
  const groupRows: Array<Array<string | number>> = [["group_id", "group_name", "applicant_names", "judge_names"], ...[...groups.entries()].map(([id, group]) => [id, group.name, [...group.applicants].join("; "), [...group.judges].join("; ")])];
  const rubricRows: Array<Array<string | number>> = [
    ["criterion_key", "criterion_name", "weight_percent", "required", "rating", "anchor"],
    ...backup.criteria.flatMap((criterion) => [1, 2, 3, 4, 5].map((rating) => [criterion.key, criterion.name, criterion.weight, criterion.required ? "Yes" : "No", rating, rating === 1 ? "Behavior was absent or counterproductive" : rating === 2 ? "Behavior was weak or inconsistent" : rating === 3 ? "Behavior met the expected standard" : rating === 4 ? "Behavior was consistently strong" : "Behavior was exceptional and materially helped the group"])),
    ["N/O", "Not observed", "", "", "N/O", "Use only when there was no fair opportunity to observe the behavior. Evidence notes are required for ratings 1, 2, and 5."],
  ];
  const sheets = [
    { name: "START_HERE", xml: worksheet([
      ["MECG GROUP CASE EMERGENCY BACKUP"], ["Cycle", backup.cycleName], ["Round", backup.roundName], ["Exported at", backup.exportedAt],
      ["Rubric version", backup.rubricVersion], ["File ID", backup.fileId], ["Instructions", "Give each judge a separate copy. Enter only assigned rows. Use 1–5 or N/O. Add evidence for ratings 1, 2, and 5. Return the completed file to a Board member; never overwrite a submitted online evaluation."],
    ]) },
    { name: "GROUPS", xml: worksheet(groupRows, { freezeColumns: 2 }) },
    { name: "SCORES", xml: worksheet(scoreRows, { freezeColumns: 9, ratingColumns: [9, 8 + backup.criteria.length] }) },
    { name: "RUBRIC", xml: worksheet(rubricRows, { freezeColumns: 2 }) },
    { name: "CHANGE_LOG", xml: worksheet([["timestamp", "judge", "reason", "correction", "recorded_by"], ["", "", "", "", ""]]) },
  ];
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const relationships = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return zipStore([
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>` },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: sheet.xml })),
  ]);
}
