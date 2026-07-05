export function parseChampionshipCsv(csvText, fileName = "") {
  const text = normalizeCsvText(csvText);
  const lines = text.split("\n").filter((line) => line.trim() !== "");

  if (!lines.length) {
    throw new Error(fileName ? `CSV vide: ${fileName}` : "CSV vide.");
  }

  const table = parseCsvLines(lines);
  const headerIndex = table.findIndex((row) =>
    row.some((cell) => normalizeHeaderCell(cell) === "ShowNum")
  );

  if (headerIndex === -1) {
    throw new Error(
      fileName
        ? `Entete ShowNum introuvable dans ${fileName}.`
        : "Entete ShowNum introuvable."
    );
  }

  const header = table[headerIndex].map(normalizeHeaderCell);
  const rows = table
    .slice(headerIndex + 1)
    .map((row) => normalizeRowWidth(row, header.length))
    .filter((row) => row.join("").trim() !== "");
  const index = buildHeaderIndex(header);

  validateRequiredHeaders(index);

  return {
    header,
    rows,
    index,
  };
}

export const CHAMPIONSHIP_REQUIRED_HEADERS = [
  "ShowNum",
  "ShowName",
  "ClassName",
  "ClassCode",
  "PatternNum",
  "EntryCount",
  "ShownCount",
  "GoType",
  "GoNum",
  "Horse",
  "HorseNrha",
  "Member",
  "MemberNrha",
  "BackNum",
  "PlaceNum",
  "TotalScore",
  "MoneyWon",
];

function normalizeCsvText(csvText) {
  return String(csvText || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function parseCsvLines(lines) {
  return lines.map(parseCsvLine);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeaderCell(cell) {
  return String(cell || "").replace(/^\uFEFF/, "").trim();
}

function normalizeRowWidth(row, width) {
  const normalized = row.slice(0, width);

  while (normalized.length < width) {
    normalized.push("");
  }

  return normalized.map((cell) => String(cell || "").trim());
}

function buildHeaderIndex(header) {
  return header.reduce((index, key, position) => {
    index[key] = position;
    return index;
  }, {});
}

function validateRequiredHeaders(index) {
  const missing = CHAMPIONSHIP_REQUIRED_HEADERS.filter((key) => !(key in index));

  if (missing.length > 0) {
    throw new Error(`Colonnes manquantes dans le CSV: ${missing.join(", ")}`);
  }
}
