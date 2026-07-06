import jsPDF from "jspdf";
import { formatChampionshipPoints } from "../features/championship/championshipPoints";

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

function getSeasonClasses(season) {
  return Array.isArray(season?.classes) ? season.classes : [];
}

function getIncludedShows(season) {
  if (Array.isArray(season?.shows) && season.shows.length) {
    return season.shows;
  }

  const showsByKey = new Map();

  getSeasonClasses(season).forEach((classEntry) => {
    (Array.isArray(classEntry?.events) ? classEntry.events : []).forEach((event) => {
      const key = event.showNum || event.showName || event.label || event.eventKey;
      if (!key || showsByKey.has(key)) return;

      showsByKey.set(key, {
        key,
        label: event.label || event.showName || event.showNum || "Show",
        showName: event.showName || "",
        showNum: event.showNum || "",
        occurrenceCount: 1,
      });
    });
  });

  return Array.from(showsByKey.values());
}

function getShowLabel(show) {
  return show?.label || show?.showName || show?.showNum || show?.key || "Show";
}

function getStatusBadge(status) {
  if (status === "final") {
    return {
      label: "FINALE",
      background: [220, 252, 231],
      border: [34, 197, 94],
      text: "#166534",
    };
  }

  if (status === "published") {
    return {
      label: "PROVISOIRE",
      background: [254, 243, 199],
      border: [245, 158, 11],
      text: "#92400e",
    };
  }

  return {
    label: "BROUILLON",
    background: [241, 245, 249],
    border: [148, 163, 184],
    text: "#475569",
  };
}

export function buildChampionshipPdfFileName({
  associationAbbreviation,
  seasonTitle,
  year,
  generatedAt,
}) {
  const ts = formatTimestampForFile(generatedAt ? new Date(generatedAt) : new Date());
  const assoc = sanitizeFilePart(associationAbbreviation || "ASSOC");
  const season = sanitizeFilePart(seasonTitle || "championnat");
  const yearPart = sanitizeFilePart(year || "");
  const parts = [assoc, season, yearPart, "championship", ts].filter(Boolean);

  return `${parts.join("-")}.pdf`;
}

export function buildChampionshipPdfTableOfContents(season, classPageNumbers) {
  return getSeasonClasses(season).map((classEntry) => ({
    id: classEntry.id,
    name: classEntry.name || "Classe",
    pageNumber: classPageNumbers?.get(classEntry.id) || null,
    eventCount: Array.isArray(classEntry.events) ? classEntry.events.length : 0,
    teamCount: Array.isArray(classEntry.teams) ? classEntry.teams.length : 0,
  }));
}

export function buildChampionshipPdfTableOfContentsColumns(
  season,
  classPageNumbers
) {
  const entries = buildChampionshipPdfTableOfContents(season, classPageNumbers);
  const splitIndex = Math.ceil(entries.length / 2);

  return [entries.slice(0, splitIndex), entries.slice(splitIndex)];
}

