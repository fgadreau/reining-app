import { parseScoreTotalValue } from "../../utils/scoring";

function normalizeIdentityId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeRiderName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildQualifiedRiderKey(entry = {}) {
  const contactId = normalizeIdentityId(entry.riderContactId);
  if (contactId) return `contact:${contactId}`;

  const memberNrha = normalizeIdentityId(entry.memberNrha);
  if (memberNrha) return `member:${memberNrha}`;

  const riderName = normalizeRiderName(entry.rider);
  return riderName ? `name:${riderName}` : "";
}

function selectQualifiedEntries(entries, qualifiedRiderCount) {
  const count = Number.parseInt(qualifiedRiderCount, 10);
  if (!Number.isFinite(count) || count <= 0) return [];

  const ranked = (Array.isArray(entries) ? entries : []).filter((entry) =>
    Number.isFinite(parseScoreTotalValue(entry?.scoreTotal))
  );
  if (ranked.length <= count) return ranked;

  const cutoffScore = parseScoreTotalValue(ranked[count - 1]?.scoreTotal);
  return ranked.filter((entry, index) => {
    if (index < count) return true;
    return parseScoreTotalValue(entry?.scoreTotal) === cutoffScore;
  });
}

export function buildQualifiedRiderList({
  standings = [],
  qualifiedRiderCount,
} = {}) {
  const ridersByKey = new Map();

  (Array.isArray(standings) ? standings : []).forEach((group) => {
    selectQualifiedEntries(group?.entries, qualifiedRiderCount).forEach(
      (entry) => {
        const riderKey = buildQualifiedRiderKey(entry);
        if (!riderKey) return;

        const current = ridersByKey.get(riderKey) || {
          id: riderKey,
          rider: String(entry.rider || "").trim(),
          riderContactId: entry.riderContactId || "",
          memberNrha: entry.memberNrha || "",
          qualifications: [],
        };

        current.qualifications.push({
          classId: group.id || "",
          classCode: group.classCode || group.code || "",
          className: group.className || group.code || "",
          rank: entry.rank,
          scoreTotal: entry.scoreTotal,
        });
        ridersByKey.set(riderKey, current);
      }
    );
  });

  return Array.from(ridersByKey.values()).sort((left, right) =>
    String(left.rider || "").localeCompare(String(right.rider || ""), "fr", {
      sensitivity: "base",
    })
  );
}
