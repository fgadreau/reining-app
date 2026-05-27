import { createId } from "../../utils/createId";

const STORAGE_KEY = "reiningApp.associations";

const defaultAssociations = [
  {
    id: "aqr",
    name: "Association Québécoise de Reining",
    shortName: "AQR",
    timezone: "America/Montreal",
    logoDataUrl: null,
    websiteUrl: "",
  },
  {
    id: "era",
    name: "Eastern Reining Alliance",
    shortName: "ERA",
    timezone: "America/Toronto",
    logoDataUrl: null,
    websiteUrl: "",
  },
];

export function loadAssociations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultAssociations;
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return defaultAssociations;
    }

    return parsed;
  } catch (error) {
    console.error("Erreur loadAssociations:", error);
    return defaultAssociations;
  }
}

export function saveAssociations(associations) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(associations));
  } catch (error) {
    console.error("Erreur saveAssociations:", error);
  }
}

export function createAssociationId() {
  return createId("association");
}