export function generateChampionshipPdf({
  associationName,
  associationAbbreviation,
  associationLogoDataUrl,
  season,
  generatedAt = new Date(),
}) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentBottom = pageHeight - 15;
  const usableWidth = pageWidth - margin * 2;
  const classes = getSeasonClasses(season);
  const includedShows = getIncludedShows(season);
  const classPageNumbers = new Map();
  const generatedLabel = formatDateTime(generatedAt);
  let y = margin;

  function setTextColor(color = "#0f172a") {
    doc.setTextColor(color);
  }

  function setStrokeColor(rgb) {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  }

  function setFillColor(rgb) {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  }

  function drawFitted(value, x, yPos, maxWidth, options = {}) {
    const text = safeText(value).trim();
    const minFontSize = options.minFontSize || 5;
    let fontSize = options.fontSize || 8;

    doc.setFont("helvetica", options.fontStyle || "normal");
    doc.setFontSize(fontSize);

    if (!text) return;

    while (fontSize > minFontSize && doc.getTextWidth(text) > maxWidth) {
      fontSize -= 0.5;
      doc.setFontSize(fontSize);
    }

    if (doc.getTextWidth(text) <= maxWidth) {
      doc.text(text, x, yPos, { align: options.align || "left" });
      return;
    }

    let shortened = text;
    while (shortened.length > 1 && doc.getTextWidth(`${shortened}...`) > maxWidth) {
      shortened = shortened.slice(0, -1);
    }

    doc.text(`${shortened}...`, x, yPos, { align: options.align || "left" });
  }

  function splitText(value, maxWidth, fontSize = 8) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(safeText(value), maxWidth);
  }

  function drawWrappedLines(lines, x, startY, options = {}) {
    const lineHeight = options.lineHeight || 4;
    doc.setFont("helvetica", options.fontStyle || "normal");
    doc.setFontSize(options.fontSize || 8);
    setTextColor(options.color || "#334155");

    lines.forEach((line, index) => {
      doc.text(safeText(line), x, startY + index * lineHeight);
    });
  }

  function addLogo(x, yPos, size) {
    if (associationLogoDataUrl) {
      try {
        doc.addImage(
          associationLogoDataUrl,
          getImageFormatFromDataUrl(associationLogoDataUrl),
          x,
          yPos,
          size,
          size
        );
        return;
      } catch (error) {
        console.error("Erreur ajout logo au PDF championnat:", error);
      }
    }

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.8);
    doc.circle(x + size / 2, yPos + size / 2, size / 2, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(10, size * 0.34));
    setTextColor("#0f172a");
    doc.text(safeText(associationAbbreviation || "AQR"), x + size / 2, yPos + size / 2 + 2, {
      align: "center",
    });
  }

  function drawStatusBadge(x, yPos, width, height) {
    const badge = getStatusBadge(season?.status);
    setFillColor(badge.background);
    setStrokeColor(badge.border);
    doc.roundedRect(x, yPos, width, height, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    setTextColor(badge.text);
    doc.text(badge.label, x + width / 2, yPos + height / 2 + 2, {
      align: "center",
    });
  }

  function drawStatCard(x, yPos, width, label, value) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, yPos, width, 26, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    setTextColor("#0f172a");
    doc.text(String(value || 0), x + 5, yPos + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor("#64748b");
    doc.text(label, x + 5, yPos + 20);
  }

  function drawIncludedShowsList(x, yPos, width) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setTextColor("#0f172a");
    doc.text("Shows inclus", x, yPos);

    const lines = includedShows.length
      ? includedShows.map((show, index) => {
          const occurrence = show.occurrenceCount
            ? ` (${show.occurrenceCount} occ.)`
            : "";
          return `${index + 1}. ${getShowLabel(show)}${occurrence}`;
        })
      : ["Aucun show inclus."];
    const columnGap = 8;
    const columnWidth = (width - columnGap) / 2;
    const splitIndex = Math.ceil(lines.length / 2);
    const columns = [lines.slice(0, splitIndex), lines.slice(splitIndex)];
    const maxRows = Math.max(columns[0].length, columns[1].length, 1);
    const availableHeight = pageHeight - yPos - 33;
    const rowHeight = Math.max(3.5, Math.min(5.2, availableHeight / maxRows));
    const fontSize = rowHeight < 4.3 ? 6.2 : 7.4;

    columns.forEach((column, columnIndex) => {
      const columnX = x + columnIndex * (columnWidth + columnGap);

      column.forEach((line, rowIndex) => {
        drawFitted(line, columnX, yPos + 8 + rowIndex * rowHeight, columnWidth, {
          fontSize,
          minFontSize: 5,
        });
      });
    });
  }

  function drawCoverPage() {
    y = margin + 5;
    addLogo(margin, y, 38);
    drawStatusBadge(pageWidth - margin - 62, y + 3, 62, 24);

    const titleX = margin + 48;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    setTextColor("#0f172a");
    doc.text(safeText(season?.title || "Championnat de saison"), titleX, y + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    setTextColor("#475569");
    doc.text(safeText(associationName || associationAbbreviation || ""), titleX, y + 22);
    doc.text(season?.year ? `Saison ${season.year}` : "Saison", titleX, y + 30);

    const statsTop = y + 52;
    const stats = [
      ["Classes", season?.classCount ?? classes.length],
      ["Shows", season?.showCount ?? includedShows.length],
      ["Occurrences", season?.eventCount ?? 0],
      ["Equipes", season?.teamCount ?? 0],
    ];
    const cardGap = 7;
    const cardWidth = (usableWidth - cardGap * (stats.length - 1)) / stats.length;

    stats.forEach(([label, value], index) => {
      drawStatCard(margin + index * (cardWidth + cardGap), statsTop, cardWidth, label, value);
    });

    drawIncludedShowsList(margin, statsTop + 43, usableWidth);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setTextColor("#64748b");
    doc.text(`Genere: ${generatedLabel}`, margin, pageHeight - 22);
  }

  function drawSectionHeader(title, subtitle = "") {
    y = margin;
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 23, "F");

    addLogo(margin, 5, 13);
    const headerX = margin + 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setTextColor("#0f172a");
    doc.text(title, headerX, 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor("#64748b");
    doc.text(
      subtitle || safeText(season?.title || "Championnat de saison"),
      headerX,
      16
    );
    doc.text(safeText(associationName || associationAbbreviation || ""), pageWidth - margin, 10, {
      align: "right",
    });
    doc.text(safeText(season?.year || ""), pageWidth - margin, 16, {
      align: "right",
    });

    doc.setDrawColor(203, 213, 225);
    doc.line(margin, 23, pageWidth - margin, 23);
    y = 31;
  }

  function drawTableOfContentsPage() {
    const columns = buildChampionshipPdfTableOfContentsColumns(
      season,
      classPageNumbers
    );
    const rowCount = Math.max(columns[0].length, columns[1].length, 1);
    const columnGap = 10;
    const columnWidth = (usableWidth - columnGap) / 2;
    const availableHeight = contentBottom - y - 4;
    const rowHeight = Math.max(4.4, Math.min(7.4, availableHeight / rowCount));
    const titleFontSize = rowHeight < 5.5 ? 6 : 7.4;
    const metaFontSize = rowHeight < 5.5 ? 5.2 : 6;

    doc.setPage(2);
    drawSectionHeader("Table des matieres", `${classes.length} classes`);

    if (!classes.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setTextColor("#64748b");
      doc.text("Aucune classe au championnat.", margin, y);
      return;
    }

    columns.forEach((column, columnIndex) => {
      const columnX = margin + columnIndex * (columnWidth + columnGap);

      column.forEach((entry, rowIndex) => {
        const rowY = y + rowIndex * rowHeight;
        const numberLabel = `${columnIndex * columns[0].length + rowIndex + 1}.`;

        doc.setDrawColor(226, 232, 240);
        doc.line(columnX, rowY + 2.8, columnX + columnWidth, rowY + 2.8);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(titleFontSize);
        setTextColor("#0f172a");
        doc.text(numberLabel, columnX, rowY);
        drawFitted(entry.name, columnX + 8, rowY, columnWidth - 31, {
          fontStyle: "bold",
          fontSize: titleFontSize,
          minFontSize: 4.6,
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(metaFontSize);
        setTextColor("#64748b");
        doc.text(
          `${entry.teamCount} equipes`,
          columnX + columnWidth - 13,
          rowY,
          { align: "right" }
        );

        doc.setFont("helvetica", "bold");
        doc.setFontSize(titleFontSize);
        setTextColor("#0f172a");
        doc.text(String(entry.pageNumber || "-"), columnX + columnWidth, rowY, {
          align: "right",
        });
      });
    });
  }

  function drawClassHeader(classEntry, continuation = false) {
    drawSectionHeader(
      continuation
        ? `${safeText(classEntry?.name || "Classe")} (suite)`
        : safeText(classEntry?.name || "Classe"),
      `${Array.isArray(classEntry?.events) ? classEntry.events.length : 0} shows - ${
        Array.isArray(classEntry?.teams) ? classEntry.teams.length : 0
      } equipes`
    );
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function buildEventRefs(classEntry) {
    return (Array.isArray(classEntry?.events) ? classEntry.events : []).map(
      (event, index) => ({
        code: `S${index + 1}`,
        event,
      })
    );
  }

  function buildTableColumns(eventRefs) {
    const eventCount = Math.max(eventRefs.length, 1);
    const rankWidth = 12;
    const totalWidth = 18;
    const minNameWidth = 26;
    const eventAvailable = usableWidth - rankWidth - totalWidth - minNameWidth * 2;
    const eventWidth = Math.max(7, Math.min(22, eventAvailable / eventCount));
    const remainingForNames = Math.max(
      minNameWidth * 2,
      usableWidth - rankWidth - totalWidth - eventWidth * eventCount
    );
    const nameWidth = remainingForNames / 2;

    return [
      { key: "rank", label: "Rang", width: rankWidth },
      { key: "rider", label: "Cavalier", width: nameWidth },
      { key: "horse", label: "Cheval", width: nameWidth },
      { key: "totalPoints", label: "Total", width: totalWidth },
      ...eventRefs.map(({ code }) => ({
        key: code,
        label: code,
        width: eventWidth,
      })),
    ];
  }

  function getEventLegendLines(eventRefs, fontSize = 7) {
    const legend = eventRefs
      .map(({ code, event }) => `${code}: ${event.label || event.showName || event.showNum || "Show"}`)
      .join("  |  ");

    return splitText(`Points / score par show. ${legend}`, usableWidth, fontSize);
  }

  function buildClassPrintLayout(classEntry, eventRefs) {
    const teamCount = Array.isArray(classEntry?.teams) ? classEntry.teams.length : 0;
    const compact = teamCount > 0 && teamCount <= 20;
    const legendFontSize = compact ? 6.2 : 7;
    const legendLineHeight = compact ? 3.2 : 3.7;
    const legendLines = eventRefs.length
      ? getEventLegendLines(eventRefs, legendFontSize)
      : [];
    const legendHeight = eventRefs.length
      ? legendLines.length * legendLineHeight + 5
      : 0;
    const headerH = compact ? 6.4 : 8;
    const totalsH = compact ? 6.6 : 8.6;
    const availableRowHeight =
      contentBottom - 31 - legendHeight - headerH - totalsH - 4;
    const rowH =
      compact && teamCount
        ? clamp(availableRowHeight / teamCount, 6.05, 10.4)
        : 10.4;

    return {
      compact,
      headerH,
      legendFontSize,
      legendLineHeight,
      legendLines,
      rowH,
      totalsH,
      rankFontSize: compact ? 6.2 : 7,
      nameFontSize: compact ? 6.1 : 6.8,
      totalFontSize: compact ? 6.3 : 7,
      eventPointsFontSize: compact ? 5.5 : 6.3,
      eventScoreFontSize: compact ? 5.1 : 5.8,
      emptyFontSize: compact ? 5.4 : 6.2,
    };
  }

  function ensureSpace(requiredHeight, classEntry, eventRefs = null, layout = null) {
    if (y + requiredHeight <= contentBottom) return;

    doc.addPage();
    drawClassHeader(classEntry, true);
    if (eventRefs) {
      drawEventLegend(classEntry, eventRefs, layout);
      drawTableHeader(buildTableColumns(eventRefs), layout);
    }
  }

  function drawEventLegend(classEntry, eventRefs, layout = null) {
    if (!eventRefs.length) return;

    const lines = layout?.legendLines || getEventLegendLines(eventRefs);
    const lineHeight = layout?.legendLineHeight || 3.7;
    const height = lines.length * lineHeight + 7;
    ensureSpace(height, classEntry);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(layout?.compact ? 6.8 : 7.4);
    setTextColor("#0f172a");
    doc.text("Shows", margin, y);
    drawWrappedLines(lines, margin + 13, y, {
      fontSize: layout?.legendFontSize || 7,
      lineHeight,
      color: "#334155",
    });
    y += lines.length * lineHeight + 5;
  }

  function drawTableHeader(columns, layout = null) {
    const headerH = layout?.headerH || 8;
    let x = margin;

    doc.setFillColor(226, 232, 240);
    doc.setDrawColor(148, 163, 184);
    doc.rect(margin, y, usableWidth, headerH, "FD");

    columns.forEach((column) => {
      drawFitted(column.label, x + column.width / 2, y + 5.2, column.width - 2, {
        align: "center",
        fontStyle: "bold",
        fontSize: layout?.compact ? 5.8 : 6.7,
        minFontSize: 4.5,
      });
      x += column.width;
    });

    y += headerH;
  }

  function getEventDetail(team, eventKey) {
    const detail = (Array.isArray(team?.details) ? team.details : []).find(
      (item) => item.eventKey === eventKey
    );

    if (!detail) return null;

    return {
      points: formatChampionshipPoints(detail.points),
      score: safeText(detail.totalScore || "-"),
    };
  }

  function drawTeamRow(team, eventRefs, columns, index, classEntry, layout) {
    const rowH = layout?.rowH || 10.4;
    ensureSpace(rowH, classEntry, eventRefs, layout);

    let x = margin;
    doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, usableWidth, rowH, "FD");

    columns.forEach((column) => {
      doc.line(x, y, x, y + rowH);
      x += column.width;
    });
    doc.line(margin + usableWidth, y, margin + usableWidth, y + rowH);

    x = margin;
    const baseline = y + rowH / 2 + 1.9;

    drawFitted(`#${team.rank || "-"}`, x + columns[0].width / 2, baseline, columns[0].width - 2, {
      align: "center",
      fontStyle: "bold",
      fontSize: layout?.rankFontSize || 7,
    });

    x += columns[0].width;
    drawFitted(team.rider || "-", x + 2, baseline, columns[1].width - 4, {
      fontStyle: "bold",
      fontSize: layout?.nameFontSize || 6.8,
      minFontSize: 4.7,
    });

    x += columns[1].width;
    drawFitted(team.horse || "-", x + 2, baseline, columns[2].width - 4, {
      fontSize: layout?.nameFontSize || 6.8,
      minFontSize: 4.7,
    });

    x += columns[2].width;
    drawFitted(
      formatChampionshipPoints(team.totalPoints),
      x + columns[3].width / 2,
      baseline,
      columns[3].width - 2,
      {
        align: "center",
        fontStyle: "bold",
        fontSize: layout?.totalFontSize || 7,
      }
    );

    x += columns[3].width;
    eventRefs.forEach(({ event }, eventIndex) => {
      const column = columns[4 + eventIndex];
      const detail = getEventDetail(team, event.eventKey);

      if (detail) {
        drawFitted(detail.points, x + column.width / 2, y + rowH * 0.42, column.width - 1.5, {
          align: "center",
          fontStyle: "bold",
          fontSize: layout?.eventPointsFontSize || 6.3,
          minFontSize: 4.5,
        });
        drawFitted(detail.score, x + column.width / 2, y + rowH * 0.78, column.width - 1.5, {
          align: "center",
          fontSize: layout?.eventScoreFontSize || 5.8,
          minFontSize: 4.2,
        });
      } else {
        drawFitted("-", x + column.width / 2, baseline, column.width - 1.5, {
          align: "center",
          fontSize: layout?.emptyFontSize || 6.2,
          minFontSize: 4.5,
        });
      }
      x += column.width;
    });

    y += rowH;
  }

  function drawEventTotals(classEntry, eventRefs, columns, layout = null) {
    if (!eventRefs.length) return;

    const rowH = layout?.totalsH || 8.6;
    ensureSpace(rowH + 3, classEntry, eventRefs, layout);

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(148, 163, 184);
    doc.rect(margin, y, usableWidth, rowH, "FD");

    let x = margin;
    const labelWidth = columns[0].width + columns[1].width + columns[2].width;
    drawFitted("Totaux points", x + 2, y + 5.7, labelWidth - 4, {
      fontStyle: "bold",
      fontSize: layout?.totalFontSize || 7,
    });
    x += labelWidth;
    drawFitted(
      formatChampionshipPoints(
        eventRefs.reduce((total, { event }) => total + Number(event.totalPoints || 0), 0)
      ),
      x + columns[3].width / 2,
      y + 5.7,
      columns[3].width - 2,
      {
        align: "center",
        fontStyle: "bold",
        fontSize: layout?.totalFontSize || 7,
      }
    );

    x += columns[3].width;
    eventRefs.forEach(({ event }, eventIndex) => {
      const column = columns[4 + eventIndex];
      drawFitted(
        formatChampionshipPoints(event.totalPoints),
        x + column.width / 2,
        y + 5.7,
        column.width - 1.5,
        {
          align: "center",
          fontStyle: "bold",
          fontSize: layout?.eventPointsFontSize || 6.6,
          minFontSize: 4.5,
        }
      );
      x += column.width;
    });

    y += rowH;
  }

  function drawClassSection(classEntry) {
    doc.addPage();
    classPageNumbers.set(classEntry.id, doc.getNumberOfPages());
    drawClassHeader(classEntry);

    const eventRefs = buildEventRefs(classEntry);
    const layout = buildClassPrintLayout(classEntry, eventRefs);
    const columns = buildTableColumns(eventRefs);
    drawEventLegend(classEntry, eventRefs, layout);

    const teams = Array.isArray(classEntry?.teams) ? classEntry.teams : [];
    if (!teams.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setTextColor("#64748b");
      doc.text("Aucune equipe classee.", margin, y);
      return;
    }

    drawTableHeader(columns, layout);
    teams.forEach((team, index) => {
      drawTeamRow(team, eventRefs, columns, index, classEntry, layout);
    });
    drawEventTotals(classEntry, eventRefs, columns, layout);
  }

  function addFooters() {
    const totalPages = doc.getNumberOfPages();

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      doc.setPage(pageNumber);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setTextColor("#64748b");
      doc.text(safeText(season?.title || "Championnat de saison"), margin, pageHeight - 6);
      doc.text(`${pageNumber} / ${totalPages}`, pageWidth - margin, pageHeight - 6, {
        align: "right",
      });
    }
  }

  drawCoverPage();
  doc.addPage();
  classes.forEach(drawClassSection);
  drawTableOfContentsPage();
  addFooters();
  doc.setPage(1);

  return doc;
}
