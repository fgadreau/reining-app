import { createId } from "../../utils/createId";

export function parseImportedRuns(importText) {
  const lines = String(importText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => line.split(",").map((part) => part.trim()))
    .filter((parts) => parts.length >= 2)
    .map((parts, index) => {
      const parsedDraw = Number(parts[0]);
      const order =
        Number.isFinite(parsedDraw) && parsedDraw > 0 ? parsedDraw : index + 1;

      return {
        id: createId("run"),
        order,
        backNumber: parts[1] ?? "",
        rider: parts[2] ?? "",
        horse: parts[3] ?? "",
        owner: parts[4] ?? "",
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((run, index) => ({
      ...run,
      order: index + 1,
    }));
}
