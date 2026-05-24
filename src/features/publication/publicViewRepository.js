import {
  getClassFullData,
  getClassFullDataRepository,
  getClassesForDay,
} from "../classes/classRepository";
import { loadAssociations } from "../associations/associationsData";
import { getShowsByAssociationId, getShowById } from "../shows/showSelectors";
import { getSupabaseClient } from "../cloud/supabaseClient";
import { getDaysByShowRepository } from "../days/dayRepository";
import { getDaysByShowId } from "../days/daySelectors";
import {
  getPatternDisplayName,
  getPatternHeaders,
} from "../patterns/patternDefinitions";
import { PUBLICATION_STATUSES } from "./publicationRepository";

function toAssociation(row) {
  return {
    id: row.id,
    name: row.name || "",
    shortName: row.short_name || "",
    timezone: row.timezone || "",
    logoDataUrl: row.logo_data_url || null,
  };
}

function toShow(row) {
  return {
    id: row.id,
    associationId: row.association_id,
    name: row.name || "",
    venue: row.venue || "",
    location: row.location || "",
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    status: row.status || "draft",
  };
}

function toDay(row) {
  return {
    id: row.id,
    associationId: row.association_id,
    showId: row.show_id,
    label: row.label || "",
    date: row.date || "",
    sortOrder: row.sort_order || 1,
  };
}

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

function toPublicationState(row) {
  return {
    classId: row.class_id,
    status: row.status || PUBLICATION_STATUSES.HIDDEN,
    publishedAt: row.published_at || null,
    publishedBy: row.published_by || null,
    publicUrl: row.public_url || null,
  };
}

function toOfficialResult(row) {
  return {
    classId: row.class_id,
    judgeName: row.judge_name || "",
    finalized: Boolean(row.finalized),
    finalizedAt: row.finalized_at || null,
    judgeSignedAt: row.judge_signed_at || null,
    secretariatValidatedAt: row.secretariat_validated_at || null,
    isFinalized: Boolean(row.finalized),
    isSecretariatValidated: Boolean(row.secretariat_validated_at),
    officialRuns: Array.isArray(row.official_runs) ? row.official_runs : [],
  };
}

function toScoringSession(row) {
  return {
    classId: row.class_id,
    runs: Array.isArray(row.runs) ? row.runs : [],
    activeManoeuvre:
      row.active_manoeuvre && typeof row.active_manoeuvre === "object"
        ? row.active_manoeuvre
        : null,
  };
}

export function getPublicShowView(showId) {
  const liveClasses = [];
  const classIds = [];
  const sections = getDaysByShowId(showId).map((day) => {
    const classViews = getClassesForDay(day.id).map((classItem) => {
      if (classItem.id) {
        classIds.push(classItem.id);
      }

      const classData = getClassFullData(classItem.id);
      const liveClass = buildPublicLiveClassView({
        classItem: classData.classItem,
        publication: classData.publication,
        scoringSession: {
          runs: classData.scoringRuns,
          activeManoeuvre: null,
        },
      });

      if (liveClass) {
        liveClasses.push(liveClass);
      }

      return buildPublicClassView(classData);
    });

    return {
      day,
      classes: classViews.filter(Boolean),
    };
  });

  const publishedClassCount = sections.reduce(
    (total, section) => total + section.classes.length,
    0
  );

  return {
    sections: sections.filter((section) => section.classes.length > 0),
    publishedClassCount,
    liveClass: findPrimaryLiveClass(liveClasses),
    liveClassCount: liveClasses.length,
    classIds,
  };
}

