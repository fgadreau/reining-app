import jsPDF from "jspdf";
import { formatTotalValue } from "./scoring";

function safeText(value) {
  return String(value ?? "");
}

function sanitizeFilePart(value) {
  return safeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function formatTimestampForFile(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function getImageFormatFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return "PNG";
  if (dataUrl.startsWith("data:image/jpeg")) return "JPEG";
  if (dataUrl.startsWith("data:image/jpg")) return "JPEG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

function fitText(doc, value, maxWidth, fontSize, minFontSize = 5.5) {
  const text = safeText(value).trim();
  if (!text) return { text: "", fontSize };

  let nextFontSize = fontSize;
  doc.setFontSize(nextFontSize);

  while (nextFontSize > minFontSize && doc.getTextWidth(text) > maxWidth) {
    nextFontSize -= 0.5;
    doc.setFontSize(nextFontSize);
  }

  if (doc.getTextWidth(text) <= maxWidth) {
    return { text, fontSize: nextFontSize };
  }

  let shortened = text;
  while (shortened.length > 1 && doc.getTextWidth(`${shortened}...`) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }

  return { text: `${shortened}...`, fontSize: nextFontSize };
}

function formatScore(value, status) {
  const formattedScore = formatTotalValue(value);
  if (formattedScore) return formattedScore;
  return safeText(status).trim();
}

export function buildClassResultsPdfFileName({
  associationAbbreviation,
  showName,
  blockName,
  publishedAt,
}) {
  const ts = formatTimestampForFile(
    publishedAt ? new Date(publishedAt) : new Date()
  );
  const assoc = sanitizeFilePart(associationAbbreviation || "ASSOC");
  const show = sanitizeFilePart(showName || "show");
  const block = sanitizeFilePart(blockName || "results");

  return `${assoc}-${show}-${block}-results-${ts}.pdf`;
}

export function generateClassResultsPdf({
  associationName,
  associationLogoDataUrl,
  eventName,
  eventDate,
  blockName,
  pattern,
  publishedAt,
  resultGroups,
}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const usableWidth = pageWidth - margin * 2;
  const columns = [
    { key: "rank", label: "Rang", width: 14, align: "center" },
    { key: "backNumber", label: "Back", width: 19, align: "center" },
    { key: "rider", label: "Cavalier", width: 42, align: "left" },
    { key: "horse", label: "Cheval", width: 42, align: "left" },
    { key: "owner", label: "Proprietaire", width: 43, align: "left" },
    { key: "score", label: "Score", width: 22, align: "center" },
  ];
  const tableWidth = columns.reduce((total, column) => total + column.width, 0);
  const tableLeft = margin + Math.max(0, (usableWidth - tableWidth) / 2);
  let y = margin;

  function addPageHeader() {
    y = margin;

    if (associationLogoDataUrl) {
      try {
        doc.addImage(
          associationLogoDataUrl,
          getImageFormatFromDataUrl(associationLogoDataUrl),
          margin,
          y,
          18,
          18
        );
      } catch (error) {
        console.error("Erreur ajout logo au PDF resultats:", error);
      }
    }

    const titleX = associationLogoDataUrl ? margin + 23 : margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Resultats officiels", titleX, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(safeText(associationName || ""), titleX, y + 11);
    doc.text(safeText(eventName || ""), titleX, y + 16);

    const metaLines = [
      eventDate ? `Date: ${eventDate}` : "",
      blockName ? `Bloc: ${blockName}` : "",
      pattern ? `Pattern: ${pattern}` : "",
      publishedAt ? `Publie: ${formatDateTime(publishedAt)}` : "",
    ].filter(Boolean);

    doc.setFontSize(8);
    metaLines.forEach((line, index) => {
      doc.text(line, pageWidth - margin, y + 5 + index * 4.3, {
        align: "right",
      });
    });

    y += 25;
    doc.setDrawColor(180, 190, 205);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
  }

  function ensureSpace(requiredHeight) {
    if (y + requiredHeight <= pageHeight - margin) return;
    doc.addPage();
    addPageHeader();
  }

  function drawFitted(value, x, yPos, maxWidth, options = {}) {
    const fontSize = options.fontSize || 8;
    const fitted = fitText(doc, value, maxWidth, fontSize, 5.5);
    doc.setFont("helvetica", options.fontStyle || "normal");
    doc.setFontSize(fitted.fontSize);
    doc.text(fitted.text, x, yPos, {
      align: options.align || "left",
      baseline: options.baseline || "alphabetic",
    });
  }

  function drawTableHeader() {
    const headerH = 8;
    let x = tableLeft;

    doc.setFillColor(239, 244, 251);
    doc.setDrawColor(205, 213, 224);
    doc.rect(tableLeft, y, tableWidth, headerH, "FD");

    columns.forEach((column) => {
      drawFitted(column.label, x + column.width / 2, y + 5.2, column.width - 3, {
        align: "center",
        fontStyle: "bold",
        fontSize: 7,
      });
      x += column.width;
    });

    y += headerH;
  }

  function drawEntryRow(entry) {
    const rowH = 11;
    ensureSpace(rowH + 4);

    let x = tableLeft;
    doc.setDrawColor(220, 226, 235);
    doc.rect(tableLeft, y, tableWidth, rowH);

    columns.forEach((column) => {
      doc.line(x, y, x, y + rowH);
      x += column.width;
    });
    doc.line(tableLeft + tableWidth, y, tableLeft + tableWidth, y + rowH);

    x = tableLeft;
    drawFitted(entry.rank ?? "", x + columns[0].width / 2, y + 6.8, 10, {
      align: "center",
      fontStyle: "bold",
      fontSize: 8,
    });

    x += columns[0].width;
    drawFitted(entry.backNumber || "", x + columns[1].width / 2, y + 6.8, 15, {
      align: "center",
      fontSize: 8,
    });

    x += columns[1].width;
    drawFitted(entry.rider || "", x + 2, y + 6.8, columns[2].width - 4, {
      fontStyle: "bold",
      fontSize: 7.5,
    });

    x += columns[2].width;
    drawFitted(entry.horse || "", x + 2, y + 6.8, columns[3].width - 4, {
      fontSize: 7.5,
    });

    x += columns[3].width;
    drawFitted(entry.owner || "", x + 2, y + 6.8, columns[4].width - 4, {
      fontSize: 7.5,
    });

    x += columns[4].width;
    drawFitted(
      formatScore(entry.scoreTotal, entry.status) || "-",
      x + columns[5].width / 2,
      y + 6.8,
      columns[5].width - 4,
      {
        align: "center",
        fontStyle: "bold",
        fontSize: 8.5,
      }
    );

    y += rowH;
  }

  function drawResultGroup(group) {
    const entries = Array.isArray(group?.entries) ? group.entries : [];
    if (!entries.length) return;

    ensureSpace(25);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(
      `${safeText(group.className || "Classe/division")}${
        group.classCode ? ` (${group.classCode})` : ""
      }`,
      margin,
      y
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const meta = [
      group.parentClassName ? `Bloc: ${group.parentClassName}` : "",
      group.pattern ? `Pattern: ${group.pattern}` : "",
      `${entries.length} participant(s)`,
    ]
      .filter(Boolean)
      .join(" - ");
    doc.text(meta, margin, y + 5);
    y += 9;

    drawTableHeader();
    entries.forEach(drawEntryRow);
    y += 7;
  }

  addPageHeader();

  const groups = (Array.isArray(resultGroups) ? resultGroups : []).filter(
    (group) => Array.isArray(group?.entries) && group.entries.length > 0
  );

  groups.forEach(drawResultGroup);

  if (!groups.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Aucun resultat publie.", margin, y);
  }

  return doc;
}
