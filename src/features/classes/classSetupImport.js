import { createId } from "../../utils/createId";

const TRACTOR_LINE_PATTERN = /^\s*(tractor|drag)\s*$/i;
const CLASS_CODE_TOKEN_SOURCE = "-?[A-Z0-9]+(?:[ -][A-Z0-9]+)*";
const CLASS_CODE_TOKEN_PATTERN = new RegExp(`^${CLASS_CODE_TOKEN_SOURCE}$`);
const CLASS_CODE_PATTERN = new RegExp(
  `^${CLASS_CODE_TOKEN_SOURCE}(?:\\s*,\\s*${CLASS_CODE_TOKEN_SOURCE})*\\s*$`
);
const CLASS_HEADER_PATTERN = /\[\s*(-?\s*[A-Z0-9][A-Z0-9\s-]*?)\s*\]\s*$/;
const REO_CLASS_HEADER_PATTERN =
  /Draw for Class\s+(\d+)\s+(.+?)\s+on\b.*?\(Pattern\s+([^)]+)\)/i;
const REO_SCORE_BOX_PATTERN = /\|\s*_+\s*\|/g;
const REO_SCORE_BOX_MATCH_PATTERN = /\|\s*_+\s*\|/;
const REO_DIVISION_SUMMARY_PATTERN = /^(\d+)\s+(.+)$/;
const REO_PEDIGREE_MARKER_PATTERN = /^\([A-Z]\)$/i;
const PDF_ROW_Y_TOLERANCE = 2;

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeClassCode(value) {
  return cleanText(value).replace(/\s*-\s*/g, "-").toUpperCase();
}

function lastItem(values) {
  return values[values.length - 1] || null;
}

function normalizeClassCodes(value, allowedCodes = null) {
  if (!CLASS_CODE_PATTERN.test(cleanText(value))) return [];

  const allowed = allowedCodes instanceof Set ? allowedCodes : null;

  return Array.from(
    new Set(
      cleanText(value)
        .split(/\s*,\s*/)
        .map(normalizeClassCode)
        .filter(
          (code) =>
            code &&
            CLASS_CODE_TOKEN_PATTERN.test(code) &&
            (!allowed || allowed.has(code))
        )
    )
  );
}

function normalizeBlockClasses(value) {
  const classesByCode = new Map();

  (Array.isArray(value) ? value : []).forEach((classEntry) => {
    const code = normalizeClassCode(classEntry?.code);
    if (!code) return;

    classesByCode.set(code, {
      code,
      name: cleanText(classEntry?.name),
      classNumber: cleanText(classEntry?.classNumber),
      association: cleanText(classEntry?.association),
    });
  });

  return Array.from(classesByCode.values());
}

function parseBlockClassText(classNumber, association, classNameText) {
  const normalizedClassNameText = cleanText(classNameText);
  const match = normalizedClassNameText.match(CLASS_HEADER_PATTERN);
  const code = normalizeClassCode(match?.[1]);

  if (!code || !CLASS_CODE_TOKEN_PATTERN.test(code)) return null;

  let name = cleanText(
    normalizedClassNameText.replace(CLASS_HEADER_PATTERN, "")
  );
  let detectedAssociation = cleanText(association);
  const embeddedAssociationMatch = name.match(/^([A-Z0-9]+)\s*-\s*(.+)$/);

  if (!detectedAssociation && embeddedAssociationMatch) {
    detectedAssociation = embeddedAssociationMatch[1];
    name = cleanText(embeddedAssociationMatch[2]);
  }

  return {
    code,
    name,
    classNumber: cleanText(classNumber),
    association: detectedAssociation,
  };
}