export async function getPublicShowViewRepository(showId) {
  const supabase = getSupabaseClient();

  if (supabase) {
    return getPublicShowViewFromSupabase(showId, supabase);
  }

  const liveClasses = [];
  const classIds = [];
  const sections = await Promise.all(
    (await getDaysByShowRepository(showId)).map(async (day) => {
      const classes = getClassesForDay(day.id);
      const classViews = await Promise.all(
        classes.map(async (classItem) => {
          if (classItem.id) {
            classIds.push(classItem.id);
          }

          const classData = await getClassFullDataRepository(classItem.id);
          const liveClass = buildPublicLiveClassView({
            classItem: classData.classItem,
            publication: classData.publication,
            scoringSession: {
              runs: classData.scoringRuns,
              activeManoeuvre: null,
            },
          });

          if (liveClass) {
            liveClasses.push(liveClass);
          }

          return buildPublicClassView(classData);
        })
      );

      return {
        day,
        classes: classViews.filter(Boolean),
      };
    })
  );

  const publishedClassCount = sections.reduce(
    (total, section) => total + section.classes.length,
    0
  );

  return {
    sections: sections.filter((section) => section.classes.length > 0),
    publishedClassCount,
    liveClass: findPrimaryLiveClass(liveClasses),
    liveClassCount: liveClasses.length,
    classIds,
  };
}

export function subscribePublicShowViewRepository(showId, classIds, onChange) {
  const supabase = getSupabaseClient();

  if (!supabase || typeof onChange !== "function") {
    return () => {};
  }

  const uniqueClassIds = Array.from(
    new Set((Array.isArray(classIds) ? classIds : []).filter(Boolean))
  );
  const channel = supabase.channel(`public-show:${showId}`);

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "shows",
      filter: `id=eq.${showId}`,
    },
    onChange
  );

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "days",
      filter: `show_id=eq.${showId}`,
    },
    onChange
  );

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "classes",
      filter: `show_id=eq.${showId}`,
    },
    onChange
  );

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "publication_states",
    },
    onChange
  );

  uniqueClassIds.forEach((classId) => {
    ["official_results", "scoring_sessions"].forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `class_id=eq.${classId}`,
        },
        onChange
      );
    });
  });

  channel.subscribe((status) => {
    if (status === "CHANNEL_ERROR") {
      console.error("Erreur abonnement temps réel résultats publics Supabase.");
    }
  });

  return () => {
    supabase.removeChannel(channel);
  };
}

async function getPublicShowViewFromSupabase(showId, supabase) {
  try {
    const { data: dayRows, error: daysError } = await supabase
      .from("days")
      .select("*")
      .eq("show_id", showId)
      .order("sort_order", { ascending: true })
      .order("date", { ascending: true, nullsFirst: false });

    if (daysError) throw daysError;

    const days = Array.isArray(dayRows) ? dayRows.map(toDay) : [];
    const liveClasses = [];
    const allClassIds = [];
    const sections = await Promise.all(
      days.map(async (day) => {
        const { data: classRows, error: classesError } = await supabase
          .from("classes")
          .select("*")
          .eq("day_id", day.id)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });

        if (classesError) throw classesError;

        const classes = Array.isArray(classRows) ? classRows.map(toClass) : [];
        const classIds = classes.map((classItem) => classItem.id).filter(Boolean);
        allClassIds.push(...classIds);

        if (!classIds.length) {
          return { day, classes: [] };
        }

        const [publicationResult, officialResult, scoringResult] = await Promise.all([
          supabase
            .from("publication_states")
            .select("*")
            .in("class_id", classIds),
          supabase
            .from("official_results")
            .select("*")
            .in("class_id", classIds),
          supabase
            .from("scoring_sessions")
            .select("*")
            .in("class_id", classIds),
        ]);

        if (publicationResult.error) throw publicationResult.error;
        if (officialResult.error) throw officialResult.error;
        if (scoringResult.error) {
          console.error("Erreur chargement live public Supabase:", scoringResult.error);
        }

        const publicationsByClassId = new Map(
          (publicationResult.data || []).map((row) => [
            row.class_id,
            toPublicationState(row),
          ])
        );
        const officialByClassId = new Map(
          (officialResult.data || []).map((row) => [
            row.class_id,
            toOfficialResult(row),
          ])
        );
        const scoringByClassId = new Map(
          (scoringResult.data || []).map((row) => [
            row.class_id,
            toScoringSession(row),
          ])
        );

        const classViews = classes.map((classItem) => {
          const publication = publicationsByClassId.get(classItem.id);
          const liveClass = buildPublicLiveClassView({
            classItem,
            publication,
            scoringSession: scoringByClassId.get(classItem.id),
          });

          if (liveClass) {
            liveClasses.push(liveClass);
          }

          return buildPublicClassView({
            classItem,
            setup: null,
            publication,
            official: officialByClassId.get(classItem.id),
            scoringRuns: [],
          });
        });

        return {
          day,
          classes: classViews.filter(Boolean),
        };
      })
    );

    const publishedClassCount = sections.reduce(
      (total, section) => total + section.classes.length,
      0
    );

    return {
      sections: sections.filter((section) => section.classes.length > 0),
      publishedClassCount,
      liveClass: findPrimaryLiveClass(liveClasses),
      liveClassCount: liveClasses.length,
      classIds: allClassIds,
    };
  } catch (error) {
    console.error("Erreur chargement résultats publics Supabase:", error);
    return getPublicShowView(showId);
  }
}

