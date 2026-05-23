import {
  getAllClasses,
  getClassById,
  getClassesByDayId,
} from "./classSelectors";
import {
  createClass,
  deleteClass,
  saveClasses,
  updateClass,
} from "./classStorage";
import { getClassOfficialData } from "./classOfficialData";
import { getClassRecord } from "./classRecordStorage";
import { getOfficialResultRepository } from "./officialResultRepository";
import {
  getClassSetup,
  saveClassSetup,
} from "./classSetupStorage";
import {
  deleteClassSetupRepository,
  getClassSetupRepository,
  saveClassSetupRepository,
} from "./classSetupRepository";
import { getClassStatus } from "./classStatusSelectors";
import {
  loadScoringRuns,
  loadScoringSessionRepository,
} from "../scoring/scoringRepository";
import {
  deletePublicationState,
  getPublicationState,
} from "../publication/publicationRepository";
import {
  deletePublicationStateRepository,
  getPublicationStateRepository,
  getPublicationStatesForClassesRepository,
} from "../publication/publicationCloudRepository";
import { getSupabaseClient } from "../cloud/supabaseClient";

function toClass(row) {
  return {
    id: row.id,
    associationId: row.association_id,
    showId: row.show_id,
    dayId: row.day_id,
    name: row.name || "",
    classCode: row.class_code || "",
    pattern: row.pattern || "",
    judgeName: row.judge_name || "",
    sortOrder: row.sort_order || 1,
  };
}

function toClassRow(classItem) {
  return {
    id: classItem.id,
    association_id: classItem.associationId,
    show_id: classItem.showId,
    day_id: classItem.dayId,
    name: classItem.name || "",
    class_code: classItem.classCode || "",
    pattern: classItem.pattern || "",
    judge_name: classItem.judgeName || "",
    sort_order: Number(classItem.sortOrder) || 1,
  };
}

function saveClassLocally(classItem) {
  const exists = getAllClasses().some((item) => item.id === classItem.id);

  if (exists) {
    updateClass(classItem.id, classItem);
  } else {
    createClass(classItem);
  }

  return classItem;
}

function mergeClassesById(currentClasses, nextClasses) {
  const merged = new Map();
  currentClasses.forEach((classItem) => merged.set(classItem.id, classItem));
  nextClasses.forEach((classItem) => merged.set(classItem.id, classItem));
  return Array.from(merged.values());
}

async function buildTimingDataForClasses(classes) {
  return Promise.all(
    classes.map(async (classItem) => {
      const [setup, scoringSession] = await Promise.all([
        getClassSetupRepository(classItem.id),
        loadScoringSessionRepository(classItem.id),
      ]);

      return {
        classItem,
        setup,
        scoringRuns: scoringSession.runs,
        status: getClassStatus(classItem),
      };
    })
  );
}

export function getClassFullData(classId) {
  const classItem = getClassById(classId);
  const setup = getClassSetup(classId);
  const record = getClassRecord(classId);
  const official = getClassOfficialData(classId, classItem);
  const scoringRuns = loadScoringRuns(classId);
  const publication = getPublicationState(classId);

  return {
    classItem,
    setup,
    record,
    official,
    publication,
    scoringRuns,
    status: official.isFinalized ? "completed" : getClassStatus(classItem),
  };
}

export function getClassesForDay(dayId) {
  return getClassesByDayId(dayId);
}

export async function getAccessibleClassTimingDataRepository() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return buildTimingDataForClasses(getAllClasses());
  }

  try {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .order("pattern", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (error) throw error;

    const classes = Array.isArray(data) ? data.map(toClass) : [];
    saveClasses(mergeClassesById(getAllClasses(), classes));

    return buildTimingDataForClasses(classes);
  } catch (error) {
    console.error("Erreur chargement analytics classes Supabase:", error);
    return buildTimingDataForClasses(getAllClasses());
  }
}

export async function getClassFullDataRepository(classId) {
  const classItem = getClassById(classId);
  const [setup, publication] = await Promise.all([
    getClassSetupRepository(classId),
    getPublicationStateRepository(classId),
  ]);
  const record = getClassRecord(classId);
  const officialResult = await getOfficialResultRepository(classId);
  const official = getClassOfficialData(classId, classItem, officialResult);
  const scoringSession = await loadScoringSessionRepository(classId);

  return {
    classItem,
    setup,
    record,
    official,
    publication,
    scoringRuns: scoringSession.runs,
    status: official.isFinalized ? "completed" : getClassStatus(classItem),
  };
}

export async function getClassesForDayRepository(dayId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return getClassesByDayId(dayId);
  }

  try {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("day_id", dayId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    const classes = Array.isArray(data) ? data.map(toClass) : [];
    const otherLocalClasses = getAllClasses().filter(
      (classItem) => classItem.dayId !== dayId
    );
    saveClasses([...otherLocalClasses, ...classes]);
    await Promise.all(
      classes.flatMap((classItem) => [
        getClassSetupRepository(classItem.id),
        getOfficialResultRepository(classItem.id),
      ])
    );
    await getPublicationStatesForClassesRepository(
      classes.map((classItem) => classItem.id)
    );

    return classes;
  } catch (error) {
    console.error("Erreur chargement classes Supabase:", error);
    return getClassesByDayId(dayId);
  }
}

export function createClassItem(newClass) {
  createClass(newClass);
  return newClass;
}

export async function saveClassItemRepository(classItem) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase.from("classes").upsert(toClassRow(classItem));
      if (error) throw error;
    } catch (error) {
      console.error("Erreur sauvegarde classe Supabase:", error);
    }
  }

  return saveClassLocally(classItem);
}

export function updateClassItem(classId, updates) {
  updateClass(classId, updates);
}

export function saveSetupForClass(classId, setup) {
  saveClassSetup(classId, setup);
}

export function saveSetupForClassRepository(classId, setup) {
  return saveClassSetupRepository(classId, setup);
}

export function deleteClassCompletely(classId) {
  deleteClass(classId);
  deletePublicationState(classId);
}

export async function deleteClassCompletelyRepository(classId) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase.from("classes").delete().eq("id", classId);
      if (error) throw error;
    } catch (error) {
      console.error("Erreur suppression classe Supabase:", error);
    }
  }

  await deleteClassSetupRepository(classId);
  await deletePublicationStateRepository(classId);
  deleteClass(classId);
}
