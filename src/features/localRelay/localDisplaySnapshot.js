const SNAPSHOT_SCHEMA_VERSION = 1;

function text(value) {
  return String(value || "").trim();
}

function copyRun(run) {
  if (!run || typeof run !== "object") return null;

  return {
    id: text(run.id),
    draw: run.draw ?? run.order ?? null,
    backNumber: text(run.backNumber),
    rider: text(run.rider),
    horse: text(run.horse),
    owner: text(run.owner),
    scoreTotal: text(run.scoreTotal),
    status: text(run.status),
    identityHidden: Boolean(run.identityHidden),
    isReview: Boolean(run.isReview),
    isActive: Boolean(run.isActive),
    startedAt: run.startedAt || null,
    completedAt: run.completedAt || null,
  };
}

function copyDragItem(item) {
  if (!item || typeof item !== "object") return null;

  return {
    id: text(item.id),
    type: text(item.type) || "drag",
    label: text(item.label),
    afterDraw: item.afterDraw ?? null,
    durationMinutes: Number(item.durationMinutes) || null,
    startedAt: item.startedAt || null,
    isActive: Boolean(item.isActive),
    nextRun: copyRun(item.nextRun),
  };
}

function copyStandingGroup(group, groupIndex) {
  if (!group || typeof group !== "object") return null;

  return {
    id: text(group.id) || `standing-${groupIndex + 1}`,
    classCode: text(group.classCode || group.code),
    className: text(group.className),
    entries: (Array.isArray(group.entries) ? group.entries : [])
      .map((entry, entryIndex) => ({
        id: text(entry?.id) || `entry-${entryIndex + 1}`,
        rank: Number(entry?.rank) || entryIndex + 1,
        draw: entry?.draw ?? entry?.order ?? null,
        backNumber: text(entry?.backNumber),
        rider: text(entry?.rider),
        horse: text(entry?.horse),
        owner: text(entry?.owner),
        scoreTotal: text(entry?.scoreTotal),
      }))
      .filter((entry) => entry.scoreTotal),
  };
}

function copyClassView(classView) {
  if (!classView || typeof classView !== "object") return null;

  return {
    classId: text(classView.classId),
    className: text(classView.className),
    classCode: text(classView.classCode),
    arena: text(classView.arena),
    pattern: text(classView.pattern),
    publicationStatus: text(classView.publicationStatus),
    liveDisplayMode: text(classView.liveDisplayMode),
    scoringStarted: Boolean(classView.scoringStarted),
    isComplete: Boolean(classView.isComplete),
    activeRun: copyRun(classView.activeRun),
    nextRun: copyRun(classView.nextRun),
    secondNextRun: copyRun(classView.secondNextRun),
    latestScore: copyRun(classView.latestScore),
    lastPassedRuns: (Array.isArray(classView.lastPassedRuns)
      ? classView.lastPassedRuns
      : []
    )
      .map(copyRun)
      .filter(Boolean)
      .slice(0, 3),
    classStandings:
      classView.liveDisplayMode === "order_only"
        ? []
        : (Array.isArray(classView.classStandings)
            ? classView.classStandings
            : []
          )
            .map(copyStandingGroup)
            .filter((group) => group?.entries.length),
    activeDragItem: copyDragItem(classView.activeDragItem),
    dragBreak: classView.dragBreak
      ? {
          ...copyDragItem(classView.dragBreak),
          isActive: Boolean(classView.dragBreak.isActive),
        }
      : null,
    updatedAt: classView.liveUpdatedAt || classView.updatedAt || null,
  };
}

function copyWarmup(warmup) {
  if (!warmup || typeof warmup !== "object") return null;

  return {
    id: text(warmup.id),
    name: text(warmup.name),
    arena: text(warmup.arena),
    isPublicLive: Boolean(warmup.isPublicLive),
    durationMinutesPerRider: Number(warmup.durationMinutesPerRider) || null,
    dragDurationMinutes: Number(warmup.dragDurationMinutes) || null,
    dragDurationSeconds: Number(warmup.dragDurationSeconds) || null,
    activeEntry: copyRun(warmup.activeEntry),
    stagedEntry: copyRun(warmup.stagedEntry),
    onCourseEntry: copyRun(warmup.onCourseEntry),
    nextEntry: copyRun(warmup.nextEntry),
    secondNextEntry: copyRun(warmup.secondNextEntry),
    lastPassedEntries: (Array.isArray(warmup.lastPassedEntries)
      ? warmup.lastPassedEntries
      : []
    )
      .map(copyRun)
      .filter(Boolean)
      .slice(0, 2),
    activeDragItem: copyDragItem(warmup.activeDragItem),
    activeStartedAt: warmup.activeStartedAt || null,
    updatedAt: warmup.updatedAt || null,
  };
}

function copySponsorGroups(association) {
  const groups = Array.isArray(association?.sponsorGroups)
    ? association.sponsorGroups
    : [];

  return groups.map((group, groupIndex) => ({
    id: text(group?.id) || `group-${groupIndex + 1}`,
    name: text(group?.name),
    logos: (Array.isArray(group?.logos) ? group.logos : [])
      .map((logo, logoIndex) => ({
        id: text(logo?.id) || `sponsor-${logoIndex + 1}`,
        name: text(logo?.name),
        logoDataUrl: text(logo?.logoDataUrl || logo?.logo_data_url),
      }))
      .filter((logo) => logo.logoDataUrl),
  }));
}

export function buildLocalDisplaySnapshot({
  association,
  show,
  liveView,
  generatedAt = new Date().toISOString(),
} = {}) {
  const sections = Array.isArray(liveView?.sections) ? liveView.sections : [];

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt,
    association: {
      id: text(association?.id),
      name: text(association?.name),
      shortName: text(association?.shortName),
      logoDataUrl: text(association?.logoDataUrl),
      sponsorGroups: copySponsorGroups(association),
    },
    show: {
      id: text(show?.id),
      name: text(show?.name),
      venue: text(show?.venue),
      location: text(show?.location),
      obsOverlayMode: show?.obsOverlayMode === "neutral" ? "neutral" : "live",
      isTvDisplayPaused: Boolean(show?.isTvDisplayPaused),
      tvDisplayMessageFr: text(show?.tvDisplayMessageFr),
      tvDisplayMessageEn: text(show?.tvDisplayMessageEn),
      tvDisplayVideoArena: text(show?.tvDisplayVideoArena),
    },
    liveClasses: sections
      .flatMap((section) => section?.classes || [])
      .map(copyClassView)
      .filter((classView) => classView?.classId),
    livePaidWarmups: sections
      .flatMap((section) => section?.paidWarmups || [])
      .map(copyWarmup)
      .filter((warmup) => warmup?.id),
  };
}

export { SNAPSHOT_SCHEMA_VERSION };
