import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getAnnouncerShowView,
  getAnnouncerShowViewRepository,
  subscribeAnnouncerShowViewRepository,
} from "../../features/live/liveViewRepository";
import { saveClassScheduleDetailsRepository } from "../../features/classes/classSetupRepository";
import { normalizeClassScheduleDetails } from "../../features/classes/classSchedule";
import { formatLiveDataFreshness } from "../../features/live/liveFreshness";
import { advanceArenaLiveClassAfterCompletionRepository } from "../../features/publication/publicationCloudRepository";
import { savePaidWarmupRepository } from "../../features/paidWarmups/paidWarmupRepository";
import {
  PAID_WARMUP_TIMER_CUES,
  formatPaidWarmupTimer,
  getPaidWarmupRemainingSeconds,
  getPaidWarmupTimerCueType,
  resetPaidWarmupTimer,
  setPaidWarmupEntryStatus,
  startPaidWarmupEntry,
  stopPaidWarmupTimer,
} from "../../features/paidWarmups/paidWarmupLive";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { PUBLICATION_STATUSES } from "../../features/publication/publicationRepository";
import { getShowById } from "../../features/shows/showSelectors";
import { appStyles as styles } from "../../styles/appStyles";

let paidWarmupAudioContext = null;

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
  const [isPaidWarmupAudioReady, setIsPaidWarmupAudioReady] = useState(false);
  const autoCompletedPaidWarmupKeyRef = useRef(null);
  const paidWarmupAudioCueKeysRef = useRef(new Set());
  const liveClassIdsKey = useMemo(
    () => getLiveViewClassIds(liveView).join("|"),
    [liveView]
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
    await savePaidWarmupRepository(nextWarmup);
    await refreshLiveViewNow();
  }, [refreshLiveViewNow]);

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

  const handleStartPaidWarmupEntry = (warmup, entryId) => {
    setIsPaidWarmupAudioReady(primePaidWarmupCueAudio());
    return savePaidWarmupUpdate(startPaidWarmupEntry(warmup, entryId, new Date()));
  };

  const handleResetPaidWarmupTimer = (warmup) => {
    setIsPaidWarmupAudioReady(primePaidWarmupCueAudio());
    return savePaidWarmupUpdate(resetPaidWarmupTimer(warmup, new Date()));
  };

  const handleStopPaidWarmupTimer = (warmup) => {
    return savePaidWarmupUpdate(stopPaidWarmupTimer(warmup));
  };

  const handleSetPaidWarmupEntryStatus = (warmup, entryId, status) => {
    return savePaidWarmupUpdate(setPaidWarmupEntryStatus(warmup, entryId, status));
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
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
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

      <div style={{ display: "grid", gap: 16 }}>
        {liveView.sections.map((section) => (
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
                    now={now}
                    onOpenProvisionalRanking={setRankingClass}
                    onSaveScheduleDetails={saveScheduleDetailsUpdate}
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
                    onSetEntryStatus={handleSetPaidWarmupEntryStatus}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {rankingClass && (
        <ProvisionalRankingModal
          classView={rankingClass}
          onClose={() => setRankingClass(null)}
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
  onStartEntry,
  onResetTimer,
  onStopTimer,
  onSetEntryStatus,
}) {
  const { t } = useTranslation();
  const remainingSeconds = getPaidWarmupRemainingSeconds(warmup, now);
  const activeEntry = warmup.activeEntry;
  const nextEntry = warmup.nextEntry;
  const secondNextEntry = warmup.secondNextEntry;

  return (
    <div style={classCardStyle}>
      <div style={classCardHeaderStyle}>
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
          <Badge tone={activeEntry ? "warn" : "muted"}>
            {activeEntry
              ? t("management.announcer.activeTimer")
              : t("public.results.paidWarmup")}
          </Badge>
        </div>
      </div>

      {warmup.isDragDue && (
        <div style={dragNoticeStyle}>
          {t("management.announcer.dragDue", {
            minutes: warmup.dragDurationMinutes,
          })}
        </div>
      )}

      <div style={runGridStyle}>
        <div style={runBlockStyle}>
          <div style={runLabelStyle}>{t("management.announcer.onCourse")}</div>
          {activeEntry ? (
            <>
              <PaidWarmupEntryIdentity entry={activeEntry} />
              <div style={timerInlineStyle}>
                {formatPaidWarmupTimer(remainingSeconds)}
              </div>
              <PaidWarmupTimerCue
                warmup={warmup}
                remainingSeconds={remainingSeconds}
              />
            </>
          ) : (
            <div style={mutedTextStyle}>—</div>
          )}
        </div>

        <PaidWarmupEntryBlock
          label={t("public.results.nextParticipant")}
          entry={nextEntry}
          statusLabel={t("public.results.statusPreparation")}
          status="preparation"
          emptyLabel={t("management.announcer.noPreparationRun")}
        />

        <PaidWarmupEntryBlock
          label={t("public.results.secondNextParticipant")}
          entry={secondNextEntry}
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
        {!activeEntry && nextEntry && (
          <button
            type="button"
            onClick={() => onStartEntry(warmup, nextEntry.id)}
            style={primaryButtonStyle}
          >
            {t("management.announcer.startNext")}
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

        {nextEntry && (
          <>
            <button
              type="button"
              onClick={() => onSetEntryStatus(warmup, nextEntry.id, "no_show")}
              style={secondaryButtonStyle}
            >
              {t("management.announcer.noShowNext")}
            </button>
            <button
              type="button"
              onClick={() => onSetEntryStatus(warmup, nextEntry.id, "scratch")}
              style={secondaryButtonStyle}
            >
              {t("management.announcer.scratchNext")}
            </button>
          </>
        )}
      </div>
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
  return (
    <div style={runBlockStyle}>
      <div style={liveBlockHeaderStyle}>
        <div style={runLabelStyle}>{label}</div>
        {entry && <Badge tone={getOrderStatusTone(status)}>{statusLabel}</Badge>}
      </div>
      {entry ? (
        <PaidWarmupEntryIdentity entry={entry} />
      ) : (
        <div style={mutedTextStyle}>{emptyLabel || "—"}</div>
      )}
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
  now,
  onOpenProvisionalRanking,
  onSaveScheduleDetails,
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState(
    classView.scheduleDetails || {}
  );
  const liveState = getClassLiveState(classView, t);
  const hasProvisionalRanking = classView.provisionalRanking?.length > 0;
  const isScheduleOnly = Boolean(classView.isScheduleOnly);
  const cardDetailsId = `announcer-live-details-${classView.classId || "class"}`;

  useEffect(() => {
    setScheduleDraft(classView.scheduleDetails || {});
  }, [classView.scheduleDetails]);

  function toggleCard() {
    setIsOpen((current) => !current);
  }

  function handleCardKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleCard();
  }

  return (
    <div style={classCardStyle}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={cardDetailsId}
        onClick={toggleCard}
        onKeyDown={handleCardKeyDown}
        style={classCardHeaderToggleStyle(isOpen)}
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
          <LiveFreshnessBadge updatedAt={classView.liveUpdatedAt} now={now} />
          <Badge tone="muted">
            {getPublicationStatusLabel(classView.publicationStatus, t)}
          </Badge>
          <Badge tone={liveState.tone}>{liveState.label}</Badge>
          <Badge tone="muted">
            {isOpen ? t("public.results.hide") : t("public.results.view")}
          </Badge>
        </div>
      </div>

      {!isOpen ? null : (
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
              <div style={runGridStyle}>
                <RunBlock
                  label={t("management.announcer.active")}
                  run={classView.activeRun}
                />
                <RunBlock
                  run={classView.nextRun}
                  statusLabel={t("public.results.statusPreparation")}
                  status="preparation"
                />
                <RunBlock
                  run={classView.secondNextRun}
                  statusLabel={t("public.results.statusWaiting")}
                  status="waiting"
                />
                <RunBlock
                  label={t("management.announcer.latestScore")}
                  run={classView.latestScore}
                  showScore
                />
              </div>

              {classView.orderRuns?.length > 0 && (
                <AnnouncerOrderList runs={classView.orderRuns} />
              )}

              {classView.passedRuns?.length > 0 && (
                <div style={completedWrapStyle}>
                  <div style={runLabelStyle}>
                    {t("management.announcer.passedWithScores")}
                  </div>
                  <RecentResults
                    results={classView.passedRuns.map((run) => ({
                      classId: classView.classId,
                      className: classView.className,
                      run,
                    }))}
                  />
                </div>
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
        </div>
      )}
    </div>
  );
}

function AnnouncerOrderList({ runs }) {
  const { t } = useTranslation();

  return (
    <div style={announcerOrderWrapStyle}>
      <div style={runLabelStyle}>{t("public.results.orderOfGo")}</div>
      <div style={announcerOrderListStyle}>
        {runs.map((run) => (
          <div key={run.id || run.draw} style={announcerOrderRowStyle}>
            <div style={announcerOrderDrawStyle}>#{run.draw || "—"}</div>
            <div style={announcerOrderIdentityStyle}>
              <RunIdentity run={run} />
            </div>
            <Badge tone={getOrderStatusTone(run.liveOrderStatus)}>
              {getAnnouncerRunOrderStatusLabel(run.liveOrderStatus, t)}
            </Badge>
            <RunScoreDisplay run={run} compact />
          </div>
        ))}
      </div>
    </div>
  );
}

function getClassLiveState(classView, t) {
  if (classView.isComplete || classView.status === "completed") {
    return { label: t("management.classes.statusCompleted"), tone: "success" };
  }

  if (classView.isScheduleOnly) {
    return { label: t("public.results.classInProgress"), tone: "warn" };
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
}) {
  return (
    <div style={runBlockStyle}>
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
  borderRadius: 10,
  padding: 18,
  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 14,
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

const heroStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
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
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 28,
};

const subtitleStyle = {
  color: "#64748b",
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
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
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

const classListStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const classCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  background: "#fff",
};

const classCardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  marginBottom: 12,
};

const classCardHeaderToggleStyle = (isOpen) => ({
  ...classCardHeaderStyle,
  marginBottom: isOpen ? 12 : 0,
  cursor: "pointer",
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
  fontWeight: 800,
  color: "#0f172a",
};

const runGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
  marginTop: 12,
};

const actionRowStyle = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const runBlockStyle = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  minHeight: 92,
};

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
  borderTop: "1px solid #e2e8f0",
  paddingTop: 12,
};

const announcerOrderWrapStyle = {
  marginTop: 12,
  borderTop: "1px solid #e2e8f0",
  paddingTop: 12,
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
  borderRadius: 8,
  padding: 10,
  background: "#f8fafc",
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
  color: "#64748b",
  fontWeight: 700,
  fontSize: 12,
  textTransform: "uppercase",
  marginBottom: 8,
};

const runTitleStyle = {
  fontWeight: 800,
  color: "#0f172a",
};

const runNameStyle = {
  fontWeight: 700,
  marginTop: 4,
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
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  textDecoration: "none",
};

const primaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
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
