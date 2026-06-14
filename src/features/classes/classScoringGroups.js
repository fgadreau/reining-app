import { getAllClasses } from "./classSelectors";

function cleanId(value) {
  return String(value || "").trim();
}

function getEligibilityRules(classItem = {}) {
  return classItem?.eligibilityRules &&
    typeof classItem.eligibilityRules === "object" &&
    !Array.isArray(classItem.eligibilityRules)
    ? classItem.eligibilityRules
    : classItem?.eligibility_rules &&
        typeof classItem.eligibility_rules === "object" &&
        !Array.isArray(classItem.eligibility_rules)
      ? classItem.eligibility_rules
      : {};
}

export function getConcurrentClassId(classItem = {}) {
  return cleanId(
    classItem.concurrentClassId ||
      classItem.concurrent_class_id ||
      getEligibilityRules(classItem).concurrent_class_id
  );
}

export function getConcurrentGroupLabel(classItem = {}) {
  return String(
    classItem.concurrentGroupLabel ||
      classItem.concurrent_group_label ||
      getEligibilityRules(classItem).concurrent_group_label ||
      ""
  ).trim();
}

export function getExplicitScoringGroupId(classItem = {}) {
  return cleanId(
    classItem.scoringGroupId ||
      classItem.scoring_group_id ||
      getEligibilityRules(classItem).scoring_group_id
  );
}

function compareGroupCanonicalClass(a, b) {
  const aSort = Number(a?.sortOrder ?? a?.sort_order);
  const bSort = Number(b?.sortOrder ?? b?.sort_order);

  if (Number.isFinite(aSort) && Number.isFinite(bSort) && aSort !== bSort) {
    return aSort - bSort;
  }

  if (Number.isFinite(aSort)) return -1;
  if (Number.isFinite(bSort)) return 1;

  const nameCompare = String(a?.name || "").localeCompare(String(b?.name || ""));
  if (nameCompare !== 0) return nameCompare;

  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

function getClassByIdFrom(classId, classes) {
  return (Array.isArray(classes) ? classes : []).find(
    (classItem) => classItem?.id === classId
  );
}

export function getClassScoringGroupMembers(classId, classes = getAllClasses()) {
  const classItems = Array.isArray(classes) ? classes : [];
  const startId = typeof classId === "object" ? classId?.id : classId;
  const visited = new Set();
  const pending = [cleanId(startId)];

  while (pending.length) {
    const currentId = pending.pop();
    if (!currentId || visited.has(currentId)) continue;

    visited.add(currentId);

    const currentClass = getClassByIdFrom(currentId, classItems);
    const linkedClassId = getConcurrentClassId(currentClass);

    if (linkedClassId && !visited.has(linkedClassId)) {
      pending.push(linkedClassId);
    }

    classItems.forEach((candidate) => {
      if (getConcurrentClassId(candidate) === currentId && !visited.has(candidate.id)) {
        pending.push(candidate.id);
      }
    });
  }

  return classItems.filter((classItem) => visited.has(classItem.id));
}

export function resolveClassScoringId(classId, classes = getAllClasses()) {
  const classItems = Array.isArray(classes) ? classes : [];
  const requestedId = typeof classId === "object" ? classId?.id : cleanId(classId);
  const requestedClass = getClassByIdFrom(requestedId, classItems);
  const explicitScoringGroupId = getExplicitScoringGroupId(requestedClass);

  if (explicitScoringGroupId) {
    return explicitScoringGroupId;
  }

  const members = getClassScoringGroupMembers(requestedId, classItems);

  if (!members.length) {
    return requestedId;
  }

  const explicitMemberGroupId = members
    .map(getExplicitScoringGroupId)
    .find(Boolean);

  if (explicitMemberGroupId) {
    return explicitMemberGroupId;
  }

  return [...members].sort(compareGroupCanonicalClass)[0]?.id || requestedId;
}

export function isConcurrentScoringAlias(classItem, classes = getAllClasses()) {
  if (!classItem?.id) return false;
  return resolveClassScoringId(classItem.id, classes) !== classItem.id;
}

export function getUniqueScoringClasses(classes = getAllClasses()) {
  const classItems = Array.isArray(classes) ? classes : [];
  const seen = new Set();

  return classItems.reduce((items, classItem) => {
    const scoringClassId = resolveClassScoringId(classItem?.id, classItems);
    if (!scoringClassId || seen.has(scoringClassId)) {
      return items;
    }

    seen.add(scoringClassId);
    items.push(getClassByIdFrom(scoringClassId, classItems) || classItem);
    return items;
  }, []);
}
