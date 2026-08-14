import {
  getChampionshipClassById,
  getChampionshipClassLabel,
} from "./championshipClasses";

export const CHAMPIONSHIP_CLASS_LABEL_MAX_LENGTH = 140;

export function normalizeChampionshipClassLabels(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value).reduce((labels, [classId, label]) => {
    const id = String(classId || "").trim();
    const normalizedLabel = String(label || "")
      .trim()
      .slice(0, CHAMPIONSHIP_CLASS_LABEL_MAX_LENGTH);

    if (id && normalizedLabel) labels[id] = normalizedLabel;
    return labels;
  }, {});
}

export function applyChampionshipClassLabels(dataset, labelsByClass = {}) {
  if (!dataset || !Array.isArray(dataset.classes)) return dataset;

  const labels = normalizeChampionshipClassLabels(labelsByClass);

  return {
    ...dataset,
    classes: dataset.classes.map((classEntry) => {
      const catalogClass = getChampionshipClassById(classEntry?.id);
      const originalName =
        String(classEntry?.originalName || "").trim() ||
        getChampionshipClassLabel(catalogClass) ||
        String(classEntry?.name || "").trim();

      return {
        ...classEntry,
        originalName,
        name: labels[classEntry.id] || originalName,
      };
    }),
  };
}
