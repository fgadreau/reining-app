import { createId } from "../../utils/createId";

function normalizeStatus(value) {
  const text = String(value || "").trim().toLowerCase();

  if (!text) return "pending";
  if (text.includes("scratch")) return "scratch";
  if (text.includes("no show") || text.includes("noshow")) return "no_show";
  if (text.includes("pass") || text.includes("done")) return "done";

  return "pending";
}

function splitLine(line) {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(";")) return line.split(";");
  return line.split(",");
}

function isHeaderRow(cells) {
  const text = cells.join(" ").trim().toLowerCase();
  return (
    text.includes("cavalier") ||
    text.includes("rider") ||
    text.includes("participant") ||
    text.includes("nom")
  );
}

export function parsePaidWarmupEntries(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitLine)
    .map((cells) => cells.map((cell) => cell.trim()).filter(Boolean))
    .filter((cells) => cells.length > 0 && !isHeaderRow(cells))
    .map((cells, index) => {
      const startsWithOrder = /^\d+$/.test(cells[0]);
      const rider = startsWithOrder ? cells[1] || "" : cells[0] || "";
      const statusCell = startsWithOrder ? cells[2] : cells[1];

      return {
        id: createId("paid_warmup_entry"),
        order: index + 1,
        rider,
        status: normalizeStatus(statusCell),
      };
    })
    .filter((entry) => entry.rider);
}