function getFunwareBlockClassPartsFromCells(cells) {
  const classNameCell = cells.find((cell) => {
    const text = cleanText(cell.text);

    return (
      cell.x >= 190 &&
      cell.x < 455 &&
      (CLASS_HEADER_PATTERN.test(text) ||
        text.includes("[") ||
        text.length > 12)
    );
  });

  if (!classNameCell) return null;

  const classNumberCell = lastItem(
    cells.filter(
      (cell) =>
        cell.x >= 145 &&
        cell.x < 185 &&
        cell.x < classNameCell.x &&
        /^\d+$/.test(cell.text)
    )
  );

  if (!classNumberCell) return null;

  const associationCell = lastItem(
    cells.filter(
      (cell) =>
        cell.x < classNameCell.x &&
        cell.x > classNumberCell.x &&
        /^[A-Z]+$/.test(cell.text)
    )
  );

  const classNameText = cleanText(
    cells
      .filter((cell) => cell.x >= classNameCell.x && cell.x < 455)
      .map((cell) => cell.text)
      .join(" ")
  );

  return {
    classNumber: classNumberCell.text,
    association: associationCell?.text || "",
    classNameText,
  };
}

function extractBlockClassFromCells(cells) {
  const parts = getFunwareBlockClassPartsFromCells(cells);
  if (!parts) return null;

  return parseBlockClassText(
    parts.classNumber,
    parts.association,
    parts.classNameText
  );
}

function extractPartialBlockClassFromCells(cells) {
  const parts = getFunwareBlockClassPartsFromCells(cells);
  if (!parts || !parts.classNameText) return null;

  if (
    parseBlockClassText(
      parts.classNumber,
      parts.association,
      parts.classNameText
    )
  ) {
    return null;
  }

  return parts;
}

function getFunwareBlockClassContinuationText(cells) {
  return cleanText(
    (Array.isArray(cells) ? cells : [])
      .filter((cell) => cell.x >= 150 && cell.x < 455)
      .map((cell) => cell.text)
      .join(" ")
  );
}

function cleanReoText(value) {
  return cleanText(String(value ?? "").replace(REO_SCORE_BOX_PATTERN, ""));
}

function getReoLineText(cells) {
  return cleanText(
    cells
      .map((cell) => cleanReoText(cell.text))
      .filter(Boolean)
      .join(" ")
  );
}

function getReoColumnText(cells, minX, maxX, options = {}) {
  const text = (Array.isArray(cells) ? cells : [])
    .filter((cell) => cell.x >= minX && cell.x < maxX)
    .sort((a, b) => a.x - b.x)
    .map((cell) => {
      const rawText = String(cell.text ?? "");
      const textPart =
        options.stripAfterScoreBox && REO_SCORE_BOX_MATCH_PATTERN.test(rawText)
          ? rawText.split(REO_SCORE_BOX_MATCH_PATTERN)[0]
          : rawText;

      return cleanReoText(textPart);
    })
    .filter(Boolean)
    .join(" ");

  return cleanText(text);
}

function getReoScoreDivisionText(cells) {
  const rawText = cleanText(
    (Array.isArray(cells) ? cells : [])
      .filter((cell) => cell.x >= 285 && cell.x < 540)
      .sort((a, b) => a.x - b.x)
      .map((cell) => String(cell.text ?? ""))
      .join(" ")
  );
  const match = rawText.match(REO_SCORE_BOX_MATCH_PATTERN);

  if (!match || match.index == null) return "";

  return cleanText(rawText.slice(match.index + match[0].length));
}

function findReoCell(cells, minX, maxX, predicate = null) {
  return cells
    .map((cell) => ({
      ...cell,
      text: cleanReoText(cell.text),
    }))
    .find((cell) => {
      if (!cell.text || cell.x < minX || cell.x >= maxX) return false;
      return predicate ? predicate(cell.text, cell) : true;
    });
}

function parseReoDivisionCodes(value) {
  const cleaned = cleanReoText(value);
  if (!cleaned) return [];

  return Array.from(
    new Set(
      cleaned
        .split(/[/,;\s]+/)
        .map((code) => normalizeClassCode(code))
        .filter((code) => /^[A-Z0-9]{2,}$/.test(code))
    )
  );
}

function parseReoDivisionSummaryClass(cells) {
  const divisionText = getReoColumnText(cells, 120, 285);
  const purseCell = findReoCell(cells, 285, 430, (text) =>
    /^\$/.test(text)
  );
  const placesCell = findReoCell(cells, 430, 520, (text) =>
    /^\d+$/.test(text)
  );

  if (!divisionText || (!purseCell && !placesCell)) return null;

  const match = divisionText.match(REO_DIVISION_SUMMARY_PATTERN);
  const code = normalizeClassCode(match?.[1]);
  if (!code) return null;

  return {
    code,
    name: cleanText(match?.[2] || ""),
    classNumber: code,
    association: "REO",
  };
}

