/**
 * Zero-dependency RFC-4180 CSV Parser & Serializer
 */

export function parseCsv(csvText = "") {
  const clean = String(csvText).replace(/^\uFEFF/, "").trim();
  if (!clean) return [];

  const rows = [];
  let curRow = [];
  let curField = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        curField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        curField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        curRow.push(curField.trim());
        curField = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++;
        curRow.push(curField.trim());
        if (curRow.some((cell) => cell !== "")) {
          rows.push(curRow);
        }
        curRow = [];
        curField = "";
      } else if (ch !== "\r") {
        curField += ch;
      }
    }
  }
  curRow.push(curField.trim());
  if (curRow.some((cell) => cell !== "")) {
    rows.push(curRow);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    return obj;
  });
}

export function toCsv(headers, records) {
  const escapeCell = (val) => {
    const str = val === null || val === undefined ? "" : String(val);
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map((h) => escapeCell(h.label)).join(",");
  const lines = records.map((rec) =>
    headers.map((h) => escapeCell(rec[h.key])).join(",")
  );
  return [headerLine, ...lines].join("\r\n");
}

