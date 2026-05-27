import jsPDF from "jspdf";
import { getPatternDisplayName } from "../features/patterns/patternDefinitions";
import { getScoreRuleLines } from "../features/scoring/scoringRuleText";

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

function fitCellText(doc, value, maxWidth, fontSize, minFontSize = 4.5) {
  const text = safeText(value).trim();
  if (!text) {
    return { text: "", fontSize };
  }

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
  while (shortened.length > 1 && doc.getTextWidth(`${shortened}…`) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }

  return { text: `${shortened}…`, fontSize: nextFontSize };
}
function getImageFormatFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return "PNG";
  if (dataUrl.startsWith("data:image/jpeg")) return "JPEG";
  if (dataUrl.startsWith("data:image/jpg")) return "JPEG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

function formatFinalizedText(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function formatEventLabel(eventName, classItem) {
  const classCode = safeText(classItem?.classCode).trim();
  const showName = safeText(eventName).trim();

  if (!classCode) return showName;
  if (!showName) return `Class ${classCode}`;

  return `${showName} - ${classCode}`;
}

function getRunNote(run) {
  return safeText(run?.note || run?.judgeNote || run?.comment).trim();
}

export function buildScorePdfFileName({
  associationAbbreviation,
  showName,
  className,
  finalizedAt,
}) {
  const ts = formatTimestampForFile(finalizedAt ? new Date(finalizedAt) : new Date());
  const assoc = sanitizeFilePart(associationAbbreviation || "ASSOC");
  const show = sanitizeFilePart(showName || "show");
  const classPart = sanitizeFilePart(className || "classe");

  return `${assoc}-${show}-${classPart}-${ts}.pdf`;
}

export function generateScorePdf({
  associationName,
  associationLogoDataUrl,
  eventName,
  eventDate,
  classItem,
  classSetup,
  runs,
  headers,
}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const patternValue = classSetup?.pattern || classItem?.pattern || "";
  const customPattern =
    classSetup?.customPattern || classItem?.customPattern || null;
  const scoreRuleLines = getScoreRuleLines(patternValue, customPattern);

  const marginLeft = 8;
  const marginRight = 8;
  const top = 10;

  const drawW = 10;
  const exhW = 12;
  const penLabelW = 14;
  const summaryW = 13;

  const usableWidth =
    pageWidth -
    marginLeft -
    marginRight -
    drawW -
    exhW -
    penLabelW -
    summaryW -
    summaryW;

  const manoeuvreCount = headers.length;
  const manoeuvreW = usableWidth / Math.max(manoeuvreCount, 1);

  const penRowH = 4.5;
  const scoreRowH = 6.5;
  const runBlockH = penRowH + scoreRowH;
  const headerH = 5.5;
  const fullTableW = pageWidth - marginLeft - marginRight;

  let y = top;

  function drawText(text, x, yPos, options = {}) {
    doc.text(String(text ?? ""), x, yPos, options);
  }

  function drawFittedText(text, x, yPos, maxWidth, options = {}) {
    const fontSize = options.fontSize || 8;
    const fitted = fitCellText(doc, text, maxWidth, fontSize, 5.5);
    doc.setFontSize(fitted.fontSize);
    drawText(fitted.text, x, yPos, options);
    doc.setFontSize(fontSize);
  }

  function drawWrappedText(text, x, yPos, maxWidth, options = {}) {
    const fontSize = options.fontSize || 8;
    const lineHeight = options.lineHeight || fontSize * 0.42;
    const maxLines = options.maxLines || 2;

    doc.setFont("helvetica", options.fontStyle || "normal");
    doc.setFontSize(fontSize);

    const lines = doc
      .splitTextToSize(safeText(text), maxWidth)
      .slice(0, maxLines);

    if (!lines.length) {
      return 0;
    }

    const lastIndex = lines.length - 1;
    const sourceLines = doc.splitTextToSize(safeText(text), maxWidth);
    if (sourceLines.length > maxLines) {
      const fitted = fitCellText(doc, lines[lastIndex], maxWidth, fontSize, 5.5);
      lines[lastIndex] = fitted.text;
    }

    if (options.align) {
      doc.text(lines, x, yPos, { align: options.align });
    } else {
      doc.text(lines, x, yPos);
    }

    return lines.length * lineHeight;
  }

  function drawCell(x, yPos, w, h, text = "", options = {}) {
    doc.rect(x, yPos, w, h);

    const align = options.align || "center";
    const fontStyle = options.fontStyle || "normal";
    const fontSize = options.fontSize || 7;
    const horizontalPadding = options.horizontalPadding ?? 1.2;

    doc.setFont("helvetica", fontStyle);

    const fitted = fitCellText(
      doc,
      text,
      Math.max(1, w - horizontalPadding * 2),
      fontSize,
      4.5
    );

    doc.setFontSize(fitted.fontSize);

    let textX = x + w / 2;
    if (align === "left") textX = x + horizontalPadding;
    if (align === "right") textX = x + w - horizontalPadding;

    const textY = yPos + h / 2 + 1.1;

    drawText(fitted.text, textX, textY, {
      align,
      baseline: "middle",
    });
  }

  function drawRunBlock(run) {
    const startX = marginLeft;
    const startY = y;
    const noteText = getRunNote(run);
    const noteH = getRunNoteHeight(run);

    drawCell(startX, startY, drawW, runBlockH, run.draw || "", {
      fontStyle: "bold",
    });

    drawCell(startX + drawW, startY, exhW, runBlockH, run.backNumber || "", {
      fontStyle: "bold",
    });

    drawCell(startX + drawW + exhW, startY, penLabelW, penRowH, "P", {
      fontStyle: "bold",
      fontSize: 6.5,
    });

    for (let i = 0; i < manoeuvreCount; i += 1) {
      drawCell(
        startX + drawW + exhW + penLabelW + i * manoeuvreW,
        startY,
        manoeuvreW,
        penRowH,
        run.penalties?.[i] || "",
        { fontSize: 5.8 }
      );
    }

    drawCell(
      startX + drawW + exhW + penLabelW + manoeuvreCount * manoeuvreW,
      startY,
      summaryW,
      runBlockH,
      run.penTotal ?? "",
      { fontStyle: "bold", fontSize: 6.2 }
    );

    drawCell(
      startX + drawW + exhW + penLabelW + manoeuvreCount * manoeuvreW + summaryW,
      startY,
      summaryW,
      runBlockH,
      run.scoreTotal ?? "",
      { fontStyle: "bold", fontSize: 6.8 }
    );

    drawCell(startX + drawW + exhW, startY + penRowH, penLabelW, scoreRowH, "S", {
      fontStyle: "bold",
      fontSize: 6.8,
    });

    for (let i = 0; i < manoeuvreCount; i += 1) {
      drawCell(
        startX + drawW + exhW + penLabelW + i * manoeuvreW,
        startY + penRowH,
        manoeuvreW,
        scoreRowH,
        run.scores?.[i] || "",
        { fontSize: 6.5 }
      );
    }

    if (noteText) {
      const noteY = startY + runBlockH;
      const noteLines = doc.splitTextToSize(
        `Judge note / Note du juge: ${noteText}`,
        fullTableW - 4
      );

      doc.rect(startX, noteY, fullTableW, noteH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.4);
      doc.text(noteLines, startX + 2, noteY + 3.5);
    }

    y += runBlockH + noteH;
  }

  function getRunNoteHeight(run) {
    const noteText = getRunNote(run);

    if (!noteText) return 0;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);

    const lines = doc.splitTextToSize(
      `Judge note / Note du juge: ${noteText}`,
      fullTableW - 4
    );

    return Math.max(6, lines.length * 3.2 + 3);
  }

  function getRunBlockHeight(run) {
    return runBlockH + getRunNoteHeight(run);
  }

  function drawPageHeader() {
    const hasLogo = Boolean(associationLogoDataUrl);
    const logoX = marginLeft;
    const logoY = y - 1;
    const logoW = 14;
    const logoH = 14;

    if (hasLogo) {
      try {
        doc.addImage(associationLogoDataUrl, "PNG", logoX, logoY, logoW, logoH);
      } catch (error) {
        console.error("Erreur ajout logo au PDF:", error);
      }
    }

    doc.setFont("times", "bold");
    doc.setFontSize(11);
    drawText(
      `${associationName || "Association"} Score Card / Feuille de pointage`,
      hasLogo ? marginLeft + 18 : marginLeft,
      y + 4
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    drawText(`Judge: ${classSetup?.judgeName || ""}`, pageWidth - 48, y + 4);

    y += 9;

    doc.setFontSize(8);
    drawFittedText(
      `Event: ${formatEventLabel(eventName, classItem)}`,
      marginLeft,
      y,
      fullTableW - 42,
      { fontSize: 8 }
    );
    drawFittedText(`Date: ${eventDate || ""}`, pageWidth - marginRight, y, 38, {
      fontSize: 8,
      align: "right",
    });

    y += 4.2;

    drawFittedText(`Class: ${classItem?.name || ""}`, marginLeft, y, fullTableW, {
      fontSize: 8,
    });

    y += 4.2;

    const patternLabel =
      getPatternDisplayName(patternValue, customPattern) || patternValue || "";
    const patternTextHeight = drawWrappedText(
      `Pattern: ${patternLabel}`,
      marginLeft,
      y,
      fullTableW,
      { fontSize: 8, lineHeight: 3.5, maxLines: 2 }
    );

    y += Math.max(patternTextHeight, 3.5) + 1;

    doc.setFontSize(5.8);
    scoreRuleLines.forEach((line) => {
      drawFittedText(line, marginLeft, y, fullTableW, { fontSize: 5.8 });
      y += 3.4;
    });

    y += 1.1;

    let x = marginLeft;
    drawCell(x, y, drawW, headerH, "DRAW", { fontStyle: "bold", fontSize: 6.2 });
    x += drawW;
    drawCell(x, y, exhW, headerH, "EXH#", { fontStyle: "bold", fontSize: 6.2 });
    x += exhW;
    drawCell(x, y, penLabelW, headerH, "PENALTY", {
      fontStyle: "bold",
      fontSize: 6.2,
    });
    x += penLabelW;

    headers.forEach((header) => {
      drawCell(x, y, manoeuvreW, headerH, header, {
        fontStyle: "bold",
        fontSize: 6.2,
      });
      x += manoeuvreW;
    });

    drawCell(x, y, summaryW, headerH, "PEN TOT", {
      fontStyle: "bold",
      fontSize: 5.8,
    });
    x += summaryW;
    drawCell(x, y, summaryW, headerH, "SCORE", {
      fontStyle: "bold",
      fontSize: 6.2,
    });

    y += headerH;
  }

  function drawSignatureFooter() {
  const footerY = pageHeight - 14;
  const appCreditY = pageHeight - 5;
  const finalizedText = formatFinalizedText(
    classSetup?.finalizedAt || classSetup?.judgeSignedAt || ""
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  drawText("Judge Signature", marginLeft, footerY);
  doc.line(marginLeft + 18, footerY, marginLeft + 78, footerY);

  if (classSetup?.judgeSignature) {
    try {
      const imageFormat = getImageFormatFromDataUrl(classSetup.judgeSignature);
      doc.addImage(
        classSetup.judgeSignature,
        imageFormat,
        marginLeft + 22,
        footerY - 8,
        28,
        9
      );
    } catch (error) {
      console.error("Erreur ajout signature au PDF:", error);
    }
  }

  drawText(`Finalized: ${finalizedText}`, pageWidth - 58, footerY);

  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  drawText("Generated by ShowScore.app", pageWidth / 2, appCreditY, {
    align: "center",
  });
  doc.setTextColor(0, 0, 0);
}

  drawPageHeader();

  const maxYBeforeFooter = pageHeight - 18;

  runs.forEach((run, index) => {
    if (y + getRunBlockHeight(run) > maxYBeforeFooter) {
      drawSignatureFooter();
      doc.addPage();
      y = top;
      drawPageHeader();
    }

    drawRunBlock(run);

    if (index < runs.length - 1) {
      y += 1.2;
    }
  });

  drawSignatureFooter();

  return doc;
}
