import { createId } from "../../utils/createId";

const TRACTOR_LINE_PATTERN = /^\s*(tractor|drag)\s*$/i;
const CLASS_CODE_PATTERN = /^[A-Z0-9]+(?:,[A-Z0-9]+)*$/;

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && isQuoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (char === "," && !isQuoted) {
      cells.push(cleanText(current));
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(cleanText(current));
  return cells;
}

function normalizeHeader(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^#/, "")
    .toLowerCase();
}

function findHeaderIndex(headers, acceptedNames) {
  const normalizedNames = acceptedNames.map(normalizeHeader);
  return headers.findIndex((header) =>
    normalizedNames.includes(normalizeHeader(header))
  );
}

function createImportedRun({ order, backNumber, rider, horse, owner, status }) {
  const normalizedOwner = cleanText(owner);
  const normalizedStatus = cleanText(status);
  const ownerWithStatus = normalizedStatus
    ? [normalizedOwner, normalizedStatus].filter(Boolean).join(" - ")
    : normalizedOwner;

  return {
    id: createId("run"),
    order,
    backNumber: cleanText(backNumber),
    rider: cleanText(rider),
    horse: cleanText(horse),
    owner: ownerWithStatus,
  };
}

function calculateDragInterval(segments) {
  const usableSegments = segments
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 12);

  if (!usableSegments.length) return null;

  const counts = new Map();
  usableSegments.forEach((segment) => {
    counts.set(segment, (counts.get(segment) || 0) + 1);
  });

  const [mostCommon] = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] - b[0];
  });

  if (!mostCommon) return null;

  const [interval, occurrences] = mostCommon;
  return occurrences >= 2 || usableSegments.length === 1 ? interval : null;
}

function finalizeImportedRuns(runs) {
  return runs
    .sort((a, b) => a.order - b.order)
    .map((run, index) => ({
      ...run,
      order: index + 1,
    }));
}

function parseStructuredCsv(lines) {
  const header = parseCsvLine(lines[0] || "");
  const positionIndex = findHeaderIndex(header, ["Position", "Draw", "Order"]);
  const backNumberIndex = findHeaderIndex(header, [
    "#Dossard Horse1",
    "Dossard Horse1",
    "Back No.",
    "Back Number",
    "Back #",
  ]);
  const fallbackBackNumberIndex = findHeaderIndex(header, [
    "#Dossard Équipe",
    "#Dossard Equipe",
    "#Dossard Rider1",
    "Dossard Rider1",
  ]);
  const riderIndex = findHeaderIndex(header, ["Rider1", "Exhibitor Name"]);
  const horseIndex = findHeaderIndex(header, ["Cheval1", "Horse Name"]);
  const ownerIndex = findHeaderIndex(header, ["Owner", "Owner Name"]);
  const statusIndex = findHeaderIndex(header, [
    "Résultats",
    "Resultats",
    "Results",
    "Status",
  ]);

  if (positionIndex < 0 || riderIndex < 0 || horseIndex < 0) {
    return null;
  }

  const runs = [];
  const dragSegments = [];
  let participantsSinceDrag = 0;

  lines.slice(1).forEach((line) => {
    const cells = parseCsvLine(line);
    const positionValue = cleanText(cells[positionIndex] || cells[0]);

    if (TRACTOR_LINE_PATTERN.test(positionValue)) {
      if (participantsSinceDrag > 0) {
        dragSegments.push(participantsSinceDrag);
        participantsSinceDrag = 0;
      }
      return;
    }

    const parsedPosition = Number.parseInt(positionValue, 10);
    if (!Number.isFinite(parsedPosition) || parsedPosition <= 0) return;

    const backNumber =
      cells[backNumberIndex] || cells[fallbackBackNumberIndex] || "";

    runs.push(
      createImportedRun({
        order: parsedPosition,
        backNumber,
        rider: cells[riderIndex],
        horse: cells[horseIndex],
        owner: ownerIndex >= 0 ? cells[ownerIndex] : "",
        status: statusIndex >= 0 ? cells[statusIndex] : "",
      })
    );
    participantsSinceDrag += 1;
  });

  if (!runs.length) return null;

  return {
    runs: finalizeImportedRuns(runs),
    dragInterval: calculateDragInterval(dragSegments),
    dragBreaks: dragSegments.length,
  };
}

function parseSimpleDelimitedText(lines) {
  const runs = [];
  const dragSegments = [];
  let participantsSinceDrag = 0;

  lines.forEach((line, index) => {
    if (TRACTOR_LINE_PATTERN.test(line)) {
      if (participantsSinceDrag > 0) {
        dragSegments.push(participantsSinceDrag);
        participantsSinceDrag = 0;
      }
      return;
    }

    const parts = parseCsvLine(line);
    if (parts.length < 2) return;

    const parsedDraw = Number.parseInt(parts[0], 10);
    const order =
      Number.isFinite(parsedDraw) && parsedDraw > 0 ? parsedDraw : index + 1;

    runs.push(
      createImportedRun({
        order,
        backNumber: parts[1] ?? "",
        rider: parts[2] ?? "",
        horse: parts[3] ?? "",
        owner: parts[4] ?? "",
        status: parts[5] ?? "",
      })
    );
    participantsSinceDrag += 1;
  });

  return {
    runs: finalizeImportedRuns(runs),
    dragInterval: calculateDragInterval(dragSegments),
    dragBreaks: dragSegments.length,
  };
}

