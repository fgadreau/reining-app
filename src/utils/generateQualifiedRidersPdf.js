import jsPDF from "jspdf";

function safeText(value) {
  return String(value ?? "").trim();
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
  return `${yyyy}${mm}${dd}-${hh}${min}`;
}

export function buildQualifiedRidersPdfFileName({
  showName,
  blockName,
  generatedAt = new Date(),
} = {}) {
  const show = sanitizeFilePart(showName || "show");
  const block = sanitizeFilePart(blockName || "bloc");
  return `${show}-${block}-cavaliers-classes-${formatTimestampForFile(
    generatedAt
  )}.pdf`;
}

export function generateQualifiedRidersPdf({
  showName,
  blockName,
  qualifiedRiderCount,
  riders = [],
  generatedAt = new Date(),
} = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const rowHeight = 9;
  let y = margin;

  function addHeader() {
    y = margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Cavaliers classés", margin, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (showName) {
      doc.text(safeText(showName), margin, y);
      y += 5;
    }
    if (blockName) {
      doc.text(`Bloc: ${safeText(blockName)}`, margin, y);
      y += 5;
    }
    doc.text(
      `Top ${Number.parseInt(qualifiedRiderCount, 10) || 0} par classe, égalités incluses`,
      margin,
      y
    );
    y += 9;
  }

  function ensureSpace() {
    if (y + rowHeight <= pageHeight - margin) return;
    doc.addPage();
    addHeader();
  }

  addHeader();

  const normalizedRiders = Array.isArray(riders) ? riders : [];
  if (!normalizedRiders.length) {
    doc.setFontSize(10);
    doc.text("Aucun cavalier classé.", margin, y);
    return doc;
  }

  normalizedRiders.forEach((rider, index) => {
    ensureSpace();
    doc.setDrawColor(220, 226, 235);
    doc.setFillColor(index % 2 === 0 ? 248 : 255, 250, 252);
    doc.rect(margin, y - 5.5, 185, rowHeight, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${index + 1}. ${safeText(rider.rider) || "—"}`, margin + 3, y);
    y += rowHeight;
  });

  return doc;
}