export async function getPublicAssociationsRepository() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return loadAssociations();
  }

  try {
    const { data, error } = await supabase
      .from("associations")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    return Array.isArray(data) ? data.map(toAssociation) : [];
  } catch (error) {
    console.error("Erreur chargement associations publiques Supabase:", error);
    return [];
  }
}

export async function getPublicAssociationRepository(associationId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return (
      loadAssociations().find((association) => association.id === associationId) ||
      null
    );
  }

  try {
    const { data, error } = await supabase
      .from("associations")
      .select("*")
      .eq("id", associationId)
      .maybeSingle();

    if (error) throw error;
    return data ? toAssociation(data) : null;
  } catch (error) {
    console.error("Erreur chargement association publique Supabase:", error);
    return null;
  }
}

export async function getPublicShowRepository(showId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return getShowById(showId) || null;
  }

  try {
    const { data, error } = await supabase
      .from("shows")
      .select("*")
      .eq("id", showId)
      .maybeSingle();

    if (error) throw error;
    return data ? toShow(data) : null;
  } catch (error) {
    console.error("Erreur chargement show public Supabase:", error);
    return null;
  }
}

export async function getPublicShowsByAssociationRepository(associationId) {
  const supabase = getSupabaseClient();

  try {
    const shows = supabase
      ? await getPublicShowsByAssociationFromSupabase(associationId, supabase)
      : getShowsByAssociationId(associationId);
    const showsWithCounts = await Promise.all(
      shows.map(async (show) => {
        const view = await getPublicShowViewRepository(show.id);
        return {
          ...show,
          publishedClassCount: view.publishedClassCount,
          liveClassCount: view.liveClassCount || 0,
        };
      })
    );

    return showsWithCounts.filter(
      (show) => show.publishedClassCount > 0 || show.liveClassCount > 0
    );
  } catch (error) {
    console.error("Erreur chargement shows publics:", error);
    return [];
  }
}

async function getPublicShowsByAssociationFromSupabase(associationId, supabase) {
  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .eq("association_id", associationId)
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw error;

  return Array.isArray(data) ? data.map(toShow) : [];
}

export function buildPublicClassView(classData) {
  const publication = classData.publication;
  const official = classData.official;

  if (
    publication?.status !== PUBLICATION_STATUSES.PUBLISHED ||
    !official?.isSecretariatValidated
  ) {
    return null;
  }

  const classItem = classData.classItem;
  const officialRuns = Array.isArray(official.officialRuns)
    ? official.officialRuns
    : [];
  const runs = sortPublicResults(
    officialRuns.length > 0 ? officialRuns : classData.scoringRuns || []
  );

  return {
    classId: classItem?.id,
    className: classItem?.name || "Classe",
    classCode: classItem?.classCode || "",
    pattern:
      getPatternDisplayName(
        official.pattern || classData.setup?.pattern || classItem?.pattern || ""
      ) ||
      official.pattern ||
      classData.setup?.pattern ||
      classItem?.pattern ||
      "",
    publishedAt: publication.publishedAt,
    finalizedAt: official.finalizedAt,
    judgeName: official.judgeName,
    runs,
  };
}