function parsePositionedPdfPages(pages) {
  const runs = [];
  const dragSegments = [];
  let currentRun = null;
  let participantsSinceDrag = 0;

  function finishCurrentRun() {
    if (!currentRun) return;

    const isScratched = currentRun.blockText.some((line) =>
      /\bscratched\b/i.test(line)
    );

    if (currentRun.backNumber && currentRun.rider) {
      runs.push(
        createImportedRun({
          order: currentRun.order,
          backNumber: currentRun.backNumber,
          rider: currentRun.rider,
          horse: currentRun.horse,
          owner: currentRun.ownerLines.join(" "),
          status: isScratched ? "Scratched" : "",
        })
      );
      participantsSinceDrag += 1;
    }

    currentRun = null;
  }

  pages.forEach((pageLines) => {
    pageLines.forEach((line) => {
      const drawCell = line.cells.find(
        (cell) => cell.x >= 35 && cell.x <= 70 && /^\d+$/.test(cell.text)
      );
      const horseCell = line.cells.find((cell) => cell.x >= 130 && cell.x < 280);
      const ownerCell = line.cells.find((cell) => cell.x >= 300 && cell.x < 520);
      const backNumberCell = line.cells.find(
        (cell) => cell.x >= 88 && cell.x < 130 && /^\d{1,6}$/.test(cell.text)
      );
      const riderCell = line.cells.find((cell) => cell.x >= 130 && cell.x < 300);
      const lineText = line.cells.map((cell) => cell.text).join(" ");

      if (
        /Showbill #:|Working Order Draw|Page:|Draw Horse Name|Back No\.|Entered in showbill/i.test(
          lineText
        )
      ) {
        return;
      }

      if (TRACTOR_LINE_PATTERN.test(lineText)) {
        finishCurrentRun();
        if (participantsSinceDrag > 0) {
          dragSegments.push(participantsSinceDrag);
          participantsSinceDrag = 0;
        }
        return;
      }

      if (drawCell) {
        finishCurrentRun();
        currentRun = {
          order: Number.parseInt(drawCell.text, 10),
          backNumber: "",
          rider: "",
          riderCandidate: "",
          horse: horseCell?.text || "",
          ownerLines: ownerCell?.text ? [ownerCell.text] : [],
          blockText: [lineText],
        };
        return;
      }

      if (!currentRun) return;

      currentRun.blockText.push(lineText);

      if (backNumberCell) {
        currentRun.backNumber = backNumberCell.text;
        if (riderCell?.text) {
          currentRun.rider = riderCell.text;
        } else if (currentRun.riderCandidate) {
          currentRun.rider = currentRun.riderCandidate;
        }
        return;
      }

      if (ownerCell?.text && !CLASS_CODE_PATTERN.test(ownerCell.text)) {
        currentRun.ownerLines.push(ownerCell.text);
      }

      if (
        horseCell?.text &&
        !ownerCell &&
        !CLASS_CODE_PATTERN.test(horseCell.text)
      ) {
        currentRun.riderCandidate = horseCell.text;
      }

      if (!currentRun.horse && horseCell?.text) {
        currentRun.horse = horseCell.text;
      }
    });
  });

  finishCurrentRun();

  return {
    runs: finalizeImportedRuns(runs),
    dragInterval: calculateDragInterval(dragSegments),
    dragBreaks: dragSegments.length,
  };
}

async function parsePdfFile(file) {
  const [pdfjsModule] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf"),
    import("pdfjs-dist/legacy/build/pdf.worker.entry"),
  ]);
  const pdfjs = pdfjsModule.getDocument ? pdfjsModule : pdfjsModule.default;

  if (!pdfjs?.getDocument) {
    throw new Error("Module PDF non disponible dans ce navigateur.");
  }

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({
    data,
    disableWorker: true,
  }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = new Map();

    content.items.forEach((item) => {
      const text = cleanText(item.str);
      if (!text) return;

      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);

      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x, text });
    });

    pages.push(
      [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, cells]) => ({
          cells: cells.sort((a, b) => a.x - b.x),
        }))
    );
  }

  return parsePositionedPdfPages(pages);
}

export function parseImportedDraw(importText) {
  const lines = String(importText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return {
      runs: [],
      dragInterval: null,
      dragBreaks: 0,
    };
  }

  return parseStructuredCsv(lines) || parseSimpleDelimitedText(lines);
}

export function parseImportedRuns(importText) {
  return parseImportedDraw(importText).runs;
}

export async function parseImportedDrawFile(file) {
  const fileName = String(file?.name || "").toLowerCase();

  if (fileName.endsWith(".pdf") || file?.type === "application/pdf") {
    return parsePdfFile(file);
  }

  const text = await file.text();
  return parseImportedDraw(text);
}