function isReoPositionedPdf(pages) {
  return pages.some((pageLines) =>
    pageLines.some((line) => {
      const lineText = getReoLineText(line.cells);

      return (
        REO_CLASS_HEADER_PATTERN.test(lineText) ||
        (/Draw\s+Entry\s+Horse\s*\/\s*Owner\s*1/i.test(lineText) &&
          /Scores\s*\/\s*Divisions\s+Entered/i.test(lineText))
      );
    })
  );
}

function isReoPedigreeLine(cells) {
  return cells.some(
    (cell) =>
      cell.x >= 65 &&
      cell.x < 105 &&
      REO_PEDIGREE_MARKER_PATTERN.test(cleanReoText(cell.text))
  );
}

function parseReoPositionedPdfPages(pages) {
  if (!isReoPositionedPdf(pages)) return null;

  const runs = [];
  const blockClassesByCode = new Map();
  let currentRun = null;
  let currentClassHeader = null;
  let isInDivisionSummary = false;

  function finishCurrentRun() {
    if (!currentRun) return;

    if (currentRun.backNumber && currentRun.rider) {
      const owner = Array.from(new Set(currentRun.ownerLines))
        .filter(Boolean)
        .join(" / ");

      runs.push(
        createImportedRun({
          order: currentRun.order,
          backNumber: currentRun.backNumber,
          rider: currentRun.rider,
          horse: currentRun.horse,
          owner,
          status: "",
          classCodes: currentRun.classCodes,
        })
      );
    }

    currentRun = null;
  }

  pages.forEach((pageLines) => {
    pageLines.forEach((line) => {
      const lineText = getReoLineText(line.cells);
      const classHeaderMatch = lineText.match(REO_CLASS_HEADER_PATTERN);

      if (classHeaderMatch) {
        finishCurrentRun();
        currentClassHeader = {
          classNumber: cleanText(classHeaderMatch[1]),
          name: cleanText(classHeaderMatch[2]),
          pattern: cleanText(classHeaderMatch[3]),
        };
        isInDivisionSummary = false;
        return;
      }

      if (
        /Entries\s+Division\s+Total Purse\s+Places/i.test(lineText)
      ) {
        finishCurrentRun();
        isInDivisionSummary = true;
        return;
      }

      if (/Draw\s+Entry\s+Horse\s*\/\s*Owner\s*1/i.test(lineText)) {
        isInDivisionSummary = false;
        return;
      }

      const summaryClass = parseReoDivisionSummaryClass(line.cells);
      if (summaryClass) {
        finishCurrentRun();
        blockClassesByCode.set(summaryClass.code, summaryClass);
        isInDivisionSummary = true;
        return;
      }

      if (isInDivisionSummary) return;

      if (
        /CNYRHA.*Draw Report|Draw\s+Entry\s+Horse \/ Owner 1|Printed(?:\s+on)?:|\bPage\s+\d+\s+of\s+\d+\b|Page:/i.test(
          lineText
        )
      ) {
        return;
      }

      if (isReoPedigreeLine(line.cells)) return;

      const drawCell = findReoCell(line.cells, 30, 58, (text) =>
        /^\d+$/.test(text)
      );
      const backNumberCell = findReoCell(line.cells, 60, 100, (text) =>
        /^\d{1,6}$/.test(text)
      );
      const horseText = getReoColumnText(line.cells, 120, 285);
      const riderText = getReoColumnText(line.cells, 285, 430, {
        stripAfterScoreBox: true,
      });
      const divisionText = [
        getReoScoreDivisionText(line.cells),
        getReoColumnText(line.cells, 430, 540),
      ].join(" ");
      const lineClassCodes = parseReoDivisionCodes(divisionText);

      if (drawCell && backNumberCell && horseText && riderText) {
        finishCurrentRun();
        currentRun = {
          order: Number.parseInt(drawCell.text, 10),
          backNumber: backNumberCell.text,
          rider: riderText,
          horse: horseText,
          ownerLines: [],
          classCodes: lineClassCodes,
        };
        return;
      }

      if (!currentRun) return;

      const ownerOneText = getReoColumnText(line.cells, 120, 285);
      const ownerTwoText = getReoColumnText(line.cells, 285, 430, {
        stripAfterScoreBox: true,
      });
      const ownerDivisionText = [
        getReoScoreDivisionText(line.cells),
        getReoColumnText(line.cells, 430, 540),
      ].join(" ");
      const classCodes = parseReoDivisionCodes(ownerDivisionText);

      if (ownerOneText) currentRun.ownerLines.push(ownerOneText);
      if (ownerTwoText) currentRun.ownerLines.push(ownerTwoText);
      if (classCodes.length > 0) currentRun.classCodes.push(...classCodes);
    });
  });

  finishCurrentRun();

  const finalizedRuns = finalizeImportedRuns(runs);

  finalizedRuns.forEach((run) => {
    (Array.isArray(run.classCodes) ? run.classCodes : []).forEach((code) => {
      if (blockClassesByCode.has(code)) return;
      blockClassesByCode.set(code, {
        code,
        name: "",
        classNumber: code,
        association: "REO",
      });
    });
  });

  return {
    runs: finalizedRuns,
    dragInterval: null,
    dragBreaks: 0,
    blockClasses: normalizeBlockClasses(Array.from(blockClassesByCode.values())),
    source: currentClassHeader
      ? {
          type: "reo",
          ...currentClassHeader,
        }
      : { type: "reo" },
  };
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

function createImportedRun({
  order,
  backNumber,
  rider,
  horse,
  owner,
  status,
  classCodes,
}) {
  const normalizedOwner = cleanText(owner);
  const normalizedStatus = cleanText(status);
  const ownerWithStatus = normalizedStatus
    ? [normalizedOwner, normalizedStatus].filter(Boolean).join(" - ")
    : normalizedOwner;
  const normalizedClassCodes = normalizeClassCodes(
    Array.isArray(classCodes) ? classCodes.join(",") : classCodes,
    null
  );

  return {
    id: createId("run"),
    order,
    draw: order,
    backNumber: cleanText(backNumber),
    rider: cleanText(rider),
    horse: cleanText(horse),
    owner: ownerWithStatus,
    classCodes: normalizedClassCodes,
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
  const classCodesIndex = findHeaderIndex(header, [
    "Entered in showbill/class",
    "Showbill/Class",
    "Class",
    "Classes",
    "Class Codes",
    "Class Code",
  ]);
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
    if (!Number.isFinite(parsedPosition) || parsedPosition === 0) return;

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
        classCodes:
          classCodesIndex >= 0
            ? normalizeClassCodes(cells[classCodesIndex], null)
            : [],
      })
    );
    participantsSinceDrag += 1;
  });

  if (!runs.length) return null;

  return {
    runs: finalizeImportedRuns(runs),
    dragInterval: calculateDragInterval(dragSegments),
    dragBreaks: dragSegments.length,
    blockClasses: [],
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
      Number.isFinite(parsedDraw) && parsedDraw !== 0 ? parsedDraw : index + 1;

    runs.push(
      createImportedRun({
        order,
        backNumber: parts[1] ?? "",
        rider: parts[2] ?? "",
        horse: parts[3] ?? "",
        owner: parts[4] ?? "",
        status: parts[5] ?? "",
        classCodes: parts[6] ? normalizeClassCodes(parts[6], null) : [],
      })
    );
    participantsSinceDrag += 1;
  });

  return {
    runs: finalizeImportedRuns(runs),
    dragInterval: calculateDragInterval(dragSegments),
    dragBreaks: dragSegments.length,
    blockClasses: [],
  };
}