export function buildPublicLiveClassView({ classItem, publication, scoringSession }) {
  if (publication?.status !== PUBLICATION_STATUSES.LIVE) {
    return null;
  }

  const runs = Array.isArray(scoringSession?.runs)
    ? scoringSession.runs.map((run, index) =>
        normalizePublicLiveRun(run, index, classItem?.pattern || "")
      )
    : [];

  if (!runs.length) {
    return null;
  }

  const activeRun =
    runs.find((run) => run.draw === scoringSession?.activeManoeuvre?.draw) ||
    runs.find((run) => run.isActive) ||
    null;
  const lastPassedRuns = findLastPassedRuns(runs, activeRun, 2);

  return {
    classId: classItem?.id,
    className: classItem?.name || "Classe",
    classCode: classItem?.classCode || "",
    pattern: getPatternDisplayName(classItem?.pattern || "") || classItem?.pattern || "",
    activeRun,
    nextRun: findNextRun(runs, activeRun),
    lastPassedRuns,
    latestScore: [...runs].reverse().find(runHasScore) || null,
  };
}

function normalizePublicLiveRun(run, index, pattern) {
  const scores = Array.isArray(run.scores) ? run.scores : [];
  const penalties = Array.isArray(run.penalties) ? run.penalties : [];
  const headers = getPatternHeaders(pattern);

  return {
    id: run.id,
    draw: run.draw ?? run.order ?? index + 1,
    backNumber: run.backNumber || "",
    rider: run.rider || "",
    horse: run.horse || "",
    owner: run.owner || "",
    scoreTotal: run.scoreTotal ?? "",
    penTotal: run.penTotal ?? "",
    isActive: Boolean(run.isActive),
    isReview: String(run.scoreTotal ?? "").trim() === "Review",
    manoeuvres: headers.map((name, manoeuvreIndex) => ({
      name,
      score: scores[manoeuvreIndex] || "",
      penalty: penalties[manoeuvreIndex] || "",
    })),
  };
}

function findPrimaryLiveClass(liveClasses) {
  return (
    liveClasses.find((classView) => classView.activeRun) ||
    liveClasses.find((classView) => classView.latestScore) ||
    liveClasses[0] ||
    null
  );
}

function findNextRun(runs, activeRun) {
  if (!runs.length) return null;

  if (!activeRun) {
    return runs.find((run) => !runHasScore(run) && !run.isReview) || null;
  }

  const activeIndex = runs.findIndex((run) =>
    run.id ? run.id === activeRun.id : run.draw === activeRun.draw
  );

  if (activeIndex < 0) return null;

  return (
    runs.slice(activeIndex + 1).find((run) => !runHasScore(run) && !run.isReview) ||
    null
  );
}

function findLastPassedRuns(runs, activeRun, count) {
  if (!activeRun) {
    return runs.filter(runHasScore).slice(-count).reverse();
  }

  const activeIndex = runs.findIndex((run) =>
    run.id ? run.id === activeRun.id : run.draw === activeRun.draw
  );

  if (activeIndex <= 0) {
    return [];
  }

  return runs.slice(0, activeIndex).slice(-count).reverse();
}

function runHasScore(run) {
  const score = String(run?.scoreTotal ?? "").trim();
  return Boolean(score && score !== "Review");
}

export function sortPublicResults(runs) {
  return [...runs]
    .map(normalizePublicRun)
    .sort((a, b) => {
      const aScore = parsePublicScore(a.scoreTotal);
      const bScore = parsePublicScore(b.scoreTotal);

      if (aScore != null && bScore != null && aScore !== bScore) {
        return bScore - aScore;
      }

      if (aScore != null && bScore == null) return -1;
      if (aScore == null && bScore != null) return 1;

      return a.draw - b.draw;
    })
    .map((run, index) => ({
      ...run,
      rank: index + 1,
    }));
}

function normalizePublicRun(run, index) {
  return {
    id: run.id,
    draw: run.draw ?? run.order ?? index + 1,
    backNumber: run.backNumber || "",
    rider: run.rider || "",
    horse: run.horse || "",
    owner: run.owner || "",
    scoreTotal: run.scoreTotal ?? "",
    penTotal: run.penTotal ?? "",
  };
}

function parsePublicScore(value) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}
