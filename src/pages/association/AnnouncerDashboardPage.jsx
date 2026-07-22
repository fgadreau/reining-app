import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getAnnouncerShowView,
  getAnnouncerShowViewRepository,
  subscribeAnnouncerShowViewRepository,
} from "../../features/live/liveViewRepository";
import {
  saveClassLiveDisplayModeRepository,
  saveClassScheduleDetailsRepository,
} from "../../features/classes/classSetupRepository";
import { normalizeClassScheduleDetails } from "../../features/classes/classSchedule";
import { formatLiveDataFreshness } from "../../features/live/liveFreshness";
import {
  advanceArenaLiveClassAfterCompletionRepository,
  advanceArenaLivePaidWarmupAfterCompletionRepository,
} from "../../features/publication/publicationCloudRepository";
import { savePaidWarmupRepository } from "../../features/paidWarmups/paidWarmupRepository";
import {
  PAID_WARMUP_TIMER_CUES,
  formatPaidWarmupTimer,
  getPaidWarmupRemainingSeconds,
  getPaidWarmupTimerCueType,
  resetPaidWarmupTimer,
  setPaidWarmupEntryStatus,
  startPaidWarmupDrag,
  startPaidWarmupEntry,
  stopPaidWarmupDrag,
  stopPaidWarmupTimer,
} from "../../features/paidWarmups/paidWarmupLive";
import { isLiveDragItem } from "../../features/live/liveQueueItems";
import {
  LIVE_DATA_SOURCES,
  LIVE_DISPLAY_MODES,
} from "../../features/live/liveDataSource";
import {
  ANNOUNCER_RUN_STATUSES,
  buildAnnouncerJudgeScoreResult,
  completeAnnouncerLiveSession,
  getAnnouncerLiveActivationStatus,
  reopenAnnouncerLiveSession,
  saveAnnouncerRunResultAndAdvance,
  startAnnouncerDrag,
  startAnnouncerRun,
  stopAnnouncerDragAndAdvance,
} from "../../features/live/announcerLiveSession";
import {
  activateAnnouncerLivePublicationRepository,
  getAnnouncerLiveSessionSyncStatus,
  saveAnnouncerLiveSessionRepository,
} from "../../features/live/announcerLiveRepository";
import { buildQualifiedRiderList } from "../../features/results/qualifiedRiders";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { PUBLICATION_STATUSES } from "../../features/publication/publicationRepository";
import { getShowById } from "../../features/shows/showSelectors";
import {
  buildQualifiedRidersPdfFileName,
  generateQualifiedRidersPdf,
} from "../../utils/generateQualifiedRidersPdf";
import { parseScoreTotalValue } from "../../utils/scoring";
import {
  buildClassResultsPdfFileName,
  generateClassResultsPdf,
} from "../../utils/generateResultsPdf";
import { appStyles as styles } from "../../styles/appStyles";
import ClassPaceSummary from "../../components/ClassPaceSummary";

let paidWarmupAudioContext = null;

const ANNOUNCER_LIVE_FALLBACK_REFRESH_MS = 5000;

const ANNOUNCER_LIVE_ITEM_TYPES = {
  CLASS: "class",
  PAID_WARMUP: "paidWarmup",
};

const PAID_WARMUP_SOUND_SEQUENCES = {
  [PAID_WARMUP_TIMER_CUES.HALF_TIME]: [
    { at: 0, frequency: 740, duration: 0.16, gain: 0.14, type: "sine" },
  ],
  [PAID_WARMUP_TIMER_CUES.ONE_MINUTE]: [
    { at: 0, frequency: 880, duration: 0.12, gain: 0.16, type: "square" },
    { at: 0.2, frequency: 880, duration: 0.12, gain: 0.16, type: "square" },
  ],
  [PAID_WARMUP_TIMER_CUES.FINISHED]: [
    { at: 0, frequency: 1175, duration: 0.18, gain: 0.2, type: "triangle" },
    { at: 0.24, frequency: 988, duration: 0.18, gain: 0.2, type: "triangle" },
    { at: 0.48, frequency: 784, duration: 0.28, gain: 0.22, type: "triangle" },
  ],
};

function isPaidWarmupComplete(warmup) {
  const entries = Array.isArray(warmup?.entries) ? warmup.entries : [];

  return (
    entries.length > 0 &&
    !warmup?.activeEntryId &&
    entries.every((entry) =>
      ["done", "no_show", "scratch"].includes(entry?.status)
    )
  );
}

function getPaidWarmupAudioContext({ shouldCreate = true } = {}) {
  if (typeof window === "undefined") return null;

  const AudioContextConstructor =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) return null;

  if (!paidWarmupAudioContext && !shouldCreate) {
    return null;
  }

  if (!paidWarmupAudioContext) {
    paidWarmupAudioContext = new AudioContextConstructor();
  }

  if (paidWarmupAudioContext.state === "suspended") {
    paidWarmupAudioContext.resume().catch(() => {});
  }

  return paidWarmupAudioContext;
}

function primePaidWarmupCueAudio() {
  return Boolean(getPaidWarmupAudioContext());
}

function playPaidWarmupCueAudio(cueType) {
  const audioContext = getPaidWarmupAudioContext({ shouldCreate: false });
  const sequence = PAID_WARMUP_SOUND_SEQUENCES[cueType];

  if (!audioContext || !sequence) return false;

  const startAt = audioContext.currentTime + 0.02;

  sequence.forEach((note) => {
    playTone(audioContext, {
      ...note,
      startAt: startAt + note.at,
    });
  });

  return true;
}

function playTone(audioContext, note) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const startAt = note.startAt;
  const endAt = startAt + note.duration;

  oscillator.type = note.type;
  oscillator.frequency.setValueAtTime(note.frequency, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(note.gain, startAt + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.04);
}

function AnnouncerDashboardPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const access = useAssociationAccess(associationId);
  const show = getShowById(showId);
  const [liveView, setLiveView] = useState(() => getAnnouncerShowView(showId));
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [rankingClass, setRankingClass] = useState(null);
  const [qualifiedRidersClass, setQualifiedRidersClass] = useState(null);
  const [announcerSyncStatuses, setAnnouncerSyncStatuses] = useState({});
  const [isPaidWarmupAudioReady, setIsPaidWarmupAudioReady] = useState(false);
  const [paidWarmupUndoSnapshots, setPaidWarmupUndoSnapshots] = useState({});
  const autoCompletedPaidWarmupKeyRef = useRef(null);
  const paidWarmupAudioCueKeysRef = useRef(new Set());
  const liveClassIdsKey = useMemo(
    () => getLiveViewClassIds(liveView).join("|"),
    [liveView]
  );
  const priorityLiveItems = useMemo(
    () => getPriorityLiveItems(liveView),
    [liveView]
  );
  const priorityLiveItemKeys = useMemo(
    () => new Set(priorityLiveItems.map(getLiveItemKey)),
    [priorityLiveItems]
  );
  const remainingSections = useMemo(
    () => getRemainingLiveSections(liveView, priorityLiveItemKeys),
    [liveView, priorityLiveItemKeys]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const refreshLiveViewNow = useCallback(async () => {
    const nextLiveView = await getAnnouncerShowViewRepository(showId);
    setLiveView(nextLiveView);
    setIsLoading(false);
  }, [showId]);

  const savePaidWarmupUpdate = useCallback(async (nextWarmup) => {
    const saved = await savePaidWarmupRepository(nextWarmup);

    if (saved?.isPublicLive && isPaidWarmupComplete(saved)) {
      await advanceArenaLivePaidWarmupAfterCompletionRepository({
        showId,
        arena: saved.arena,
        paidWarmupId: saved.id,
      });
    }

    await refreshLiveViewNow();
  }, [refreshLiveViewNow, showId]);

  const saveScheduleDetailsUpdate = useCallback(async (classView, details) => {
    await saveClassScheduleDetailsRepository(classView.classId, details);

    if (details?.isCompleted) {
      await advanceArenaLiveClassAfterCompletionRepository({
        showId,
        arena: classView.arena,
        classId: classView.classId,
      });
    }

    await refreshLiveViewNow();
  }, [refreshLiveViewNow, showId]);

  const saveLiveDisplayModeUpdate = useCallback(
    async (classView, mode) => {
      await saveClassLiveDisplayModeRepository(classView.classId, mode);
      await refreshLiveViewNow();
    },
    [refreshLiveViewNow]
  );

  const saveAnnouncerSessionUpdate = useCallback(
    async (classView, nextSession) => {
      if (
        !classView?.classId ||
        classView.liveDataSource !== LIVE_DATA_SOURCES.ANNOUNCER
      ) {
        return null;
      }

      const saved = await saveAnnouncerLiveSessionRepository(
        classView.classId,
        nextSession,
        {
          onStatusChange: (status) => {
            setAnnouncerSyncStatuses((current) => ({
              ...current,
              [classView.classId]: status,
            }));
          },
        }
      );
      const activationStatus = getAnnouncerLiveActivationStatus({
        session: saved,
        publicationStatus: classView.publicationStatus,
        plannedLiveStatus: classView.plannedLiveStatus,
      });

      if (activationStatus) {
        try {
          await activateAnnouncerLivePublicationRepository(classView.classId);
        } catch (error) {
          console.error("Erreur activation live annonceur Supabase:", error);
        }
      }

      await refreshLiveViewNow();
      return saved;
    },
    [refreshLiveViewNow]
  );

  const rememberPaidWarmupUndo = useCallback((warmup) => {
    if (!warmup?.id) return;

    setPaidWarmupUndoSnapshots((current) => ({
      ...current,
      [warmup.id]: {
        ...warmup,
        entries: Array.isArray(warmup.entries)
          ? warmup.entries.map((entry) => ({ ...entry }))
          : [],
      },
    }));
  }, []);

  const handleStartPaidWarmupEntry = (warmup, entryId) => {
    setIsPaidWarmupAudioReady(primePaidWarmupCueAudio());
    rememberPaidWarmupUndo(warmup);
    return savePaidWarmupUpdate(startPaidWarmupEntry(warmup, entryId, new Date()));
  };

  const handleResetPaidWarmupTimer = (warmup) => {
    setIsPaidWarmupAudioReady(primePaidWarmupCueAudio());
    rememberPaidWarmupUndo(warmup);
    return savePaidWarmupUpdate(resetPaidWarmupTimer(warmup, new Date()));
  };

  const handleStopPaidWarmupTimer = (warmup) => {
    rememberPaidWarmupUndo(warmup);
    return savePaidWarmupUpdate(stopPaidWarmupTimer(warmup));
  };

  const handleStartPaidWarmupDrag = (warmup) => {
    rememberPaidWarmupUndo(warmup);
    return savePaidWarmupUpdate(startPaidWarmupDrag(warmup, new Date()));
  };

  const handleStopPaidWarmupDrag = (warmup) => {
    rememberPaidWarmupUndo(warmup);
    return savePaidWarmupUpdate(stopPaidWarmupDrag(warmup));
  };

  const handleSetPaidWarmupEntryStatus = (warmup, entryId, status) => {
    rememberPaidWarmupUndo(warmup);
    return savePaidWarmupUpdate(setPaidWarmupEntryStatus(warmup, entryId, status));
  };

  const handleUndoPaidWarmupAction = async (warmup) => {
    const snapshot = paidWarmupUndoSnapshots[warmup?.id];
    if (!snapshot) return;

    await savePaidWarmupUpdate(snapshot);
    setPaidWarmupUndoSnapshots((current) => {
      const next = { ...current };
      delete next[warmup.id];
      return next;
    });
  };

  const handleEnablePaidWarmupAudio = () => {
    setIsPaidWarmupAudioReady(primePaidWarmupCueAudio());
  };

  useEffect(() => {
    const warmup = liveView.activePaidWarmup;

    if (!warmup?.activeEntry) {
      return;
    }

    const remainingSeconds = getPaidWarmupRemainingSeconds(warmup, now);
    const cueType = getPaidWarmupTimerCueType(warmup, remainingSeconds);

    if (!cueType) {
      return;
    }

    const cueKey = [
      warmup.id,
      warmup.activeEntry.id,
      warmup.activeStartedAt,
      cueType,
    ].join(":");

    if (paidWarmupAudioCueKeysRef.current.has(cueKey)) {
      return;
    }

    paidWarmupAudioCueKeysRef.current.add(cueKey);
    setIsPaidWarmupAudioReady(playPaidWarmupCueAudio(cueType));
  }, [liveView.activePaidWarmup, now]);

  useEffect(() => {
    const warmup = liveView.activePaidWarmup;

    if (!warmup?.activeEntry) {
      return;
    }

    const remainingSeconds = getPaidWarmupRemainingSeconds(warmup, now);

    if (remainingSeconds == null || remainingSeconds > 0) {
      return;
    }

    const completionKey = [
      warmup.id,
      warmup.activeEntry.id,
      warmup.activeStartedAt,
    ].join(":");

    if (autoCompletedPaidWarmupKeyRef.current === completionKey) {
      return;
    }

    autoCompletedPaidWarmupKeyRef.current = completionKey;
    savePaidWarmupUpdate(stopPaidWarmupTimer(warmup));
  }, [liveView.activePaidWarmup, now, savePaidWarmupUpdate]);

  useEffect(() => {
    let isMounted = true;

    async function loadLiveView() {
      setIsLoading(true);
      const nextLiveView = await getAnnouncerShowViewRepository(showId);
      if (!isMounted) return;
      setLiveView(nextLiveView);
      setIsLoading(false);
    }

    loadLiveView();

    return () => {
      isMounted = false;
    };
  }, [showId]);

  useEffect(() => {
    let isMounted = true;
    let refreshTimeout = null;

    const refreshLiveView = () => {
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(async () => {
        const nextLiveView = await getAnnouncerShowViewRepository(showId);
        if (!isMounted) return;
        setLiveView(nextLiveView);
        setIsLoading(false);
      }, 200);
    };

    const unsubscribe = subscribeAnnouncerShowViewRepository(
      showId,
      liveClassIdsKey ? liveClassIdsKey.split("|") : [],
      refreshLiveView
    );

    return () => {
      isMounted = false;
      window.clearTimeout(refreshTimeout);
      unsubscribe();
    };
  }, [showId, liveClassIdsKey]);

  useEffect(() => {
    let isMounted = true;
    const refreshTimer = window.setInterval(async () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      const nextLiveView = await getAnnouncerShowViewRepository(showId);
      if (!isMounted) return;
      setLiveView(nextLiveView);
      setIsLoading(false);
    }, ANNOUNCER_LIVE_FALLBACK_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
    };
  }, [showId]);

  if (!show) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={emptyStateStyle}>{t("public.results.showNotFound")}</div>
      </div>
    );
  }

  if (!access.isLoadingAccess && !access.canAnnounceAssociation) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={emptyStateStyle}>
          {t("management.announcer.accessDenied")}
        </div>
      </div>
    );
  }

  return (
    <div style={announcerPageStyle}>
      <div style={announcerBackRowStyle}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
      </div>

      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>{t("nav.announcer")}</div>
          <h1 style={titleStyle}>{show.name || t("common.show")}</h1>
          <div style={subtitleStyle}>
            {show.venue || show.location || t("public.results.venueTbd")}
          </div>
        </div>
        <div style={heroActionRowStyle}>
          <button
            type="button"
            onClick={handleEnablePaidWarmupAudio}
            style={secondaryButtonStyle}
          >
            {isPaidWarmupAudioReady
              ? t("management.announcer.soundAlertsReady")
              : t("management.announcer.enableSoundAlerts")}
          </button>
          {access.canManageAssociation && (
            <Link
              to={`/associations/${associationId}/shows/${showId}/secretariat`}
              style={linkButtonStyle}
            >
              {t("nav.secretariat")}
            </Link>
          )}
        </div>
      </section>

      {isLoading && (
        <div style={emptyStateStyle}>{t("management.announcer.loading")}</div>
      )}

      {priorityLiveItems.length > 0 && (
        <section style={prioritySectionStyle}>
          <div style={priorityHeaderStyle}>
            <div>
              <h2 style={priorityTitleStyle}>{t("public.results.inProgress")}</h2>
              <div style={mutedTextStyle}>{show.name || t("common.show")}</div>
            </div>
          </div>
          <div style={priorityListStyle}>
            {priorityLiveItems.map((item) =>
              item.type === ANNOUNCER_LIVE_ITEM_TYPES.PAID_WARMUP ? (
                <PaidWarmupLiveCard
                  key={getLiveItemKey(item)}
                  warmup={item.warmup}
                  now={now}
                  isPriority
                  onStartEntry={handleStartPaidWarmupEntry}
                  onResetTimer={handleResetPaidWarmupTimer}
                  onStopTimer={handleStopPaidWarmupTimer}
                  onStartDrag={handleStartPaidWarmupDrag}
                  onStopDrag={handleStopPaidWarmupDrag}
                  onSetEntryStatus={handleSetPaidWarmupEntryStatus}
                  onUndoAction={handleUndoPaidWarmupAction}
                  canUndo={Boolean(paidWarmupUndoSnapshots[item.warmup.id])}
                />
              ) : (
                <ClassLiveCard
                  key={getLiveItemKey(item)}
                  classView={item.classView}
                  showName={show.name}
                  now={now}
                  isPriority
                  onOpenProvisionalRanking={setRankingClass}
                  onOpenQualifiedRiders={setQualifiedRidersClass}
                  onSaveScheduleDetails={saveScheduleDetailsUpdate}
                  onSaveLiveDisplayMode={saveLiveDisplayModeUpdate}
                  onSaveAnnouncerSession={saveAnnouncerSessionUpdate}
                  announcerSyncStatus={
                    announcerSyncStatuses[item.classView.classId] ||
                    getAnnouncerLiveSessionSyncStatus(item.classView.classId)
                  }
                  updatedBy={access.user?.id || null}
                />
              )
            )}
          </div>
        </section>
      )}

      <div style={remainingSectionListStyle}>
        {remainingSections.map((section) => (
          <section key={section.day.id} style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>
                  {section.day.label || t("management.days.dayFallback")}
                </h2>
                <div style={mutedTextStyle}>
                  {section.day.date || t("public.results.dateTbd")} ·{" "}
                  {t("management.announcer.dayCounts", {
                    classCount: section.classes.length,
                    warmupCount: (section.paidWarmups || []).length,
                  })}
                </div>
              </div>
            </div>

            {section.classes.length === 0 &&
            (section.paidWarmups || []).length === 0 ? (
              <div style={softEmptyStyle}>
                {t("management.classes.emptyDay")}
              </div>
            ) : (
              <div style={classListStyle}>
                {section.classes.map((classView) => (
                  <ClassLiveCard
                    key={classView.classId}
                    classView={classView}
                    showName={show.name}
                    now={now}
                    onOpenProvisionalRanking={setRankingClass}
                    onOpenQualifiedRiders={setQualifiedRidersClass}
                    onSaveScheduleDetails={saveScheduleDetailsUpdate}
                    onSaveLiveDisplayMode={saveLiveDisplayModeUpdate}
                    onSaveAnnouncerSession={saveAnnouncerSessionUpdate}
                    announcerSyncStatus={
                      announcerSyncStatuses[classView.classId] ||
                      getAnnouncerLiveSessionSyncStatus(classView.classId)
                    }
                    updatedBy={access.user?.id || null}
                  />
                ))}
                {(section.paidWarmups || []).map((warmup) => (
                  <PaidWarmupLiveCard
                    key={warmup.id}
                    warmup={warmup}
                    now={now}
                    onStartEntry={handleStartPaidWarmupEntry}
                    onResetTimer={handleResetPaidWarmupTimer}
                    onStopTimer={handleStopPaidWarmupTimer}
                    onStartDrag={handleStartPaidWarmupDrag}
                    onStopDrag={handleStopPaidWarmupDrag}
                    onSetEntryStatus={handleSetPaidWarmupEntryStatus}
                    onUndoAction={handleUndoPaidWarmupAction}
                    canUndo={Boolean(paidWarmupUndoSnapshots[warmup.id])}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {!isLoading &&
        priorityLiveItems.length === 0 &&
        remainingSections.length === 0 && (
          <div style={softEmptyStyle}>{t("management.classes.emptyDay")}</div>
        )}

      {rankingClass && (
        <ProvisionalRankingModal
          classView={rankingClass}
          onClose={() => setRankingClass(null)}
        />
      )}

      {qualifiedRidersClass && (
        <QualifiedRidersModal
          classView={qualifiedRidersClass}
          showName={show.name}
          onClose={() => setQualifiedRidersClass(null)}
        />
      )}
    </div>
  );
}

function getLiveViewClassIds(liveView) {
  return (liveView?.sections || [])
    .flatMap((section) => section.classes || [])
    .map((classView) => classView.classId)
    .filter(Boolean);
}

function getPriorityLiveItems(liveView) {
  return (liveView?.sections || []).flatMap((section) => [
    ...(section.paidWarmups || [])
      .filter(isPriorityPaidWarmup)
      .map((warmup) => ({
        type: ANNOUNCER_LIVE_ITEM_TYPES.PAID_WARMUP,
        day: section.day,
        warmup,
      })),
    ...(section.classes || [])
      .filter(isPriorityClassView)
      .map((classView) => ({
        type: ANNOUNCER_LIVE_ITEM_TYPES.CLASS,
        day: section.day,
        classView,
      })),
  ]);
}

function getRemainingLiveSections(liveView, priorityKeys) {
  const sourceSections = Array.isArray(liveView?.sections) ? liveView.sections : [];
  const keySet = priorityKeys instanceof Set ? priorityKeys : new Set();

  return sourceSections
    .map((section) => {
      const classes = (section.classes || []).filter(
        (classView) => !keySet.has(getClassLiveItemKey(classView))
      );
      const paidWarmups = (section.paidWarmups || []).filter(
        (warmup) => !keySet.has(getPaidWarmupLiveItemKey(warmup))
      );

      return {
        ...section,
        classes,
        paidWarmups,
      };
    })
    .filter(
      (section) =>
        (section.classes || []).length > 0 ||
        (section.paidWarmups || []).length > 0
    );
}

function isPriorityClassView(classView) {
  return Boolean(
    classView?.activeDragItem ||
      classView?.activeRun ||
      (classView?.scoringStarted && classView?.nextRun) ||
      (classView?.isScheduleOnly &&
        !classView?.isComplete &&
        classView?.publicationStatus === PUBLICATION_STATUSES.LIVE_NO_SCORE)
  );
}

function isPriorityPaidWarmup(warmup) {
  return Boolean(
    warmup?.activeEntry ||
      warmup?.stagedEntry ||
      warmup?.onCourseEntry ||
      warmup?.isDragDue ||
      (warmup?.isPublicLive &&
        !isPaidWarmupComplete(warmup) &&
        (warmup?.nextEntry || warmup?.secondNextEntry))
  );
}

function getLiveItemKey(item) {
  if (item?.type === ANNOUNCER_LIVE_ITEM_TYPES.PAID_WARMUP) {
    return getPaidWarmupLiveItemKey(item.warmup);
  }

  return getClassLiveItemKey(item?.classView);
}

function getClassLiveItemKey(classView) {
  return `${ANNOUNCER_LIVE_ITEM_TYPES.CLASS}:${classView?.classId || ""}`;
}

function getPaidWarmupLiveItemKey(warmup) {
  return `${ANNOUNCER_LIVE_ITEM_TYPES.PAID_WARMUP}:${warmup?.id || ""}`;
}

function ScheduleOnlyAnnouncerPanel({ classView, draft, onChange, onSave }) {
  const { t } = useTranslation();
  const normalizedDraft = normalizeClassScheduleDetails(draft);
  const currentDetails = normalizeClassScheduleDetails(classView.scheduleDetails);
  const details = getScheduleDetailsParts(currentDetails, t);
  const sectionCount = Number.parseInt(normalizedDraft.sectionCount, 10) || 0;
  const completedSectionCount = normalizedDraft.completedSectionCount || 0;
  const nextSectionNumber = completedSectionCount + 1;
  const canCompleteNextSection =
    sectionCount > 0 && completedSectionCount < sectionCount;
  const allSectionsCompleted =
    sectionCount > 0 && completedSectionCount >= sectionCount;

  function updateField(field, value) {
    onChange(normalizeClassScheduleDetails({
      ...normalizedDraft,
      [field]: value,
    }));
  }

  function saveNextDetails(updates) {
    const nextDetails = normalizeClassScheduleDetails({
      ...normalizedDraft,
      ...updates,
    });
    onChange(nextDetails);
    onSave(nextDetails);
  }

  return (
    <div style={scheduleOnlyPanelStyle}>
      <div>
        <div style={runLabelStyle}>{t("public.results.classInProgress")}</div>
        <div style={classNameStyle}>{classView.className}</div>
        <div style={scheduleProgressStyle}>
          {getScheduleProgressLabel(currentDetails, t)}
        </div>
        {details.length ? (
          <div style={scheduleDetailListStyle}>
            {details.map((detail) => (
              <span key={detail} style={scheduleDetailStyle}>
                {detail}
              </span>
            ))}
          </div>
        ) : (
          <div style={mutedTextStyle}>{t("public.results.scheduleOnly")}</div>
        )}
      </div>

      <div style={scheduleEditorGridStyle}>
        <div>
          <label style={formLabelStyle}>
            {t("management.classSetup.completedSectionCount")}
          </label>
          <input
            type="number"
            min="0"
            max={normalizedDraft.sectionCount || undefined}
            value={normalizedDraft.completedSectionCount || ""}
            onChange={(event) =>
              updateField("completedSectionCount", event.target.value)
            }
            style={formInputStyle}
          />
        </div>
      </div>

      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={Boolean(normalizedDraft.hasFinal)}
          onChange={(event) =>
            updateField("hasFinal", event.target.checked)
          }
        />
        {t("management.classSetup.hasFinal")}
      </label>

      <div style={scheduleActionGridStyle}>
        <button
          type="button"
          onClick={() =>
            saveNextDetails({
              completedSectionCount: nextSectionNumber,
              isCompleted: false,
              completedAt: null,
            })
          }
          style={secondaryButtonStyle}
          disabled={!canCompleteNextSection || normalizedDraft.isCompleted}
        >
          {t("management.announcer.markSectionComplete", {
            number: nextSectionNumber,
          })}
        </button>

        <button
          type="button"
          onClick={() =>
            saveNextDetails({
              completedSectionCount: Math.max(completedSectionCount - 1, 0),
              finalCompleted: false,
              isCompleted: false,
              completedAt: null,
            })
          }
          style={secondaryButtonStyle}
          disabled={completedSectionCount <= 0}
        >
          {t("management.announcer.undoSectionComplete")}
        </button>

        {normalizedDraft.hasFinal && (
          <button
            type="button"
            onClick={() =>
              saveNextDetails({
                finalCompleted: true,
                isCompleted: false,
                completedAt: null,
              })
            }
            style={secondaryButtonStyle}
            disabled={
              normalizedDraft.finalCompleted ||
              normalizedDraft.isCompleted ||
              (sectionCount > 0 && !allSectionsCompleted)
            }
          >
            {t("management.announcer.markFinalComplete")}
          </button>
        )}

        {!normalizedDraft.isCompleted ? (
          <button
            type="button"
            onClick={() =>
              saveNextDetails({
                isCompleted: true,
                completedAt: new Date().toISOString(),
              })
            }
            style={primaryButtonStyle}
          >
            {t("management.announcer.markClassComplete")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              saveNextDetails({
                isCompleted: false,
                completedAt: null,
              })
            }
            style={secondaryButtonStyle}
          >
            {t("management.announcer.reopenClass")}
          </button>
        )}
      </div>

      <div style={scheduleEditorGridStyle}>
        <div>
          <label style={formLabelStyle}>
            {t("management.classSetup.participantCount")}
          </label>
          <input
            type="number"
            min="0"
            value={normalizedDraft.participantCount || ""}
            onChange={(event) =>
              updateField("participantCount", event.target.value)
            }
            style={formInputStyle}
          />
        </div>
        <div>
          <label style={formLabelStyle}>
            {t("management.classSetup.sectionCount")}
          </label>
          <input
            type="number"
            min="0"
            value={normalizedDraft.sectionCount || ""}
            onChange={(event) => updateField("sectionCount", event.target.value)}
            style={formInputStyle}
          />
        </div>
        <div>
          <label style={formLabelStyle}>
            {t("management.classSetup.sectionSize")}
          </label>
          <input
            type="number"
            min="0"
            value={normalizedDraft.sectionSize || ""}
            onChange={(event) => updateField("sectionSize", event.target.value)}
            style={formInputStyle}
          />
        </div>
      </div>

      <label style={formLabelStyle}>
        {t("management.classSetup.scheduleNote")}
      </label>
      <textarea
        value={normalizedDraft.note || ""}
        onChange={(event) => updateField("note", event.target.value)}
        placeholder={t("management.classSetup.scheduleNotePlaceholder")}
        style={formTextareaStyle}
      />

      <div style={actionRowStyle}>
        <button
          type="button"
          onClick={() => onSave(normalizedDraft)}
          style={primaryButtonStyle}
        >
          {t("management.classSetup.saveScheduleDetails")}
        </button>
      </div>
    </div>
  );
}

function RecentResults({ results }) {
  return (
    <div style={recentListStyle}>
      {results.map(({ classId, className, run }) => (
        <div key={`${classId}-${run.id || run.draw}`} style={recentResultStyle}>
          <div style={recentHeaderStyle}>
            <div>
              <div style={classNameStyle}>{className}</div>
              <RunIdentity run={run} />
            </div>
            <RunScoreDisplay run={run} compact />
          </div>
          <RunNote note={run.note} />
          <ManoeuvreDetails run={run} />
        </div>
      ))}
    </div>
  );
}

function PaidWarmupLiveCard({
  warmup,
  now,
  isPriority = false,
  onStartEntry,
  onResetTimer,
  onStopTimer,
  onStartDrag,
  onStopDrag,
  onSetEntryStatus,
  onUndoAction,
  canUndo = false,
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const remainingSeconds = getPaidWarmupRemainingSeconds(warmup, now);
  const activeEntry = warmup.activeEntry;
  const stagedEntry = warmup.stagedEntry;
  const onCourseEntry = activeEntry || stagedEntry;
  const activeDragItem = warmup.activeDragItem || null;
  const nextEntry = warmup.nextEntry;
  const secondNextEntry = warmup.secondNextEntry;
  const nextLiveItem = warmup.nextLiveItem || nextEntry;
  const secondNextLiveItem = warmup.secondNextLiveItem || secondNextEntry;
  const isActiveDrag = Boolean(activeDragItem);
  const plannedDragItem =
    !isActiveDrag && isLiveDragItem(nextLiveItem) ? nextLiveItem : null;
  const startTargetEntry = !activeEntry ? onCourseEntry || nextEntry : null;
  const statusTargetEntry = stagedEntry || nextEntry;
  const isForcedOpen = Boolean(isPriority || onCourseEntry || isActiveDrag);
  const isExpanded = isForcedOpen || isOpen;
  const canToggle = !isForcedOpen;

  function toggleCard() {
    if (!canToggle) return;
    setIsOpen((current) => !current);
  }

  function handleCardKeyDown(event) {
    if (!canToggle || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    toggleCard();
  }

  return (
    <div style={isPriority ? priorityClassCardStyle : classCardStyle}>
      <div
        role={canToggle ? "button" : undefined}
        tabIndex={canToggle ? 0 : undefined}
        aria-expanded={canToggle ? isExpanded : undefined}
        onClick={canToggle ? toggleCard : undefined}
        onKeyDown={canToggle ? handleCardKeyDown : undefined}
        style={classCardHeaderToggleStyle(isExpanded, canToggle)}
      >
        <div>
          <div style={classNameStyle}>{warmup.name}</div>
          <div style={mutedTextStyle}>
            {t("management.classes.minutesPerRider", {
              minutes: warmup.durationMinutesPerRider,
            })}{" "}
            ·{" "}
            {warmup.dragInterval
              ? t("management.announcer.dragAfter", {
                  count: warmup.dragInterval,
                })
              : t("management.classes.noDragPlanned")}
          </div>
        </div>
        <div style={badgeStackStyle}>
          <LiveFreshnessBadge updatedAt={warmup.updatedAt} now={now} />
          <Badge tone={activeEntry || isActiveDrag ? "warn" : "muted"}>
            {isActiveDrag
              ? t("public.results.drag")
              : activeEntry
                ? t("management.announcer.activeTimer")
                : stagedEntry
                ? t("management.announcer.readyToStart")
              : t("public.results.paidWarmup")}
          </Badge>
          {canToggle && (
            <Badge tone="muted">
              {isExpanded ? t("public.results.hide") : t("public.results.view")}
            </Badge>
          )}
        </div>
      </div>

      {!isExpanded ? null : (
        <>
          {isActiveDrag && (
            <div style={dragNoticeStyle}>
              {t("public.results.dragInProgress", {
                minutes: warmup.dragDurationMinutes,
              })}
            </div>
          )}

          <div style={runGridStyle}>
            <div style={runBlockStyle}>
              <div style={runLabelStyle}>
                {t("management.announcer.onCourse")}
              </div>
              {isActiveDrag ? (
                <>
                  <DragIdentity item={activeDragItem} />
                  <div style={timerInlineStyle}>
                    {formatPaidWarmupTimer(warmup.dragRemainingSeconds)}
                  </div>
                </>
              ) : onCourseEntry ? (
                <>
                  <PaidWarmupEntryIdentity entry={onCourseEntry} />
                  {activeEntry ? (
                    <>
                      <div style={timerInlineStyle}>
                        {formatPaidWarmupTimer(remainingSeconds)}
                      </div>
                      <PaidWarmupTimerCue
                        warmup={warmup}
                        remainingSeconds={remainingSeconds}
                      />
                    </>
                  ) : (
                    <div style={mutedTextStyle}>
                      {t("management.announcer.readyToStart")}
                    </div>
                  )}
                </>
              ) : (
                <div style={mutedTextStyle}>—</div>
              )}
            </div>

            <PaidWarmupEntryBlock
              label={t("public.results.nextParticipant")}
              entry={nextLiveItem}
              statusLabel={t("public.results.statusPreparation")}
              status="preparation"
              emptyLabel={t("management.announcer.noPreparationRun")}
            />

            <PaidWarmupEntryBlock
              label={t("public.results.secondNextParticipant")}
              entry={secondNextLiveItem}
              statusLabel={t("public.results.statusWaiting")}
              status="waiting"
              emptyLabel={t("management.announcer.noWaitingRider")}
            />

            <div style={runBlockStyle}>
              <div style={runLabelStyle}>{t("management.announcer.stats")}</div>
              <div style={mutedTextStyle}>
                {t("management.announcer.warmupStats", {
                  total: warmup.stats.total,
                  done: warmup.stats.done,
                  noShow: warmup.stats.noShow,
                  scratch: warmup.stats.scratch,
                })}
              </div>
            </div>
          </div>

          <div style={actionRowStyle}>
            {plannedDragItem && (
              <button
                type="button"
                onClick={() => onStartDrag(warmup)}
                style={secondaryButtonStyle}
              >
                {t("management.announcer.startDrag")}
              </button>
            )}

            {isActiveDrag && (
              <button
                type="button"
                onClick={() => onStopDrag(warmup)}
                style={secondaryButtonStyle}
              >
                {t("management.announcer.stopDrag")}
              </button>
            )}

            {startTargetEntry && (
              <button
                type="button"
                onClick={() => onStartEntry(warmup, startTargetEntry.id)}
                style={primaryButtonStyle}
              >
                {stagedEntry
                  ? t("management.announcer.startOnCourse")
                  : t("management.announcer.startNext")}
              </button>
            )}

            {activeEntry && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onSetEntryStatus(warmup, activeEntry.id, "done")
                  }
                  style={primaryButtonStyle}
                >
                  {t("management.announcer.markPassed")}
                </button>
                <button
                  type="button"
                  onClick={() => onResetTimer(warmup)}
                  style={secondaryButtonStyle}
                >
                  {t("management.announcer.resetTimer")}
                </button>
                <button
                  type="button"
                  onClick={() => onStopTimer(warmup)}
                  style={secondaryButtonStyle}
                >
                  {t("management.announcer.stopAndMarkPassed")}
                </button>
              </>
            )}

            {!activeEntry && stagedEntry && (
              <button
                type="button"
                onClick={() => onSetEntryStatus(warmup, stagedEntry.id, "done")}
                style={secondaryButtonStyle}
              >
                {t("management.announcer.markPassed")}
              </button>
            )}

            {statusTargetEntry && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onSetEntryStatus(warmup, statusTargetEntry.id, "no_show")
                  }
                  style={secondaryButtonStyle}
                >
                  {stagedEntry
                    ? t("management.announcer.noShowOnCourse")
                    : t("management.announcer.noShowNext")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSetEntryStatus(warmup, statusTargetEntry.id, "scratch")
                  }
                  style={secondaryButtonStyle}
                >
                  {stagedEntry
                    ? t("management.announcer.scratchOnCourse")
                    : t("management.announcer.scratchNext")}
                </button>
              </>
            )}

            {canUndo && (
              <button
                type="button"
                onClick={() => onUndoAction(warmup)}
                style={secondaryButtonStyle}
              >
                {t("management.announcer.undoWarmupAction")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PaidWarmupEntryBlock({
  label,
  entry,
  statusLabel,
  status,
  emptyLabel,
}) {
  const isDrag = isLiveDragItem(entry);

  return (
    <div style={runBlockStyle}>
      <div style={liveBlockHeaderStyle}>
        <div style={runLabelStyle}>{label}</div>
        {entry && <Badge tone={getOrderStatusTone(status)}>{statusLabel}</Badge>}
      </div>
      {isDrag ? (
        <DragIdentity item={entry} />
      ) : entry ? (
        <PaidWarmupEntryIdentity entry={entry} />
      ) : (
        <div style={mutedTextStyle}>{emptyLabel || "—"}</div>
      )}
    </div>
  );
}

function DragIdentity({ item }) {
  const { t } = useTranslation();

  return (
    <div>
      <div style={runTitleStyle}>{t("public.results.dragSurface")}</div>
      <div style={mutedTextStyle}>
        {t("public.results.dragPlanned", {
          minutes: item?.durationMinutes ?? "—",
        })}
      </div>
    </div>
  );
}

function PaidWarmupEntryIdentity({ entry }) {
  const { t } = useTranslation();

  return (
    <div>
      <div style={runTitleStyle}>#{entry?.order || "—"}</div>
      <div style={runNameStyle}>
        {entry?.rider || t("public.results.riderFallback")}
      </div>
    </div>
  );
}

function PaidWarmupTimerCue({ warmup, remainingSeconds }) {
  const { t } = useTranslation();

  switch (getPaidWarmupTimerCueType(warmup, remainingSeconds)) {
    case PAID_WARMUP_TIMER_CUES.FINISHED:
      return (
        <div style={timerCueStyle("danger")}>
          {t("public.results.timeOver")}
        </div>
      );
    case PAID_WARMUP_TIMER_CUES.ONE_MINUTE:
      return (
        <div style={timerCueStyle("danger")}>
          {t("management.announcer.announceOneMinute")}
        </div>
      );
    case PAID_WARMUP_TIMER_CUES.HALF_TIME:
      return (
        <div style={timerCueStyle("warn")}>
          {t("management.announcer.announceHalfTime")}
        </div>
      );
    default:
      return null;
  }
}

function ClassLiveCard({
  classView,
  showName,
  now,
  isPriority = false,
  onOpenProvisionalRanking,
  onOpenQualifiedRiders,
  onSaveScheduleDetails,
  onSaveLiveDisplayMode,
  onSaveAnnouncerSession,
  announcerSyncStatus,
  updatedBy,
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(Boolean(isPriority));
  const [scheduleDraft, setScheduleDraft] = useState(
    classView.scheduleDetails || {}
  );
  const liveState = getClassLiveState(classView, t);
  const hasProvisionalRanking = classView.provisionalRanking?.length > 0;
  const hasClassStandings = classView.classStandings?.length > 0;
  const isAnnouncerSource =
    classView.liveDataSource === LIVE_DATA_SOURCES.ANNOUNCER;
  const isOrderOnlyDisplay =
    classView.liveDisplayMode === LIVE_DISPLAY_MODES.ORDER_ONLY;
  const canBuildQualifiedRiders = Boolean(
    classView.isComplete &&
      classView.qualifiedRiderCount &&
      hasClassStandings
  );
  const canDownloadProvisionalResults = Boolean(
    classView.isComplete && hasClassStandings
  );

  function downloadProvisionalResultsPdf() {
    const generatedAt = new Date();
    const pdf = generateClassResultsPdf({
      eventName: showName,
      blockName: classView.className,
      pattern: classView.pattern,
      publishedAt:
        classView.announcerSession?.completedAt || generatedAt.toISOString(),
      documentTitle: t("management.announcer.provisionalResultsPdfTitle"),
      resultGroups: classView.classStandings || [],
    });
    pdf.save(
      buildClassResultsPdfFileName({
        showName,
        blockName: classView.className,
        publishedAt: generatedAt,
      })
    );
  }
  const isScheduleOnly = Boolean(classView.isScheduleOnly);
  const activeLiveItem = classView.activeDragItem || classView.activeRun;
  const nextLiveItem = classView.nextLiveItem || classView.nextRun;
  const secondNextLiveItem =
    classView.secondNextLiveItem || classView.secondNextRun;
  const cardDetailsId = `announcer-live-details-${classView.classId || "class"}`;
  const isExpanded = isPriority || isOpen;
  const canToggle = !isPriority;

  useEffect(() => {
    setScheduleDraft(classView.scheduleDetails || {});
  }, [classView.scheduleDetails]);

  useEffect(() => {
    if (isPriority) {
      setIsOpen(true);
    }
  }, [isPriority]);

  function toggleCard() {
    if (!canToggle) return;
    setIsOpen((current) => !current);
  }

  function handleCardKeyDown(event) {
    if (!canToggle || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    toggleCard();
  }

  return (
    <div
      style={isPriority ? priorityClassCardStyle : classCardStyle}
      data-announcer-class-id={classView.classId || ""}
      data-announcer-class-complete={classView.isComplete ? "true" : "false"}
      data-qualified-rider-count={classView.qualifiedRiderCount || ""}
      data-standing-group-count={classView.classStandings?.length || 0}
    >
      <div
        role={canToggle ? "button" : undefined}
        tabIndex={canToggle ? 0 : undefined}
        aria-expanded={canToggle ? isExpanded : undefined}
        aria-controls={cardDetailsId}
        onClick={canToggle ? toggleCard : undefined}
        onKeyDown={canToggle ? handleCardKeyDown : undefined}
        style={classCardHeaderToggleStyle(isExpanded, canToggle)}
      >
        <div>
          <div style={classNameStyle}>
            {classView.className}
            {classView.classCode ? ` (${classView.classCode})` : ""}
          </div>
          <div style={mutedTextStyle}>
            {classView.arena
              ? `${t("public.results.arena")} ${classView.arena} · `
              : ""}
            {isScheduleOnly
              ? getScheduleDetailsSummary(classView.scheduleDetails, t) ||
                t("public.results.scheduleOnly")
              : `${t("public.results.pattern")} ${classView.pattern || "—"} · ${t(
                  "management.announcer.runCount",
                  {
                    count: classView.runCount,
                  }
                )}`}
          </div>
        </div>
        <div style={badgeStackStyle}>
          {!isScheduleOnly && (
            <Badge tone={isAnnouncerSource ? "warn" : "muted"}>
              {isAnnouncerSource
                ? t("management.announcer.sourceAnnouncer")
                : t("management.announcer.sourceScribes")}
            </Badge>
          )}
          <LiveFreshnessBadge updatedAt={classView.liveUpdatedAt} now={now} />
          <Badge tone="muted">
            {getPublicationStatusLabel(classView.publicationStatus, t)}
          </Badge>
          <Badge tone={liveState.tone}>{liveState.label}</Badge>
          {canToggle && (
            <Badge tone="muted">
              {isExpanded ? t("public.results.hide") : t("public.results.view")}
            </Badge>
          )}
        </div>
      </div>

      {canBuildQualifiedRiders && (
        <div style={qualifiedRidersShortcutStyle}>
          <button
            type="button"
            onClick={() => onOpenQualifiedRiders(classView)}
            style={primaryButtonStyle}
          >
            {t("management.announcer.qualifiedRiders")}
          </button>
          <span style={mutedTextStyle}>
            {t("management.announcer.qualifiedRidersHelp", {
              count: classView.qualifiedRiderCount,
            })}
          </span>
        </div>
      )}

      {!isExpanded ? null : (
        <div id={cardDetailsId}>
          {isScheduleOnly ? (
            <ScheduleOnlyAnnouncerPanel
              classView={classView}
              draft={scheduleDraft}
              onChange={setScheduleDraft}
              onSave={(details) => onSaveScheduleDetails(classView, details)}
            />
          ) : (
            <>
              <div
                style={
                  isOrderOnlyDisplay
                    ? minimalDisplayActiveStyle
                    : minimalDisplayPanelStyle
                }
              >
                <div>
                  <div style={runLabelStyle}>
                    {t("management.announcer.minimalDisplay")}
                  </div>
                  <div style={mutedTextStyle}>
                    {t("management.announcer.minimalDisplayHelp")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !isOrderOnlyDisplay &&
                      !window.confirm(
                        t("management.announcer.minimalDisplayConfirm")
                      )
                    ) {
                      return;
                    }
                    onSaveLiveDisplayMode(
                      classView,
                      isOrderOnlyDisplay
                        ? LIVE_DISPLAY_MODES.FULL
                        : LIVE_DISPLAY_MODES.ORDER_ONLY
                    );
                  }}
                  style={
                    isOrderOnlyDisplay
                      ? primaryButtonStyle
                      : secondaryButtonStyle
                  }
                >
                  {isOrderOnlyDisplay
                    ? t("management.announcer.restoreFullDisplay")
                    : t("management.announcer.enableMinimalDisplay")}
                </button>
              </div>

              <div style={runGridStyle}>
                <QueueItemBlock
                  label={t("management.announcer.active")}
                  item={activeLiveItem}
                  variant="active"
                />
                <QueueItemBlock
                  item={nextLiveItem}
                  statusLabel={t("public.results.statusPreparation")}
                  status="preparation"
                  variant="next"
                />
                <QueueItemBlock
                  item={secondNextLiveItem}
                  statusLabel={t("public.results.statusWaiting")}
                  status="waiting"
                  variant="waiting"
                />
                <RunBlock
                  label={t("management.announcer.latestScore")}
                  run={classView.latestScore}
                  showScore
                  variant="score"
                />
              </div>
              <ClassPaceSummary pace={classView.pace} />

              {isAnnouncerSource && (
                <AnnouncerManualLiveControls
                  classView={classView}
                  syncStatus={announcerSyncStatus}
                  updatedBy={updatedBy}
                  onSaveSession={(nextSession) =>
                    onSaveAnnouncerSession(classView, nextSession)
                  }
                />
              )}

              {hasClassStandings && (
                <AnnouncerClassStandings
                  standings={classView.classStandings || []}
                  panelId={buildAccordionPanelId(
                    "announcer-standings",
                    classView.classId || classView.classCode || "class"
                  )}
                />
              )}

              {classView.orderRuns?.length > 0 && (
                <AnnouncerOrderList
                  runs={classView.orderRuns}
                  panelId={buildAccordionPanelId(
                    "announcer-order",
                    classView.classId || classView.classCode || "class"
                  )}
                />
              )}

              {classView.passedRuns?.length > 0 && (
                <AnnouncerPassedResults
                  results={classView.passedRuns.map((run) => ({
                    classId: classView.classId,
                    className: classView.className,
                    run,
                  }))}
                  panelId={buildAccordionPanelId(
                    "announcer-passed",
                    classView.classId || classView.classCode || "class"
                  )}
                />
              )}
            </>
          )}

          {!isScheduleOnly && hasProvisionalRanking && (
            <div style={actionRowStyle}>
              <button
                type="button"
                onClick={() => onOpenProvisionalRanking(classView)}
                style={secondaryButtonStyle}
              >
                {t("management.announcer.provisionalRanking")}
              </button>
            </div>
          )}

          {!isScheduleOnly && canDownloadProvisionalResults && (
            <div style={actionRowStyle}>
              <button
                type="button"
                onClick={downloadProvisionalResultsPdf}
                style={secondaryButtonStyle}
              >
                {t("management.announcer.provisionalResultsPdf")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnnouncerManualLiveControls({
  classView,
  syncStatus,
  updatedBy,
  onSaveSession,
}) {
  const { t } = useTranslation();
  const [editingRun, setEditingRun] = useState(null);
  const [completionError, setCompletionError] = useState(null);
  const session = classView.announcerSession || { runs: [] };
  const activeRun = classView.activeRun;
  const plannedDrag =
    !classView.activeDragItem && isLiveDragItem(classView.nextLiveItem)
      ? classView.nextLiveItem
      : null;
  const pendingReviews = (session.runs || []).filter(
    (run) => run.status === ANNOUNCER_RUN_STATUSES.REVIEW
  );
  const editableResults = (session.runs || [])
    .filter((run) =>
      [
        ANNOUNCER_RUN_STATUSES.SCORED,
        ANNOUNCER_RUN_STATUSES.NO_SCORE,
        ANNOUNCER_RUN_STATUSES.SCRATCH,
        ANNOUNCER_RUN_STATUSES.REVIEW,
      ].includes(run.status)
    )
    .slice(-6)
    .reverse();

  function save(nextSession) {
    setCompletionError(null);
    return onSaveSession(nextSession);
  }

  function handleStartNext() {
    const nextRun = classView.nextRun;
    if (!nextRun?.id) return;
    save(startAnnouncerRun(session, nextRun.id));
  }

  function handleScratch(run) {
    if (
      !run?.id ||
      !window.confirm(
        t("management.announcer.scratchConfirm", {
          draw: run.draw || "—",
        })
      )
    ) {
      return;
    }

    save(
      saveAnnouncerRunResultAndAdvance(
        session,
        run.id,
        { status: ANNOUNCER_RUN_STATUSES.SCRATCH },
        {
          nextRunId: classView.nextRun?.id,
          waitForDrag: Boolean(plannedDrag),
          updatedBy,
        }
      )
    );
  }

  function handleNoScore(run) {
    if (
      !run?.id ||
      !window.confirm(
        t("management.announcer.noScoreConfirm", {
          draw: run.draw || "—",
        })
      )
    ) {
      return;
    }

    save(
      saveAnnouncerRunResultAndAdvance(
        session,
        run.id,
        { status: ANNOUNCER_RUN_STATUSES.NO_SCORE },
        {
          nextRunId: classView.nextRun?.id,
          waitForDrag: Boolean(plannedDrag),
          updatedBy,
        }
      )
    );
  }

  function handleStopDrag() {
    save(
      stopAnnouncerDragAndAdvance(
        session,
        classView.nextRun?.id
      )
    );
  }

  function handleComplete() {
    const result = completeAnnouncerLiveSession(session, {
      completedBy: updatedBy,
    });

    if (!result.ok) {
      setCompletionError({
        reviews: result.pendingReviews.length,
        unresolved: result.unresolvedRuns.length,
      });
      return;
    }

    save(result.session);
  }

  return (
    <div style={manualLivePanelStyle}>
      <div style={manualLiveHeaderStyle}>
        <div>
          <div style={manualLiveTitleStyle}>
            {t("management.announcer.manualLiveTitle")}
          </div>
          <div style={mutedTextStyle}>
            {t("management.announcer.manualLiveProvisional")}
          </div>
        </div>
        <Badge tone={syncStatus === "pending" ? "warn" : "muted"}>
          {getAnnouncerSyncStatusLabel(syncStatus, t)}
        </Badge>
      </div>

      <div style={manualControlBodyStyle}>
        <div style={manualPrimaryActionStyle}>
          <div style={manualPrimaryActionContentStyle}>
            <div style={runLabelStyle}>
              {classView.activeDragItem
                ? t("public.results.drag")
                : activeRun
                  ? t("management.announcer.onCourse")
                  : plannedDrag || classView.nextRun
                    ? t("management.announcer.next")
                    : t("management.announcer.manualBlockCompleted")}
            </div>
            {classView.activeDragItem ? (
              <DragIdentity item={classView.activeDragItem} />
            ) : activeRun ? (
              <RunIdentity run={activeRun} />
            ) : plannedDrag ? (
              <DragIdentity item={plannedDrag} />
            ) : classView.nextRun ? (
              <RunIdentity run={classView.nextRun} />
            ) : (
              <div style={mutedTextStyle}>
                {t("management.announcer.noNextRun")}
              </div>
            )}
          </div>

          <div style={manualPrimaryButtonWrapStyle}>
            {classView.activeDragItem ? (
              <button
                type="button"
                onClick={handleStopDrag}
                style={manualDragButtonStyle}
              >
                {t("management.announcer.stopDrag")}
              </button>
            ) : activeRun ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditingRun(activeRun)}
                  style={manualPrimaryButtonStyle}
                >
                  {t("management.announcer.enterResult")}
                </button>
                <button
                  type="button"
                  onClick={() => handleScratch(activeRun)}
                  style={manualDangerButtonStyle}
                >
                  {t("management.announcer.scratch")}
                </button>
                <button
                  type="button"
                  onClick={() => handleNoScore(activeRun)}
                  style={manualNoScoreButtonStyle}
                >
                  {t("management.announcer.noScore")}
                </button>
              </>
            ) : plannedDrag ? (
              <button
                type="button"
                onClick={() => save(startAnnouncerDrag(session, plannedDrag))}
                style={manualDragButtonStyle}
              >
                {t("management.announcer.startDrag")}
              </button>
            ) : !session.completedAt && classView.nextRun ? (
              <>
                <button
                  type="button"
                  onClick={handleStartNext}
                  style={manualPrimaryButtonStyle}
                >
                  {t("management.announcer.startNext")}
                </button>
                <button
                  type="button"
                  onClick={() => handleScratch(classView.nextRun)}
                  style={manualDangerButtonStyle}
                >
                  {t("management.announcer.scratch")}
                </button>
                <button
                  type="button"
                  onClick={() => handleNoScore(classView.nextRun)}
                  style={manualNoScoreButtonStyle}
                >
                  {t("management.announcer.noScore")}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {(pendingReviews.length > 0 || editableResults.length > 0) && (
          <div style={manualSupportPanelStyle}>
            {pendingReviews.length > 0 && (
              <div style={reviewNoticeStyle}>
                <strong>
                  {t("management.announcer.pendingReviews", {
                    count: pendingReviews.length,
                  })}
                </strong>
                <div style={compactButtonListStyle}>
                  {pendingReviews.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => setEditingRun(run)}
                      style={smallButtonStyle}
                    >
                      {t("management.announcer.draw")} {run.draw}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editableResults.length > 0 && (
              <div style={manualCorrectionWrapStyle}>
                <div style={runLabelStyle}>
                  {t("management.announcer.correctResult")}
                </div>
                <div style={compactButtonListStyle}>
                  {editableResults.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => setEditingRun(run)}
                      style={smallButtonStyle}
                    >
                      #{run.draw} · {run.scoreTotal || "—"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {completionError && (
        <div style={errorNoticeStyle}>
          {t("management.announcer.completeBlocked", {
            reviews: completionError.reviews,
            unresolved: completionError.unresolved,
          })}
        </div>
      )}

      <div style={manualCompletionRowStyle}>
        {!session.completedAt ? (
          <button
            type="button"
            onClick={handleComplete}
            style={manualCompleteButtonStyle}
          >
            {t("management.announcer.markClassComplete")}
          </button>
        ) : (
          <>
            <Badge tone="success">
              {t("management.announcer.manualBlockCompleted")}
            </Badge>
            <button
              type="button"
              onClick={() => save(reopenAnnouncerLiveSession(session))}
              style={secondaryButtonStyle}
            >
              {t("management.announcer.reopenClass")}
            </button>
          </>
        )}
      </div>

      {editingRun && (
        <AnnouncerRunResultModal
          run={editingRun}
          judges={classView.judges}
          pattern={classView.patternValue}
          customPattern={classView.customPattern}
          onClose={() => setEditingRun(null)}
          onSave={(result) => {
            const nextSession = saveAnnouncerRunResultAndAdvance(
              session,
              editingRun.id,
              result,
              {
                nextRunId: classView.nextRun?.id,
                waitForDrag: Boolean(plannedDrag),
                updatedBy,
              }
            );
            setEditingRun(null);
            save(nextSession);
          }}
        />
      )}
    </div>
  );
}

function AnnouncerRunResultModal({
  run,
  judges = [],
  pattern = "",
  customPattern = null,
  onClose,
  onSave,
}) {
  const { t } = useTranslation();
  const judgeRows =
    Array.isArray(judges) && judges.length
      ? judges
      : [{ id: "judge-1", name: t("public.results.judge"), order: 1 }];
  const previousJudgeScores = Array.isArray(run.judgeScores)
    ? run.judgeScores
    : [];
  const [judgeScoreValues, setJudgeScoreValues] = useState(
    () =>
      judgeRows.reduce((values, judge, index) => {
        const previous =
          previousJudgeScores.find(
            (judgeScore) => judgeScore?.judgeId === judge.id
          ) || previousJudgeScores[index];
        values[judge.id] =
          previous?.scoreTotal ||
          (judgeRows.length === 1 &&
          run.status === ANNOUNCER_RUN_STATUSES.SCORED
            ? run.scoreTotal || ""
            : "");
        return values;
      }, {})
  );
  const [note, setNote] = useState(run.note || "");
  const scoreResult = buildAnnouncerJudgeScoreResult({
    judges: judgeRows,
    judgeScores: judgeRows.map((judge) => ({
      judgeId: judge.id,
      judgeName: judge.name || "",
      scoreTotal: judgeScoreValues[judge.id] || "",
    })),
    pattern,
    customPattern,
  });
  const hasValidScore =
    scoreResult.isComplete &&
    Number.isFinite(parseScoreTotalValue(scoreResult.scoreTotal));

  return (
    <div style={modalBackdropStyle} role="dialog" aria-modal="true">
      <div style={compactModalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>
              {t("management.announcer.enterResult")}
            </h2>
            <div style={classNameStyle}>
              {t("management.announcer.draw")} {run.draw} ·{" "}
              {run.rider || t("public.results.riderFallback")}
            </div>
            <div style={mutedTextStyle}>{run.horse || "—"}</div>
            {run.owner && (
              <div style={mutedTextStyle}>
                {t("public.results.owner")}: {run.owner}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            {t("management.announcer.close")}
          </button>
        </div>

        <div style={judgeScoreInputGridStyle}>
          {judgeRows.map((judge, index) => (
            <label key={judge.id} style={fieldLabelStyle}>
              {judge.name ||
                t("management.classSetup.judgeName", {
                  number: index + 1,
                })}
              <input
                type="text"
                inputMode="decimal"
                value={judgeScoreValues[judge.id] || ""}
                onChange={(event) =>
                  setJudgeScoreValues((current) => ({
                    ...current,
                    [judge.id]: event.target.value,
                  }))
                }
                placeholder="70"
                style={scoreInputStyle}
                autoFocus={index === 0}
              />
            </label>
          ))}
        </div>

        {judgeRows.length > 1 && (
          <div style={combinedScorePreviewStyle}>
            <span>{t("management.announcer.combinedJudgeTotal")}</span>
            <strong>{scoreResult.scoreTotal || "—"}</strong>
          </div>
        )}

        {!scoreResult.isSupported && (
          <div style={errorNoticeStyle}>
            {t("management.announcer.combinedJudgeUnsupported")}
          </div>
        )}

        <label style={fieldLabelStyle}>
          {t("management.announcer.correctionNote")}
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            style={textInputStyle}
          />
        </label>

        <div style={actionRowStyle}>
          <button
            type="button"
            disabled={!hasValidScore}
            onClick={() =>
              onSave({
                status: ANNOUNCER_RUN_STATUSES.SCORED,
                scoreTotal: scoreResult.scoreTotal,
                judgeScores: scoreResult.judgeScores,
                note,
              })
            }
            style={primaryButtonStyle}
          >
            {t("management.announcer.saveScore")}
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                status: ANNOUNCER_RUN_STATUSES.NO_SCORE,
                note,
              })
            }
            style={noScoreButtonStyle}
          >
            {t("management.announcer.noScore")}
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                status: ANNOUNCER_RUN_STATUSES.REVIEW,
                note,
              })
            }
            style={secondaryButtonStyle}
          >
            {t("management.announcer.videoReview")}
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                status: ANNOUNCER_RUN_STATUSES.SCRATCH,
                note,
              })
            }
            style={dangerButtonStyle}
          >
            {t("management.announcer.scratch")}
          </button>
        </div>
      </div>
    </div>
  );
}

function getAnnouncerSyncStatusLabel(status, t) {
  switch (status) {
    case "syncing":
      return t("management.announcer.syncing");
    case "pending":
      return t("management.announcer.syncPending");
    case "synced":
      return t("management.announcer.synced");
    default:
      return t("management.announcer.savedLocally");
  }
}

function AnnouncerClassStandings({ standings, panelId }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [openGroupIds, setOpenGroupIds] = useState(() => new Set());
  const groups = (Array.isArray(standings) ? standings : []).filter(
    (group) => Array.isArray(group.visibleEntries) && group.visibleEntries.length > 0
  );

  if (!groups.length) return null;

  function togglePanel() {
    setIsOpen((current) => !current);
  }

  function toggleGroup(groupId) {
    setOpenGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  function handlePanelKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    togglePanel();
  }

  return (
    <div style={announcerStandingsWrapStyle}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={togglePanel}
        onKeyDown={handlePanelKeyDown}
        style={announcerAccordionHeaderStyle(isOpen)}
      >
        <div>
          <div style={runLabelStyle}>{t("public.results.provisionalStandings")}</div>
          <div style={mutedTextStyle}>
            {t("public.results.provisionalStandingsNote")}
          </div>
        </div>
        <div style={badgeStackStyle}>
          <Badge tone="muted">{groups.length}</Badge>
          <Badge tone="muted">
            {isOpen ? t("public.results.hide") : t("public.results.view")}
          </Badge>
        </div>
      </div>
      {isOpen && (
        <div id={panelId} style={announcerStandingsGridStyle}>
          {groups.map((group) => {
            const groupId = getStandingGroupKey(group);

            return (
              <AnnouncerStandingGroupAccordion
                key={groupId}
                group={group}
                isOpen={openGroupIds.has(groupId)}
                panelId={buildAccordionPanelId(panelId, groupId)}
                onToggle={() => toggleGroup(groupId)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnnouncerStandingGroupAccordion({ group, isOpen, panelId, onToggle }) {
  const { t } = useTranslation();

  function handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onToggle();
  }

  return (
    <div style={announcerStandingGroupStyle}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        style={announcerStandingHeaderStyle(isOpen)}
      >
        <div>
          <div style={runTitleStyle}>
            {group.className || group.classCode || "—"}
          </div>
          {group.classCode && (
            <div style={mutedTextStyle}>{group.classCode}</div>
          )}
        </div>
        <div style={badgeStackStyle}>
          <Badge tone="muted">{group.entryCount || 0}</Badge>
          <Badge tone="muted">
            {isOpen ? t("public.results.hide") : t("public.results.view")}
          </Badge>
        </div>
      </div>
      {isOpen && (
        <div id={panelId} style={announcerStandingListStyle}>
          {group.visibleEntries.map((entry) => (
            <div
              key={entry.id || `${group.code}-${entry.draw}`}
              style={announcerStandingEntryStyle}
            >
              <div style={announcerStandingRankStyle}>#{entry.rank}</div>
              <div style={announcerStandingIdentityStyle}>
                <div style={runNameStyle}>
                  {entry.rider || t("public.results.riderFallback")}
                </div>
                <div style={mutedTextStyle}>
                  {t("public.results.backNumber")} {entry.backNumber || "—"} ·{" "}
                  {entry.horse || t("public.results.horseFallback")}
                </div>
              </div>
              <div style={announcerStandingScoreStyle}>
                {entry.scoreTotal || "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncerOrderList({ runs, panelId }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  function togglePanel() {
    setIsOpen((current) => !current);
  }

  function handlePanelKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    togglePanel();
  }

  return (
    <div style={announcerOrderWrapStyle}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={togglePanel}
        onKeyDown={handlePanelKeyDown}
        style={announcerAccordionHeaderStyle(isOpen)}
      >
        <div>
          <div style={runLabelStyle}>{t("public.results.orderOfGo")}</div>
          <div style={mutedTextStyle}>
            {t("public.results.passedWithScores")}
          </div>
        </div>
        <div style={badgeStackStyle}>
          <Badge tone="muted">{runs.length}</Badge>
          <Badge tone="muted">
            {isOpen ? t("public.results.hide") : t("public.results.view")}
          </Badge>
        </div>
      </div>
      {isOpen && (
        <div id={panelId} style={announcerOrderListStyle}>
          {runs.map((item) =>
            isLiveDragItem(item) ? (
              <div key={item.id} style={announcerOrderRowStyle}>
                <div style={announcerOrderDrawStyle}>—</div>
                <div style={announcerOrderIdentityStyle}>
                  <DragIdentity item={item} />
                </div>
                <Badge tone={getOrderStatusTone(item.liveOrderStatus)}>
                  {getAnnouncerRunOrderStatusLabel(item.liveOrderStatus, t)}
                </Badge>
                <div style={compactScoreStyle}>—</div>
              </div>
            ) : (
              <div key={item.id || item.draw} style={announcerOrderRowStyle}>
                <div style={announcerOrderDrawStyle}>#{item.draw || "—"}</div>
                <div style={announcerOrderIdentityStyle}>
                  <RunIdentity run={item} />
                </div>
                <Badge tone={getOrderStatusTone(item.liveOrderStatus)}>
                  {getAnnouncerRunOrderStatusLabel(item.liveOrderStatus, t)}
                </Badge>
                <RunScoreDisplay run={item} compact />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function AnnouncerPassedResults({ results, panelId }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  function togglePanel() {
    setIsOpen((current) => !current);
  }

  function handlePanelKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    togglePanel();
  }

  return (
    <div style={completedWrapStyle}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={togglePanel}
        onKeyDown={handlePanelKeyDown}
        style={announcerAccordionHeaderStyle(isOpen)}
      >
        <div style={runLabelStyle}>
          {t("management.announcer.passedWithScores")}
        </div>
        <div style={badgeStackStyle}>
          <Badge tone="muted">{results.length}</Badge>
          <Badge tone="muted">
            {isOpen ? t("public.results.hide") : t("public.results.view")}
          </Badge>
        </div>
      </div>
      {isOpen && (
        <div id={panelId}>
          <RecentResults results={results} />
        </div>
      )}
    </div>
  );
}

function getStandingGroupKey(group) {
  return String(
    group?.id ||
      group?.code ||
      group?.classCode ||
      group?.className ||
      "standing"
  );
}

function buildAccordionPanelId(prefix, key) {
  return `${prefix}-${String(key).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function getClassLiveState(classView, t) {
  if (classView.isComplete || classView.status === "completed") {
    return { label: t("management.classes.statusCompleted"), tone: "success" };
  }

  if (classView.isScheduleOnly) {
    return { label: t("public.results.classInProgress"), tone: "warn" };
  }

  if (classView.activeDragItem) {
    return { label: t("public.results.drag"), tone: "warn" };
  }

  if (classView.activeRun) {
    return { label: t("common.live"), tone: "warn" };
  }

  if (classView.scoringStarted && classView.nextRun) {
    return { label: t("management.classes.statusInProgress"), tone: "warn" };
  }

  return { label: t("public.results.paidWarmupStatusPending"), tone: "muted" };
}

function getScheduleDetailsSummary(details, t) {
  return getScheduleDetailsParts(details, t).join(" · ");
}

function getScheduleDetailsParts(details = {}, t) {
  const parts = [];
  const completedSectionCount = Number.parseInt(
    details.completedSectionCount,
    10
  );
  const sectionCount = Number.parseInt(details.sectionCount, 10) || 0;
  const isFinalInProgress =
    details.hasFinal &&
    !details.finalCompleted &&
    !details.isCompleted &&
    sectionCount > 0 &&
    completedSectionCount >= sectionCount;

  if (details.participantCount) {
    parts.push(
      t("public.results.participantCount", {
        count: details.participantCount,
      })
    );
  }

  if (details.sectionCount && details.sectionSize) {
    parts.push(
      t("public.results.sectionSummary", {
        sectionCount: details.sectionCount,
        sectionSize: details.sectionSize,
      })
    );
  } else if (details.sectionCount) {
    parts.push(
      t("public.results.sectionCount", {
        count: details.sectionCount,
      })
    );
  }

  if (Number.isFinite(completedSectionCount) && completedSectionCount > 0) {
    parts.push(
      t("public.results.sectionsCompleted", {
        count: completedSectionCount,
      })
    );
  }

  if (details.hasFinal) {
    parts.push(
      details.finalCompleted
        ? t("public.results.finalCompleted")
        : isFinalInProgress
          ? t("public.results.finalInProgress")
          : t("public.results.finalPlanned")
    );
  }

  if (details.isCompleted) {
    parts.push(t("management.classes.statusCompleted"));
  }

  if (String(details.note || "").trim()) {
    parts.push(String(details.note).trim());
  }

  return parts;
}

function getScheduleProgressLabel(details = {}, t) {
  const completedSectionCount =
    Number.parseInt(details.completedSectionCount, 10) || 0;
  const sectionCount = Number.parseInt(details.sectionCount, 10) || 0;

  if (details.isCompleted) {
    return t("management.classes.statusCompleted");
  }

  if (details.hasFinal && details.finalCompleted) {
    return t("public.results.finalCompleted");
  }

  if (details.hasFinal && sectionCount > 0 && completedSectionCount >= sectionCount) {
    return t("public.results.finalInProgress");
  }

  if (completedSectionCount > 0 && sectionCount > 0) {
    return t("public.results.sectionProgress", {
      completed: completedSectionCount,
      total: sectionCount,
    });
  }

  return t("public.results.classInProgress");
}

function getAnnouncerRunOrderStatusLabel(status, t) {
  switch (status) {
    case "active":
      return t("public.results.statusOnCourse");
    case "waiting":
      return t("public.results.statusWaiting");
    case "preparation":
      return t("public.results.statusPreparation");
    case "passed":
      return t("public.results.statusPassed");
    case "upcoming":
    default:
      return t("public.results.statusUpcoming");
  }
}

function getOrderStatusTone(status) {
  if (status === "active" || status === "preparation") return "warn";
  if (status === "passed") return "success";
  return "muted";
}

function getPublicationStatusLabel(status, t) {
  switch (status) {
    case PUBLICATION_STATUSES.LIVE:
      return t("public.status.live");
    case PUBLICATION_STATUSES.LIVE_NO_SCORE:
      return t("public.status.liveNoScore");
    case PUBLICATION_STATUSES.LIVE_SCORING:
      return t("public.status.liveScoring");
    case PUBLICATION_STATUSES.LIVE_FINISHED:
      return t("public.status.liveFinished");
    case PUBLICATION_STATUSES.OFFICIAL:
      return t("public.status.official");
    case PUBLICATION_STATUSES.PUBLISHED:
      return t("public.status.published");
    case PUBLICATION_STATUSES.HIDDEN:
    default:
      return t("public.status.hidden");
  }
}

function RunBlock({
  label,
  run,
  showScore = false,
  statusLabel = null,
  status = "waiting",
  variant = "default",
}) {
  return (
    <div style={getRunBlockStyle(variant)}>
      {(label || (run && statusLabel)) && (
        <div style={liveBlockHeaderStyle}>
          {label && <div style={runLabelStyle}>{label}</div>}
          {run && statusLabel && (
            <Badge tone={getOrderStatusTone(status)}>{statusLabel}</Badge>
          )}
        </div>
      )}
      {run ? (
        <>
          <RunIdentity run={run} />
          {showScore && <RunScoreDisplay run={run} compact />}
          <RunNote note={run.note} />
        </>
      ) : (
        <div style={mutedTextStyle}>—</div>
      )}
    </div>
  );
}

function QueueItemBlock({
  label,
  item,
  showScore = false,
  statusLabel = null,
  status = "waiting",
  variant = "default",
}) {
  const isDrag = isLiveDragItem(item);
  const run = isDrag ? null : item;

  return (
    <div style={getRunBlockStyle(variant)}>
      {(label || (item && statusLabel)) && (
        <div style={liveBlockHeaderStyle}>
          {label && <div style={runLabelStyle}>{label}</div>}
          {item && statusLabel && (
            <Badge tone={getOrderStatusTone(status)}>{statusLabel}</Badge>
          )}
        </div>
      )}
      {isDrag ? (
        <DragIdentity item={item} />
      ) : run ? (
        <>
          <RunIdentity run={run} />
          {showScore && <RunScoreDisplay run={run} compact />}
          <RunNote note={run.note} />
        </>
      ) : (
        <div style={mutedTextStyle}>—</div>
      )}
    </div>
  );
}

function RunScoreDisplay({ run, compact = false }) {
  const { t } = useTranslation();
  const judgeScores = getVisibleJudgeScores(run);
  const totalStyle = compact ? compactScoreStyle : compactScoreStyle;

  if (judgeScores.length <= 1) {
    return <div style={totalStyle}>{run.scoreTotal || "—"}</div>;
  }

  return (
    <div style={compact ? judgeScoreCompactWrapStyle : judgeScoreWrapStyle}>
      <div style={compact ? judgeScoreCompactListStyle : judgeScoreListStyle}>
        {judgeScores.map((judgeScore, index) => (
          <span
            key={judgeScore.judgeId || `${judgeScore.judgeName}-${index}`}
            style={compact ? judgeScoreCompactItemStyle : judgeScoreItemStyle}
          >
            <span style={judgeScoreNameStyle}>
              {judgeScore.judgeName || t("public.results.judge")}
            </span>{" "}
            <span style={judgeScoreValueStyle}>{judgeScore.scoreTotal}</span>
          </span>
        ))}
      </div>
      <div style={totalStyle}>
        {t("public.results.totalScore")}: {run.scoreTotal || "—"}
      </div>
    </div>
  );
}

function getVisibleJudgeScores(run) {
  return (Array.isArray(run?.judgeScores) ? run.judgeScores : []).filter(
    (judgeScore) => String(judgeScore?.scoreTotal ?? "").trim()
  );
}

function RunNote({ note }) {
  const { t } = useTranslation();
  const cleanNote = String(note || "").trim();

  if (!cleanNote) return null;

  return (
    <div style={runNoteStyle}>
      <div style={runLabelStyle}>{t("public.results.judgeNote")}</div>
      <div style={runNoteTextStyle}>{cleanNote}</div>
    </div>
  );
}

function RunIdentity({ run }) {
  const { t } = useTranslation();

  return (
    <div>
      <div style={runTitleStyle}>
        #{run.draw} · {t("public.results.backNumber")} {run.backNumber || "—"}
      </div>
      <div style={runNameStyle}>
        {run.rider || t("public.results.riderFallback")}
      </div>
      <div style={mutedTextStyle}>
        {run.horse || t("public.results.horseFallback")}
      </div>
      {run.owner && (
        <div style={mutedTextStyle}>
          {t("public.results.owner")}: {run.owner}
        </div>
      )}
    </div>
  );
}

function ManoeuvreDetails({ run }) {
  const { t } = useTranslation();
  const manoeuvres = Array.isArray(run?.manoeuvres) ? run.manoeuvres : [];

  if (!manoeuvres.length) {
    return null;
  }

  return (
    <div style={detailsGridStyle}>
      {manoeuvres.map((item) => (
        <div key={item.name} style={detailCellStyle}>
          <div style={detailNameStyle}>{item.name}</div>
          <div style={detailScoreStyle}>{item.score || "—"}</div>
          {item.penalty && (
            <div style={detailPenaltyStyle}>
              {t("public.results.penaltyPrefix")} {item.penalty}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ProvisionalRankingModal({ classView, onClose }) {
  const { t } = useTranslation();
  const ranking = classView.provisionalRanking || [];

  return (
    <div style={modalBackdropStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>
              {t("management.announcer.provisionalRanking")}
            </h2>
            <div style={classNameStyle}>{classView.className}</div>
            <div style={mutedTextStyle}>
              {t("management.announcer.provisionalRankingNote")}
            </div>
          </div>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            {t("management.announcer.close")}
          </button>
        </div>

        <div style={rankingListStyle}>
          {ranking.map((run) => (
            <div key={run.id || run.draw} style={rankingRowStyle}>
              <div style={rankingRankStyle}>#{run.rank}</div>
              <div>
                <div style={runTitleStyle}>
                  {t("management.announcer.draw")} {run.draw || "—"} ·{" "}
                  {t("public.results.backNumber")} {run.backNumber || "—"}
                </div>
                <div style={runNameStyle}>
                  {run.rider || t("public.results.riderFallback")}
                </div>
                <div style={mutedTextStyle}>
                  {run.horse || t("public.results.horseFallback")}
                </div>
              </div>
              <div style={rankingScoreStyle}>{run.scoreTotal || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QualifiedRidersModal({ classView, showName, onClose }) {
  const { t } = useTranslation();
  const riders = buildQualifiedRiderList({
    standings: classView.classStandings,
    qualifiedRiderCount: classView.qualifiedRiderCount,
  });

  function downloadPdf() {
    const generatedAt = new Date();
    const pdf = generateQualifiedRidersPdf({
      showName,
      blockName: classView.className,
      qualifiedRiderCount: classView.qualifiedRiderCount,
      riders,
      generatedAt,
    });
    pdf.save(
      buildQualifiedRidersPdfFileName({
        showName,
        blockName: classView.className,
        generatedAt,
      })
    );
  }

  return (
    <div style={modalBackdropStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>
              {t("management.announcer.qualifiedRiders")}
            </h2>
            <div style={classNameStyle}>{classView.className}</div>
            <div style={mutedTextStyle}>
              {t("management.announcer.qualifiedRidersHelp", {
                count: classView.qualifiedRiderCount,
              })}
            </div>
          </div>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            {t("management.announcer.close")}
          </button>
        </div>

        <div style={actionRowStyle}>
          <button type="button" onClick={downloadPdf} style={primaryButtonStyle}>
            {t("management.announcer.downloadQualifiedRidersPdf")}
          </button>
          <Badge tone="muted">
            {t("management.announcer.qualifiedRiderTotal", {
              count: riders.length,
            })}
          </Badge>
        </div>

        <div style={qualifiedRiderListStyle}>
          {riders.map((rider, index) => (
            <div key={rider.id} style={qualifiedRiderRowStyle}>
              <strong>{index + 1}.</strong>
              <span>{rider.rider}</span>
            </div>
          ))}
          {!riders.length && (
            <div style={softEmptyStyle}>
              {t("management.announcer.noQualifiedRiders")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ children, tone = "muted" }) {
  return <span style={badgeStyle(tone)}>{children}</span>;
}

function LiveFreshnessBadge({ updatedAt, now }) {
  const { t } = useTranslation();
  const freshness = formatLiveDataFreshness(updatedAt, now, t);

  return (
    <span style={badgeStyle(freshness.tone)}>
      {freshness.label}
    </span>
  );
}

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 1000,
};

const modalStyle = {
  width: "min(720px, 100%)",
  maxHeight: "85vh",
  overflow: "auto",
  background: "#fff",
  borderRadius: 20,
  padding: 22,
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
};

const compactModalStyle = {
  ...modalStyle,
  width: "min(520px, 100%)",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 14,
};

const manualLivePanelStyle = {
  display: "grid",
  gap: 14,
  padding: 18,
  marginTop: 16,
  marginBottom: 16,
  border: "1px solid #fed7aa",
  borderRadius: 18,
  background: "linear-gradient(135deg, #fffaf0 0%, #ffffff 72%)",
  boxShadow: "0 10px 28px rgba(154, 52, 18, 0.08)",
};

const manualLiveHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const qualifiedRidersShortcutStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: "12px 16px",
  borderTop: "1px solid #dbeafe",
  background: "#eff6ff",
};

const manualLiveTitleStyle = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
  marginBottom: 4,
};

const manualControlBodyStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
  gap: 12,
  alignItems: "stretch",
};

const manualPrimaryActionStyle = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
  padding: 16,
  border: "1px solid rgba(15, 118, 110, 0.28)",
  borderRadius: 16,
  background: "linear-gradient(135deg, #ecfdf5 0%, #ffffff 78%)",
  boxShadow: "inset 4px 0 0 #0f766e",
};

const manualPrimaryActionContentStyle = {
  minWidth: 0,
  flex: "1 1 240px",
};

const manualPrimaryButtonWrapStyle = {
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const manualPrimaryButtonStyle = {
  borderRadius: 12,
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 850,
  boxShadow: "0 6px 16px rgba(15, 118, 110, 0.18)",
  minHeight: 46,
  padding: "12px 18px",
  fontSize: 15,
};

const manualDragButtonStyle = {
  ...manualPrimaryButtonStyle,
  border: "1px solid #c2410c",
  background: "#c2410c",
  boxShadow: "0 6px 16px rgba(154, 52, 18, 0.2)",
};

const manualDangerButtonStyle = {
  ...manualPrimaryButtonStyle,
  border: "1px solid #dc2626",
  background: "#fff5f5",
  color: "#991b1b",
  boxShadow: "none",
};

const manualNoScoreButtonStyle = {
  ...manualPrimaryButtonStyle,
  border: "1px solid #b45309",
  background: "#fffbeb",
  color: "#92400e",
  boxShadow: "none",
};

const manualSupportPanelStyle = {
  minWidth: 0,
  display: "grid",
  alignContent: "start",
  gap: 12,
  padding: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  background: "rgba(255, 255, 255, 0.82)",
};

const manualCompletionRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  paddingTop: 12,
  borderTop: "1px solid #e7e5e4",
};

const manualCompleteButtonStyle = {
  padding: "10px 15px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#475569",
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "none",
};

const minimalDisplayPanelStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: "12px 14px",
  marginBottom: 16,
  border: "1px solid #dbe4ea",
  borderRadius: 14,
  background: "rgba(248, 250, 252, 0.8)",
};

const minimalDisplayActiveStyle = {
  ...minimalDisplayPanelStyle,
  border: "2px solid #dc2626",
  background: "#fff5f5",
};

const reviewNoticeStyle = {
  display: "grid",
  gap: 8,
  padding: 10,
  border: "1px solid #fdba74",
  borderRadius: 8,
  background: "#fff7ed",
  color: "#9a3412",
};

const errorNoticeStyle = {
  padding: 10,
  border: "1px solid #fecaca",
  borderRadius: 8,
  background: "#fff5f5",
  color: "#991b1b",
  fontWeight: 700,
};

const manualCorrectionWrapStyle = {
  display: "grid",
  gap: 6,
};

const compactButtonListStyle = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const smallButtonStyle = {
  padding: "7px 11px",
  borderRadius: 999,
  border: "1px solid #d4dee7",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 800,
};

const fieldLabelStyle = {
  display: "grid",
  gap: 6,
  marginBottom: 12,
  color: "#334155",
  fontWeight: 700,
};

const textInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "10px 12px",
  background: "#fff",
  color: "#111827",
  fontSize: 16,
};

const scoreInputStyle = {
  ...textInputStyle,
  fontSize: 28,
  fontWeight: 900,
  textAlign: "center",
};

const judgeScoreInputGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

const combinedScorePreviewStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "baseline",
  marginBottom: 12,
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 18,
};

const qualifiedRiderListStyle = {
  display: "grid",
  gap: 6,
  marginTop: 14,
};

const qualifiedRiderRowStyle = {
  display: "grid",
  gridTemplateColumns: "34px 1fr",
  gap: 8,
  alignItems: "center",
  padding: "9px 10px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#f8fafc",
};

const rankingListStyle = {
  display: "grid",
  gap: 8,
};

const rankingRowStyle = {
  display: "grid",
  gridTemplateColumns: "64px 1fr auto",
  gap: 12,
  alignItems: "center",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  background: "#f8fafc",
};

const rankingRankStyle = {
  fontWeight: 900,
  fontSize: 18,
  color: "#0f172a",
};

const rankingScoreStyle = {
  fontWeight: 900,
  fontSize: 20,
  color: "#111827",
};

const announcerPageStyle = {
  ...styles.app,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  background:
    "linear-gradient(180deg, #e8f1f2 0%, #f8fafc 38%, #f1f5f9 100%)",
  padding: "clamp(14px, 2vw, 28px)",
  color: "#0f172a",
};

const announcerBackRowStyle = {
  marginBottom: 14,
};

const heroStyle = {
  background: "linear-gradient(135deg, #0f172a 0%, #164e63 100%)",
  color: "#fff",
  borderRadius: 22,
  padding: "22px 24px",
  boxShadow: "0 18px 42px rgba(15, 23, 42, 0.2)",
  marginBottom: 24,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const heroActionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const eyebrowStyle = {
  color: "#a5f3fc",
  fontWeight: 900,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: "0.08em",
};

const titleStyle = {
  margin: "5px 0 6px",
  fontSize: "clamp(28px, 3vw, 42px)",
  lineHeight: 1.05,
};

const subtitleStyle = {
  color: "#cbd5e1",
  fontSize: 16,
};

const timerInlineStyle = {
  fontSize: 28,
  fontWeight: 900,
  color: "#111827",
  marginTop: 8,
};

const compactScoreStyle = {
  fontSize: 24,
  fontWeight: 900,
  color: "#111827",
  marginTop: 8,
};

const judgeScoreWrapStyle = {
  display: "grid",
  gap: 8,
  marginTop: 8,
};

const judgeScoreListStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const judgeScoreItemStyle = {
  display: "inline-flex",
  gap: 4,
  alignItems: "baseline",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "5px 8px",
  background: "#fff",
};

const judgeScoreNameStyle = {
  color: "#475569",
  fontSize: 12,
  fontWeight: 800,
};

const judgeScoreValueStyle = {
  color: "#111827",
  fontWeight: 900,
};

const judgeScoreCompactWrapStyle = {
  display: "grid",
  gap: 3,
  minWidth: 150,
  textAlign: "right",
};

const judgeScoreCompactListStyle = {
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const judgeScoreCompactItemStyle = {
  display: "inline-flex",
  gap: 3,
  alignItems: "baseline",
  color: "#475569",
  fontSize: 11,
  fontWeight: 800,
};

const runNoteStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: 8,
  background: "#fff",
  marginTop: 8,
};

const runNoteTextStyle = {
  color: "#334155",
  whiteSpace: "pre-wrap",
  lineHeight: 1.4,
};

const recentListStyle = {
  display: "grid",
  gap: 10,
};

const recentResultStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  background: "#f8fafc",
};

const recentHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 18,
  padding: 18,
  border: "1px solid rgba(203, 213, 225, 0.72)",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 20,
};

const prioritySectionStyle = {
  display: "grid",
  gap: 14,
  marginBottom: 24,
};

const priorityHeaderStyle = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const priorityTitleStyle = {
  margin: 0,
  fontSize: "clamp(24px, 2vw, 32px)",
  color: "#0f172a",
  letterSpacing: "-0.02em",
};

const priorityListStyle = {
  display: "grid",
  gap: 12,
};

const remainingSectionListStyle = {
  display: "grid",
  gap: 16,
};

const classListStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const classCardStyle = {
  border: "1px solid #dbe4ea",
  borderRadius: 16,
  padding: 16,
  background: "#fff",
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
};

const priorityClassCardStyle = {
  ...classCardStyle,
  border: "1px solid rgba(15, 118, 110, 0.34)",
  borderRadius: 22,
  padding: "18px clamp(16px, 1.5vw, 24px) 22px",
  background: "linear-gradient(135deg, #f7fffd 0%, #ffffff 56%)",
  boxShadow:
    "inset 0 5px 0 #0f766e, 0 18px 45px rgba(15, 118, 110, 0.14)",
};

const classCardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  marginBottom: 12,
};

const classCardHeaderToggleStyle = (isOpen, canToggle = true) => ({
  ...classCardHeaderStyle,
  marginBottom: isOpen ? 12 : 0,
  cursor: canToggle ? "pointer" : "default",
  outlineOffset: 4,
});

const badgeStackStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
};

const classNameStyle = {
  fontWeight: 900,
  color: "#0f172a",
  fontSize: 18,
};

const runGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const actionRowStyle = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const runBlockStyle = {
  background: "#fff",
  border: "1px solid #dbe4ea",
  borderRadius: 15,
  padding: 14,
  minHeight: 112,
  boxShadow: "0 7px 18px rgba(15, 23, 42, 0.06)",
};

function getRunBlockStyle(variant = "default") {
  const variants = {
    active: {
      border: "1px solid rgba(13, 148, 136, 0.46)",
      background: "linear-gradient(135deg, #ecfdf5 0%, #ffffff 75%)",
      boxShadow:
        "inset 0 4px 0 #0f766e, 0 10px 24px rgba(15, 118, 110, 0.12)",
    },
    next: {
      border: "1px solid rgba(249, 115, 22, 0.38)",
      background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 75%)",
      boxShadow:
        "inset 0 4px 0 #f97316, 0 10px 24px rgba(154, 52, 18, 0.08)",
    },
    waiting: {
      border: "1px solid rgba(59, 130, 246, 0.3)",
      background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 75%)",
      boxShadow:
        "inset 0 4px 0 #3b82f6, 0 10px 24px rgba(30, 64, 175, 0.08)",
    },
    score: {
      border: "1px solid rgba(71, 85, 105, 0.26)",
      background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 75%)",
      boxShadow:
        "inset 0 4px 0 #64748b, 0 10px 24px rgba(15, 23, 42, 0.08)",
    },
  };

  return {
    ...runBlockStyle,
    ...(variants[variant] || null),
  };
}

const scheduleOnlyPanelStyle = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
};

const scheduleDetailListStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 10,
};

const scheduleDetailStyle = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "6px 9px",
  background: "#fff",
  color: "#334155",
  fontWeight: 800,
};

const scheduleProgressStyle = {
  color: "#1d4ed8",
  fontWeight: 900,
  marginTop: 6,
};

const scheduleEditorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  marginTop: 12,
  marginBottom: 10,
};

const scheduleActionGridStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const checkboxLabelStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "#334155",
  fontWeight: 800,
  marginTop: 10,
};

const formLabelStyle = {
  display: "block",
  marginBottom: 5,
  color: "#334155",
  fontWeight: 800,
  fontSize: 13,
};

const formInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
};

const formTextareaStyle = {
  ...formInputStyle,
  minHeight: 76,
  resize: "vertical",
};

const liveBlockHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 8,
};

const dragNoticeStyle = {
  border: "1px solid #fde68a",
  borderRadius: 8,
  padding: 10,
  background: "#fefce8",
  color: "#854d0e",
  fontWeight: 800,
  marginBottom: 12,
};

const completedWrapStyle = {
  marginTop: 12,
  border: "1px solid #dbe4ea",
  borderRadius: 14,
  padding: 13,
  background: "rgba(255, 255, 255, 0.72)",
};

const announcerStandingsWrapStyle = {
  marginTop: 12,
  border: "1px solid #dbe4ea",
  borderRadius: 14,
  padding: 13,
  background: "rgba(255, 255, 255, 0.72)",
};

const announcerAccordionHeaderStyle = (isOpen) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: isOpen ? 10 : 0,
  cursor: "pointer",
  outlineOffset: 4,
});

const announcerStandingsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
  gap: 8,
};

const announcerStandingGroupStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  background: "#f8fafc",
};

const announcerStandingHeaderStyle = (isOpen) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: isOpen ? 8 : 0,
  cursor: "pointer",
  outlineOffset: 4,
});

const announcerStandingListStyle = {
  display: "grid",
  gap: 7,
};

const announcerStandingEntryStyle = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr) auto",
  gap: 8,
  alignItems: "center",
  borderTop: "1px solid #e2e8f0",
  paddingTop: 7,
};

const announcerStandingRankStyle = {
  color: "#047857",
  fontWeight: 900,
};

const announcerStandingIdentityStyle = {
  minWidth: 0,
};

const announcerStandingScoreStyle = {
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
};

const announcerOrderWrapStyle = {
  marginTop: 12,
  border: "1px solid #dbe4ea",
  borderRadius: 14,
  padding: 13,
  background: "rgba(255, 255, 255, 0.72)",
};

const announcerOrderListStyle = {
  display: "grid",
  gap: 8,
};

const announcerOrderRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
};

const announcerOrderDrawStyle = {
  width: 48,
  flex: "0 0 48px",
  fontWeight: 900,
  color: "#0f172a",
};

const announcerOrderIdentityStyle = {
  flex: "1 1 220px",
  minWidth: 0,
};

const runLabelStyle = {
  color: "#526579",
  fontWeight: 900,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 8,
};

const runTitleStyle = {
  fontWeight: 900,
  color: "#0f172a",
  fontSize: 17,
};

const runNameStyle = {
  fontWeight: 800,
  marginTop: 4,
  fontSize: 16,
};

const mutedTextStyle = {
  color: "#64748b",
  fontSize: 13,
};

const detailsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))",
  gap: 6,
  marginTop: 10,
};

const detailCellStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  padding: 6,
  minHeight: 50,
};

const detailNameStyle = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
};

const detailScoreStyle = {
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 900,
  marginTop: 2,
};

const detailPenaltyStyle = {
  color: "#9a3412",
  fontSize: 11,
  fontWeight: 700,
  marginTop: 2,
};

const timerCueStyle = (tone) => ({
  marginTop: 8,
  display: "inline-flex",
  padding: "6px 9px",
  borderRadius: 999,
  border: `1px solid ${tone === "danger" ? "#fecaca" : "#fdba74"}`,
  background: tone === "danger" ? "#fff5f5" : "#fff7ed",
  color: tone === "danger" ? "#991b1b" : "#9a3412",
  fontWeight: 800,
  fontSize: 13,
});

const badgeStyle = (tone) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "4px 9px",
  borderRadius: 999,
  border: `1px solid ${getBadgeColors(tone).border}`,
  background: getBadgeColors(tone).background,
  color: getBadgeColors(tone).color,
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: "nowrap",
});

function getBadgeColors(tone) {
  if (tone === "warn") {
    return {
      border: "#fdba74",
      background: "#fff7ed",
      color: "#9a3412",
    };
  }

  if (tone === "success") {
    return {
      border: "#86efac",
      background: "#ecfdf5",
      color: "#166534",
    };
  }

  if (tone === "danger") {
    return {
      border: "#fecaca",
      background: "#fff5f5",
      color: "#991b1b",
    };
  }

  return {
    border: "#cbd5e1",
    background: "#f8fafc",
    color: "#475569",
  };
}

const linkButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(203, 213, 225, 0.9)",
  background: "#fff",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 800,
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
};

const primaryButtonStyle = {
  padding: "10px 15px",
  borderRadius: 12,
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 850,
  boxShadow: "0 6px 16px rgba(15, 118, 110, 0.18)",
};

const secondaryButtonStyle = {
  padding: "10px 15px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
};

const dangerButtonStyle = {
  ...secondaryButtonStyle,
  border: "1px solid #dc2626",
  color: "#991b1b",
  background: "#fff5f5",
};

const noScoreButtonStyle = {
  ...secondaryButtonStyle,
  border: "1px solid #b45309",
  color: "#92400e",
  background: "#fffbeb",
};

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
  marginTop: 16,
};

const softEmptyStyle = {
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  padding: 14,
  color: "#64748b",
};

export default AnnouncerDashboardPage;