function parseFunwarePositionedPdfPages(pages) {
  const runs = [];
  const dragSegments = [];
  const blockClassesByCode = new Map();
  let currentRun = null;
  let participantsSinceDrag = 0;
  let pendingBlockClass = null;

  function getAllowedClassCodes() {
    return new Set(blockClassesByCode.keys());
  }

  function getClassCodesFromCell(cell) {
    if (!cell?.text || blockClassesByCode.size === 0) return [];
    return normalizeClassCodes(cell.text, getAllowedClassCodes());
  }

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
          classCodes: currentRun.classCodes,
        })
      );
      participantsSinceDrag += 1;
    }

    currentRun = null;
  }

  pages.forEach((pageLines) => {
    pageLines.forEach((line) => {
      const lineText = line.cells.map((cell) => cell.text).join(" ");
      const blockClassContinuationText =
        getFunwareBlockClassContinuationText(line.cells);

      if (pendingBlockClass && blockClassContinuationText.includes("]")) {
        const completedBlockClass = parseBlockClassText(
          pendingBlockClass.classNumber,
          pendingBlockClass.association,
          `${pendingBlockClass.classNameText} ${blockClassContinuationText}`
        );

        if (completedBlockClass) {
          blockClassesByCode.set(completedBlockClass.code, completedBlockClass);
          pendingBlockClass = null;
          return;
        }

        pendingBlockClass = null;
      }

      const blockClass = extractBlockClassFromCells(line.cells);
      if (blockClass) {
        blockClassesByCode.set(blockClass.code, blockClass);
        pendingBlockClass = null;
        return;
      }

      const partialBlockClass = extractPartialBlockClassFromCells(line.cells);
      if (partialBlockClass) {
        pendingBlockClass = partialBlockClass;
        return;
      }

      const drawCell = line.cells.find(
        (cell) => cell.x >= 35 && cell.x <= 70 && /^-?\d+$/.test(cell.text)
      );
      const horseCell = line.cells.find((cell) => cell.x >= 130 && cell.x < 280);
      const ownerCell = line.cells.find((cell) => cell.x >= 300 && cell.x < 520);
      const backNumberCell = line.cells.find(
        (cell) => cell.x >= 88 && cell.x < 130 && /^\d{1,6}$/.test(cell.text)
      );
      const riderCell = line.cells.find((cell) => cell.x >= 130 && cell.x < 300);

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
        const ownerClassCodes = getClassCodesFromCell(ownerCell);
        currentRun = {
          order: Number.parseInt(drawCell.text, 10),
          backNumber: "",
          rider: "",
          riderCandidate: "",
          horse: horseCell?.text || "",
          ownerLines: ownerCell?.text && ownerClassCodes.length === 0
            ? [ownerCell.text]
            : [],
          classCodes: ownerClassCodes,
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
        if (ownerCell?.text) {
          const classCodes = getClassCodesFromCell(ownerCell);
          if (classCodes.length > 0) {
            currentRun.classCodes.push(...classCodes);
          } else {
            currentRun.ownerLines.push(ownerCell.text);
          }
        }
        return;
      }

      if (ownerCell?.text) {
        const classCodes = getClassCodesFromCell(ownerCell);
        if (classCodes.length > 0) {
          currentRun.classCodes.push(...classCodes);
        } else {
          currentRun.ownerLines.push(ownerCell.text);
        }
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
    blockClasses: normalizeBlockClasses(Array.from(blockClassesByCode.values())),
  };
}

export function parsePositionedPdfPages(pages) {
  return parseReoPositionedPdfPages(pages) || parseFunwarePositionedPdfPages(pages);
}

function addPdfTextItemToRows(rows, item) {
  const text = cleanText(item.str);
  if (!text) return;

  const y = Number(item.transform?.[5]);
  const x = Math.round(Number(item.transform?.[4]) || 0);
  if (!Number.isFinite(y)) return;

  const row = rows.find((candidate) =>
    Math.abs(candidate.y - y) <= PDF_ROW_Y_TOLERANCE
  );

  if (row) {
    row.cells.push({ x, text });
    row.y = Math.max(row.y, y);
    return;
  }

  rows.push({ y, cells: [{ x, text }] });
}

async function parsePdfFile(file) {
  const pdfjsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
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
    const rows = [];

    content.items.forEach((item) => addPdfTextItemToRows(rows, item));

    pages.push(
      rows
        .sort((a, b) => b.y - a.y)
        .map((row) => ({
          cells: row.cells.sort((a, b) => a.x - b.x),
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
      blockClasses: [],
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
