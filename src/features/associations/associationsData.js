import { createId } from "../../utils/createId";
import {
  flattenSponsorGroups,
  normalizeSponsorGroups,
} from "./sponsorLogos";

const STORAGE_KEY = "reiningApp.associations";

const defaultAssociations = [
  {
    id: "aqr",
    name: "Association Québécoise de Reining",
    shortName: "AQR",
    timezone: "America/Montreal",
    logoDataUrl: null,
    websiteUrl: "",
    sponsorLogos: [],
  },
  {
    id: "era",
    name: "Eastern Reining Alliance",
    shortName: "ERA",
    timezone: "America/Toronto",
    logoDataUrl: null,
    websiteUrl: "",
    sponsorLogos: [],
  },
];

function normalizeAssociation(association) {
  const sponsorGroups = normalizeSponsorGroups(
    association?.sponsorGroups || association?.sponsorLogos
  );

  return {
    ...association,
    isTestMode: Boolean(association?.isTestMode),
    sponsorGroups,
    sponsorLogos: flattenSponsorGroups(sponsorGroups),
  };
}

export function loadAssociations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultAssociations.map(normalizeAssociation);
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return defaultAssociations.map(normalizeAssociation);
    }

    return parsed.map(normalizeAssociation);
  } catch (error) {
    console.error("Erreur loadAssociations:", error);
    return defaultAssociations.map(normalizeAssociation);
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
