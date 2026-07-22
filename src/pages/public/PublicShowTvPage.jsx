import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import {
  getPublicAssociationRepository,
  getPublicShowRepository,
  getPublicShowView,
  getPublicShowViewRepository,
  subscribePublicShowViewRepository,
} from "../../features/publication/publicViewRepository";
import { translate } from "../../features/i18n/i18n";
import { isLiveDragItem } from "../../features/live/liveQueueItems";
import {
  buildSponsorLevelSlides,
  getAssociationSponsorGroups,
} from "../../features/associations/sponsorLogos";
import { getTvDisplayVideoPublicUrl } from "../../features/tvDisplay/tvDisplayVideo";

const TV_REFRESH_MS = 5000;
const SPONSOR_SLIDE_INTERVAL_MS = 9000;
const SPONSORS_PER_SLIDE = 5;

function PublicShowTvPage() {
  const { associationId, showId } = useParams();
  const location = useLocation();
  const [association, setAssociation] = useState(null);
  const [show, setShow] = useState(null);
  const [publicView, setPublicView] = useState(() => getPublicShowView(showId));
  const [sponsorSlideIndex, setSponsorSlideIndex] = useState(0);
  const selectedArena = useMemo(
    () => getArenaFromSearch(location.search),
    [location.search]
  );
  const sponsorGroups = getAssociationSponsorGroups(association);
  const sponsorSlides = buildSponsorLevelSlides(
    sponsorGroups,
    SPONSORS_PER_SLIDE
  );
  const visibleSponsorSlide =
    sponsorSlides[sponsorSlideIndex % sponsorSlides.length] || [];
  const liveItem = useMemo(
    () => pickTvLiveItem(publicView, selectedArena),
    [publicView, selectedArena]
  );
  const tvVideoUrl = getTvDisplayVideoPublicUrl(show?.tvDisplayVideoPath);
  const isCompetitionVideoDisplay = Boolean(
    !show?.isTvDisplayPaused &&
      tvVideoUrl &&
      selectedArena &&
      normalizeArenaName(show?.tvDisplayVideoArena).toLowerCase() ===
        normalizeArenaName(selectedArena).toLowerCase()
  );
  const publicClassIdsKey = (publicView?.classIds || []).join("|");
  const displayMode = isCompetitionVideoDisplay
    ? "competition-video"
    : show?.isTvDisplayPaused
    ? "paused"
    : liveItem
      ? "live"
      : "welcome";

  useEffect(() => {
    let isMounted = true;

    async function loadTvDisplay() {
      const [nextAssociation, nextShow, nextPublicView] = await Promise.all([
        getPublicAssociationRepository(associationId),
        getPublicShowRepository(showId),
        getPublicShowViewRepository(showId),
      ]);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setShow(nextShow);
      setPublicView(nextPublicView);
    }

    loadTvDisplay();

    return () => {
      isMounted = false;
    };
  }, [associationId, showId]);

  useEffect(() => {
    let isMounted = true;
    let refreshTimeout = null;

    const refreshPublicView = () => {
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(async () => {
        const nextPublicView = await getPublicShowViewRepository(showId);
        const nextShow = await getPublicShowRepository(showId);

        if (!isMounted) return;
        setPublicView(nextPublicView);
        setShow(nextShow);
      }, 200);
    };

    const classIds = publicClassIdsKey ? publicClassIdsKey.split("|") : [];
    const unsubscribe = subscribePublicShowViewRepository(
      showId,
      classIds,
      refreshPublicView
    );

    return () => {
      isMounted = false;
      window.clearTimeout(refreshTimeout);
      unsubscribe();
    };
  }, [showId, publicClassIdsKey]);

  useEffect(() => {
    let isMounted = true;
    const refreshTimer = window.setInterval(async () => {
      const [nextShow, nextPublicView] = await Promise.all([
        getPublicShowRepository(showId),
        getPublicShowViewRepository(showId),
      ]);

      if (!isMounted) return;
      setShow(nextShow);
      setPublicView(nextPublicView);
    }, TV_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
    };
  }, [showId]);

  useEffect(() => {
    setSponsorSlideIndex(0);
  }, [sponsorSlides.length]);

  useEffect(() => {
    if (sponsorSlides.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setSponsorSlideIndex(
        (currentIndex) => (currentIndex + 1) % sponsorSlides.length
      );
    }, SPONSOR_SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [sponsorSlides.length]);

  return (
    <main style={isCompetitionVideoDisplay ? competitionPageStyle : pageStyle}>
      <div style={backgroundGlowStyle} />
      {!isCompetitionVideoDisplay ? (
        <header style={headerStyle}>
          <div style={brandStyle}>
            <AssociationLogo association={association} size={74} />
            <div style={{ minWidth: 0 }}>
              <div style={eyebrowStyle}>
                <BilingualText fr="Affichage manège" en="Arena display" />
              </div>
              <div style={showTitleStyle}>
                {show?.name || association?.name || ""}
              </div>
              <div style={showMetaStyle}>
                {[association?.name, show?.venue, show?.location]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          </div>
          {selectedArena ? (
            <div style={arenaBadgeStyle}>
              <BilingualText fr="Manège" en="Arena" /> · {selectedArena}
            </div>
          ) : null}
        </header>
      ) : null}

      {displayMode === "competition-video" ? (
        <CompetitionVideoPanel
          videoUrl={tvVideoUrl}
          liveItem={liveItem}
          selectedArena={selectedArena}
          show={show}
        />
      ) : displayMode === "paused" ? (
        <PausePanel association={association} show={show} />
      ) : displayMode === "live" ? (
        <LivePanel liveItem={liveItem} />
      ) : (
        <WelcomePanel association={association} show={show} />
      )}

      {!isCompetitionVideoDisplay ? (
        <SponsorRail
          slide={visibleSponsorSlide}
          expanded={displayMode === "welcome"}
        />
      ) : null}
    </main>
  );
}

function CompetitionVideoPanel({ videoUrl, liveItem, selectedArena, show }) {
  const isWarmup = liveItem?.kind === "paidWarmup";
  const title = liveItem
    ? isWarmup
      ? liveItem.item?.name || "Paid warm up"
      : liveItem.item?.className || "Classe / Class"
    : show?.name || "";
  const current = liveItem
    ? isWarmup
      ? buildWarmupCurrent(liveItem.item)
      : buildClassCurrent(liveItem.item)
    : null;
  const upcoming = liveItem
    ? (isWarmup
        ? buildWarmupUpcoming(liveItem.item)
        : buildClassUpcoming(liveItem.item)
      ).find(Boolean)
    : null;
  const previous = liveItem
    ? (isWarmup
        ? buildWarmupPrevious(liveItem.item)
        : buildClassPrevious(liveItem.item)
      )[0] || null
    : null;

  return (
    <section
      style={competitionVideoLayoutStyle}
      data-tv-layout="competition-video"
    >
      <div style={competitionVideoWrapStyle}>
        <video
          key={videoUrl}
          src={videoUrl}
          style={competitionVideoStyle}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          data-tv-competition-video
        />
      </div>

      <div style={competitionLiveStripStyle} data-tv-live-strip>
        <div style={competitionBlockStyle}>
          <div style={competitionLiveLabelStyle}>
            {liveItem ? (
              <BilingualText fr="En direct" en="Live" />
            ) : (
              <BilingualText fr="En attente" en="Waiting" />
            )}
            {selectedArena ? ` · ${selectedArena}` : ""}
          </div>
          <div style={competitionClassNameStyle}>{title}</div>
        </div>

        {liveItem ? (
          <>
            <CompetitionStripParticipant
              labelFr="En piste"
              labelEn="On course"
              participant={current}
              active
            />
            <CompetitionStripParticipant
              labelFr="Prochain"
              labelEn="Up next"
              participant={upcoming}
            />
            <CompetitionStripParticipant
              labelFr="Dernier passage"
              labelEn="Last run"
              participant={previous}
            />
          </>
        ) : (
          <div style={competitionWaitingStyle}>
            <BilingualText
              fr="Les données du passage apparaîtront ici dès que le live sera lancé."
              en="Run data will appear here as soon as live starts."
            />
          </div>
        )}
      </div>
    </section>
  );
}

function CompetitionStripParticipant({
  labelFr,
  labelEn,
  participant,
  active = false,
}) {
  return (
    <div style={competitionParticipantStyle(active)}>
      <div style={competitionParticipantLabelStyle}>
        <BilingualText fr={labelFr} en={labelEn} />
      </div>
      <div style={competitionParticipantNameStyle}>
        {participant?.meta ? `${participant.meta} · ` : ""}
        {participant?.fr || "—"}
      </div>
      {participant?.horse ? (
        <div style={competitionParticipantHorseStyle}>{participant.horse}</div>
      ) : null}
      {participant?.score ? (
        <div style={competitionParticipantScoreStyle}>
          Score · {participant.score}
        </div>
      ) : null}
    </div>
  );
}

function LivePanel({ liveItem }) {
  const isWarmup = liveItem?.kind === "paidWarmup";
  const title = isWarmup
    ? liveItem.item?.name ||
      formatBilingualInline(
        translate("fr", "public.tv.paidWarmup"),
        translate("en", "public.tv.paidWarmup")
      )
    : liveItem?.item?.className ||
      formatBilingualInline(
        translate("fr", "public.tv.block"),
        translate("en", "public.tv.block")
      );
  const subtitle = isWarmup
    ? formatWarmupSubtitle(liveItem.item)
    : formatClassSubtitle(liveItem.item);
  const current = isWarmup
    ? buildWarmupCurrent(liveItem.item)
    : buildClassCurrent(liveItem.item);
  const upcoming = isWarmup
    ? buildWarmupUpcoming(liveItem.item)
    : buildClassUpcoming(liveItem.item);
  const previous = isWarmup
    ? buildWarmupPrevious(liveItem.item)
    : buildClassPrevious(liveItem.item);
  const upcomingCards = buildTvUpcomingCards(
    upcoming,
    liveItem?.item?.nextScheduleItem
  );
  const hasUpcomingCards = upcomingCards.length > 0;

  return (
    <section style={liveGridStyle}>
      <div style={liveHeroStyle}>
        <div style={sectionKickerStyle}>
          <BilingualText fr="En cours" en="Now live" />
        </div>
        <h1 style={blockTitleStyle}>{title}</h1>
        {subtitle ? <div style={blockSubtitleStyle}>{subtitle}</div> : null}

        <ParticipantCard
          labelFr="En piste"
          labelEn="On course"
          participant={current}
          variant="active"
        />
      </div>

      <aside style={sideStackStyle(hasUpcomingCards)}>
        {hasUpcomingCards ? (
          <div style={upcomingPanelStyle(upcomingCards.length)}>
            <div style={panelTitleStyle}>
              <BilingualText fr="À venir" en="Up next" />
            </div>
            {upcomingCards.map((card, index) => (
              <ParticipantCard
                key={`${card.participant.type}-${card.participant.meta || card.participant.fr}-${index}`}
                labelFr={card.labelFr}
                labelEn={card.labelEn}
                participant={card.participant}
                variant={card.variant}
              />
            ))}
          </div>
        ) : null}

        <div style={lastPanelStyle}>
          <div style={panelTitleStyle}>
            <BilingualText fr="Derniers passés" en="Last completed" />
          </div>
          <div style={previousGridStyle}>
            <ParticipantCard
              labelFr="Dernier"
              labelEn="Last"
              participant={previous[0]}
              variant="previous"
              compact
            />
            <ParticipantCard
              labelFr="Avant-dernier"
              labelEn="Previous"
              participant={previous[1]}
              variant="previous"
              compact
            />
          </div>
        </div>
      </aside>
    </section>
  );
}

function PausePanel({ association, show }) {
  const messages = getPauseMessages(show);

  return (
    <section style={centerPanelStyle}>
      <div style={centerLogoWrapStyle}>
        <AssociationLogo association={association} size={148} />
      </div>
      <div style={sectionKickerStyle}>
        <BilingualText fr="Live en pause" en="Live paused" />
      </div>
      <h1 style={centerTitleStyle}>{messages.fr}</h1>
      <h2 style={centerSubtitleStyle}>{messages.en}</h2>
      <div style={centerMetaStyle}>
        {[association?.name, show?.venue, show?.location]
          .filter(Boolean)
          .join(" · ")}
      </div>
    </section>
  );
}

function WelcomePanel({ association, show }) {
  const showName = show?.name || association?.name || "";
  const associationName =
    association?.name && association.name !== showName ? association.name : "";

  return (
    <section style={centerPanelStyle}>
      <div style={centerLogoWrapStyle}>
        <AssociationLogo association={association} size={148} />
      </div>
      <div style={sectionKickerStyle}>
        <BilingualText fr="Bienvenue à" en="Welcome to" />
      </div>
      <h1 style={centerTitleStyle}>{showName}</h1>
      {associationName ? (
        <h2 style={centerSubtitleStyle}>{associationName}</h2>
      ) : null}
      <div style={centerMetaStyle}>
        {[show?.venue, show?.location].filter(Boolean).join(" · ")}
      </div>
      <div style={welcomeNoticeStyle}>
        <BilingualText
          fr="Le prochain bloc apparaîtra ici dès que le live sera lancé."
          en="The next block will appear here as soon as live starts."
        />
      </div>
    </section>
  );
}

function ParticipantCard({
  labelFr,
  labelEn,
  participant,
  variant = "next",
  compact = false,
}) {
  if (!participant && !compact) return null;

  const data = participant || { fr: "—", en: "" };
  const isDrag = data.type === "drag";

  return (
    <article style={participantCardStyle(variant, compact, isDrag)}>
      <div style={participantLabelStyle(variant)}>
        <BilingualText fr={labelFr} en={labelEn} />
      </div>
      {data.meta ? (
        <div style={participantMetaStyle(compact, variant)}>{data.meta}</div>
      ) : null}
      <div style={participantNameStyle(compact, isDrag, variant)}>{data.fr}</div>
      {data.en ? <div style={participantSecondaryNameStyle}>{data.en}</div> : null}
      {data.horse ? (
        <div style={horseStyle(compact, variant)}>{data.horse}</div>
      ) : null}
      {data.score ? <ScoreBlock participant={data} compact={compact} /> : null}
    </article>
  );
}

function ScoreBlock({ participant, compact }) {
  return (
    <div style={scoreWrapStyle(compact)}>
      <div style={scorePillStyle}>
        <BilingualText fr="Score" en="Score" /> · {participant.score}
      </div>
    </div>
  );
}

function SponsorRail({ slide, expanded = false }) {
  const sponsors = Array.isArray(slide?.sponsors) ? slide.sponsors : [];
  const hasSponsors = sponsors.length > 0;

  return (
    <footer
      style={sponsorRailStyle(expanded)}
      data-sponsor-layout={expanded ? "expanded" : "standard"}
    >
      <div style={sponsorHeadingStyle}>
        <div style={sponsorTitleStyle} data-sponsor-title>
          <BilingualText fr="Commanditaires" en="Sponsors" />
        </div>
        {slide?.groupName ? (
          <div style={sponsorLevelStyle(expanded)} data-sponsor-level>
            {slide.groupName}
          </div>
        ) : null}
      </div>
      {hasSponsors ? (
        <div style={sponsorGridStyle}>
          {sponsors.map((sponsor) => (
            <div key={sponsor.id} style={sponsorTileStyle(expanded)}>
              <img
                src={sponsor.logoDataUrl}
                alt={sponsor.name || "Sponsor"}
                style={sponsorImageStyle}
              />
            </div>
          ))}
        </div>
      ) : (
        <div style={sponsorEmptyStyle}>
          <strong>ShowScore</strong>
          <span>showScore.app</span>
        </div>
      )}
    </footer>
  );
}

function BilingualText({ fr, en }) {
  return (
    <>
      <span>{fr}</span>
      <span style={bilingualSeparatorStyle}>/</span>
      <span>{en}</span>
    </>
  );
}

function pickTvLiveItem(publicView, arena = "") {
  const liveClasses = filterByArena(publicView?.liveClasses, arena);
  const liveWarmups = filterByArena(publicView?.livePaidWarmups, arena);
  const warmup =
    liveWarmups.find((item) => item.activeDragItem) ||
    liveWarmups.find((item) => item.activeEntry || item.stagedEntry) ||
    liveWarmups.find((item) => item.nextEntry) ||
    liveWarmups[0] ||
    null;
  const classView =
    liveClasses.find((item) => item.activeDragItem || item.dragBreak?.isActive) ||
    liveClasses.find((item) => item.activeRun) ||
    liveClasses.find((item) => item.nextRun) ||
    liveClasses.find((item) => item.latestScore) ||
    liveClasses[0] ||
    null;

  if (warmup?.activeDragItem || warmup?.activeEntry || warmup?.stagedEntry) {
    return { kind: "paidWarmup", item: warmup };
  }

  if (classView?.activeDragItem || classView?.activeRun) {
    return { kind: "class", item: classView };
  }

  if (warmup) return { kind: "paidWarmup", item: warmup };
  if (classView) return { kind: "class", item: classView };

  return null;
}

function filterByArena(items, arena) {
  const source = Array.isArray(items) ? items.filter(Boolean) : [];
  const arenaKey = normalizeArenaName(arena).toLowerCase();

  if (!arenaKey) return source;

  return source.filter(
    (item) => normalizeArenaName(item?.arena).toLowerCase() === arenaKey
  );
}

function buildClassCurrent(classView) {
  if (classView?.activeDragItem || classView?.dragBreak?.isActive) {
    return formatDragItem(classView.activeDragItem || classView.dragBreak);
  }

  return formatRun(classView?.activeRun || classView?.nextRun, {
    showScore: false,
  });
}

function buildClassUpcoming(classView) {
  return [classView?.nextLiveItem, classView?.secondNextLiveItem].map((item) =>
    isLiveDragItem(item)
      ? formatDragItem(item)
      : formatRun(item?.item || item, { showScore: false })
  );
}

function buildClassPrevious(classView) {
  return (classView?.lastPassedRuns || [])
    .slice(0, 2)
    .map((run) => formatRun(run));
}

function buildWarmupCurrent(warmup) {
  if (warmup?.activeDragItem) {
    return formatDragItem(warmup.activeDragItem);
  }

  return formatEntry(warmup?.onCourseEntry || warmup?.activeEntry || warmup?.nextEntry);
}

function buildWarmupUpcoming(warmup) {
  return [warmup?.nextLiveItem, warmup?.secondNextLiveItem].map((item) =>
    isLiveDragItem(item) ? formatDragItem(item) : formatEntry(item?.item || item)
  );
}

function buildWarmupPrevious(warmup) {
  return (warmup?.lastPassedEntries || []).slice(0, 2).map(formatEntry);
}

export function buildTvUpcomingCards(upcoming, nextScheduleItem) {
  const participantCards = (Array.isArray(upcoming) ? upcoming : [])
    .filter(Boolean)
    .slice(0, 2)
    .map((participant, index) => ({
      participant,
      labelFr: index === 0 ? "Prochain" : "2e prochain",
      labelEn: index === 0 ? "Next" : "Second next",
      variant: index === 0 ? "next" : "waiting",
    }));

  if (participantCards.length >= 2 || !nextScheduleItem) {
    return participantCards;
  }

  const nextScheduleParticipant = formatNextScheduleItem(nextScheduleItem);
  if (!nextScheduleParticipant) return participantCards;

  return [
    ...participantCards,
    {
      participant: nextScheduleParticipant,
      labelFr: nextScheduleItem.isPaidWarmup
        ? "Prochain bloc"
        : "Prochaine classe",
      labelEn: nextScheduleItem.isPaidWarmup ? "Next block" : "Next class",
      variant: participantCards.length === 0 ? "next" : "waiting",
    },
  ];
}

function formatRun(run, { showScore = true } = {}) {
  if (!run) return null;

  const draw = run.draw ? `#${run.draw}` : "";
  if (run.identityHidden) {
    return {
      type: "run",
      fr: draw ? `Ordre ${draw}` : "Ordre en piste",
      en: draw ? `Order ${draw}` : "On-course order",
      horse: "",
      meta: "",
      score: "",
    };
  }

  const back = run.backNumber ? `Back ${run.backNumber}` : "";
  const score = showScore ? String(run.scoreTotal || "").trim() : "";

  return {
    type: "run",
    fr: run.rider || translate("fr", "public.results.riderFallback"),
    en: run.rider ? "" : translate("en", "public.results.riderFallback"),
    horse: [
      run.horse,
      run.owner ? `Propriétaire / Owner: ${run.owner}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    meta: [draw, back].filter(Boolean).join(" · "),
    score,
  };
}

function formatEntry(entry) {
  if (!entry) return null;

  const order = entry.order ? `#${entry.order}` : "";
  const back = entry.backNumber ? `Back ${entry.backNumber}` : "";

  return {
    type: "entry",
    fr: entry.rider || translate("fr", "public.results.riderFallback"),
    en: entry.rider ? "" : translate("en", "public.results.riderFallback"),
    horse: [entry.horse, entry.owner].filter(Boolean).join(" · "),
    meta: [order, back].filter(Boolean).join(" · "),
  };
}

function formatDragItem(item) {
  const minutes = item?.durationMinutes ? `${item.durationMinutes} min` : "";

  return {
    type: "drag",
    fr: translate("fr", "public.results.drag"),
    en: translate("en", "public.results.drag"),
    horse: minutes,
    meta: "",
  };
}

function formatNextScheduleItem(item) {
  if (!item) return null;

  const typeLabel = item.isPaidWarmup
    ? "Paid warm up"
    : "Classe / Class";
  const arenaLabel = item.arena ? `Manège / Arena: ${item.arena}` : "";
  const startLabel = formatNextScheduleStart(item);

  return {
    type: "schedule",
    fr: item.name || (item.isPaidWarmup ? "Paid warm up" : "Prochaine classe"),
    en: "",
    horse: startLabel,
    meta: [typeLabel, arenaLabel].filter(Boolean).join(" · "),
  };
}

function formatNextScheduleStart(item) {
  if (!item?.startAt) return "";

  const date = new Date(item.startAt);
  if (Number.isNaN(date.getTime())) return "";

  const time = new Intl.DateTimeFormat("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const label =
    item.startKind === "fixed"
      ? "Heure prévue / Scheduled"
      : "Estimation / Estimate";

  return `${label}: ${time}`;
}

function formatClassSubtitle(classView) {
  return [
    classView?.classCode,
    classView?.arena,
    classView?.pattern,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatWarmupSubtitle(warmup) {
  return [
    warmup?.arena,
    warmup?.durationMinutesPerRider
      ? `${warmup.durationMinutesPerRider} min/cavalier · ${warmup.durationMinutesPerRider} min/rider`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatBilingualInline(fr, en) {
  return `${fr} / ${en}`;
}

function isPrimaryVariant(variant) {
  return variant === "active";
}

function getPauseMessages(show) {
  return {
    fr:
      String(show?.tvDisplayMessageFr || "").trim() ||
      translate("fr", "public.tv.pauseDefaultMessage"),
    en:
      String(show?.tvDisplayMessageEn || "").trim() ||
      translate("en", "public.tv.pauseDefaultMessage"),
  };
}

function getArenaFromSearch(search) {
  const params = new URLSearchParams(search || "");
  return normalizeArenaName(params.get("arena") || "");
}

function normalizeArenaName(value) {
  return String(value || "").trim();
}

const pageStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
  background:
    "linear-gradient(135deg, #101820 0%, #1f2f35 45%, #171717 100%)",
  color: "#f8fafc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  gap: 14,
  padding: 18,
  boxSizing: "border-box",
};

const competitionPageStyle = {
  ...pageStyle,
  display: "block",
  padding: 0,
  background: "#000",
};

const competitionVideoLayoutStyle = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  height: "100%",
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) auto",
  background: "#000",
};

const competitionVideoWrapStyle = {
  minHeight: 0,
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  background: "#000",
};

const competitionVideoStyle = {
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "contain",
  background: "#000",
};

const competitionLiveStripStyle = {
  minHeight: 150,
  display: "grid",
  gridTemplateColumns: "minmax(250px, 0.85fr) repeat(3, minmax(0, 1fr))",
  alignItems: "stretch",
  borderTop: "3px solid #f4d98c",
  background: "linear-gradient(90deg, #111827 0%, #17252c 100%)",
  color: "#fff",
};

const competitionBlockStyle = {
  minWidth: 0,
  display: "grid",
  alignContent: "center",
  gap: 8,
  padding: "18px 24px",
  background: "rgba(244, 217, 140, 0.1)",
  borderRight: "1px solid rgba(255, 255, 255, 0.16)",
};

const competitionLiveLabelStyle = {
  color: "#f4d98c",
  fontSize: "clamp(16px, 1.2vw, 23px)",
  fontWeight: 950,
  textTransform: "uppercase",
};

const competitionClassNameStyle = {
  overflow: "hidden",
  color: "#fff",
  fontSize: "clamp(22px, 2vw, 38px)",
  fontWeight: 950,
  lineHeight: 1,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
};

const competitionParticipantStyle = (active) => ({
  position: "relative",
  minWidth: 0,
  display: "grid",
  alignContent: "center",
  gap: 5,
  padding: "16px 22px",
  borderRight: "1px solid rgba(255, 255, 255, 0.16)",
  background: active ? "rgba(13, 148, 136, 0.22)" : "transparent",
});

const competitionParticipantLabelStyle = {
  color: "#f4d98c",
  fontSize: "clamp(14px, 1vw, 20px)",
  fontWeight: 950,
  textTransform: "uppercase",
};

const competitionParticipantNameStyle = {
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  fontSize: "clamp(20px, 1.75vw, 34px)",
  fontWeight: 950,
  lineHeight: 1.05,
};

const competitionParticipantHorseStyle = {
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  color: "#cbd5e1",
  fontSize: "clamp(15px, 1.1vw, 22px)",
  fontWeight: 750,
};

const competitionParticipantScoreStyle = {
  justifySelf: "start",
  padding: "3px 8px",
  borderRadius: 6,
  background: "rgba(34, 197, 94, 0.18)",
  color: "#bbf7d0",
  fontSize: "clamp(15px, 1vw, 20px)",
  fontWeight: 950,
};

const competitionWaitingStyle = {
  gridColumn: "span 3",
  display: "grid",
  placeItems: "center",
  padding: "18px 28px",
  color: "#dbeafe",
  fontSize: "clamp(20px, 1.6vw, 30px)",
  fontWeight: 850,
  textAlign: "center",
};

const backgroundGlowStyle = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(90deg, rgba(229, 198, 125, 0.16), transparent 38%, rgba(43, 132, 125, 0.18))",
  pointerEvents: "none",
};

const headerStyle = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
};

const brandStyle = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const eyebrowStyle = {
  color: "#f4d98c",
  fontSize: 15,
  fontWeight: 900,
  textTransform: "uppercase",
};

const showTitleStyle = {
  marginTop: 3,
  fontSize: "clamp(28px, 3vw, 46px)",
  fontWeight: 950,
  lineHeight: 1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const showMetaStyle = {
  marginTop: 6,
  color: "#cbd5e1",
  fontSize: "clamp(15px, 1.35vw, 20px)",
  fontWeight: 700,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const arenaBadgeStyle = {
  padding: "12px 16px",
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.1)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  fontSize: 18,
  fontWeight: 900,
};

const liveGridStyle = {
  position: "relative",
  zIndex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.12fr) minmax(440px, 0.88fr)",
  gap: 16,
};

const liveHeroStyle = {
  minWidth: 0,
  borderRadius: 16,
  border: "1px solid rgba(244, 217, 140, 0.34)",
  background: "rgba(15, 23, 42, 0.68)",
  padding: 20,
  display: "grid",
  gridTemplateRows: "auto auto auto minmax(0, 1fr)",
  gap: 8,
  overflow: "hidden",
};

const sectionKickerStyle = {
  color: "#f4d98c",
  fontSize: "clamp(16px, 1.25vw, 22px)",
  fontWeight: 950,
  textTransform: "uppercase",
};

const blockTitleStyle = {
  margin: 0,
  fontSize: "clamp(44px, 4.8vw, 78px)",
  lineHeight: 0.95,
  fontWeight: 950,
  letterSpacing: 0,
};

const blockSubtitleStyle = {
  color: "#cbd5e1",
  fontSize: "clamp(18px, 1.5vw, 26px)",
  fontWeight: 800,
};

const sideStackStyle = (hasUpcomingCards) => ({
  minWidth: 0,
  minHeight: 0,
  display: "grid",
  gridTemplateRows: hasUpcomingCards
    ? "minmax(0, 1fr) minmax(0, 0.96fr)"
    : "minmax(0, 1fr)",
  gap: 16,
});

const panelStyle = {
  minHeight: 0,
  borderRadius: 16,
  border: "1px solid rgba(148, 163, 184, 0.34)",
  background: "rgba(15, 23, 42, 0.54)",
  padding: 14,
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) minmax(0, 1fr)",
  gap: 8,
  overflow: "hidden",
};

const upcomingPanelStyle = (cardCount) => ({
  ...panelStyle,
  gridTemplateRows: `auto repeat(${cardCount}, minmax(0, 1fr))`,
});

const lastPanelStyle = {
  ...panelStyle,
  gridTemplateRows: "auto minmax(0, 1fr)",
};

const panelTitleStyle = {
  color: "#f4d98c",
  fontSize: "clamp(17px, 1.2vw, 22px)",
  fontWeight: 950,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const previousGridStyle = {
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  overflow: "hidden",
};

const participantCardStyle = (variant, compact, isDrag) => {
  const accents = {
    active: "#22c55e",
    next: "#f59e0b",
    waiting: "#60a5fa",
    previous: "#94a3b8",
  };
  const accent = isDrag ? "#f4d98c" : accents[variant] || "#94a3b8";

  return {
    minWidth: 0,
    minHeight: 0,
    borderRadius: 14,
    border: `1px solid ${accent}`,
    background: isDrag
      ? "rgba(67, 56, 202, 0.42)"
      : "rgba(255, 255, 255, 0.08)",
    padding: compact ? 12 : isPrimaryVariant(variant) ? 18 : 14,
    display: "grid",
    alignContent: variant === "active" ? "center" : "start",
    gap: compact ? 4 : isPrimaryVariant(variant) ? 10 : 6,
    boxShadow: `inset 5px 0 0 ${accent}, 0 10px 24px rgba(0, 0, 0, 0.12)`,
    overflow: "hidden",
  };
};

const participantLabelStyle = (variant) => ({
  color: "#cbd5e1",
  fontSize: isPrimaryVariant(variant)
    ? "clamp(20px, 1.8vw, 32px)"
    : "clamp(12px, 0.8vw, 14px)",
  fontWeight: 950,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const participantMetaStyle = (compact, variant) => ({
  color: "#f4d98c",
  fontSize: compact
    ? "clamp(17px, 1.25vw, 22px)"
    : isPrimaryVariant(variant)
      ? "clamp(34px, 3.2vw, 58px)"
      : "clamp(17px, 1.35vw, 23px)",
  fontWeight: 950,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const participantNameStyle = (compact, isDrag, variant) => {
  const isPrimary = variant === "active";
  const fontSize = isDrag
    ? isPrimary
      ? "clamp(42px, 4.5vw, 74px)"
      : "clamp(27px, 2.6vw, 42px)"
    : compact
      ? "clamp(20px, 1.55vw, 28px)"
      : isPrimary
        ? "clamp(36px, 4vw, 66px)"
        : "clamp(25px, 2.35vw, 38px)";

  return {
    color: "#ffffff",
    fontSize,
    lineHeight: 1.02,
    fontWeight: 950,
    overflowWrap: "anywhere",
    display: "-webkit-box",
    WebkitLineClamp: compact ? 2 : isPrimary ? 3 : 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
};

const participantSecondaryNameStyle = {
  color: "#cbd5e1",
  fontSize: "clamp(16px, 1.4vw, 24px)",
  fontWeight: 800,
};

const horseStyle = (compact, variant) => ({
  color: "#e2e8f0",
  fontSize: compact
    ? "clamp(17px, 1.3vw, 24px)"
    : isPrimaryVariant(variant)
      ? "clamp(16px, 1.45vw, 24px)"
      : "clamp(17px, 1.35vw, 22px)",
  lineHeight: 1.08,
  fontWeight: 800,
  display: "-webkit-box",
  WebkitLineClamp: compact ? 3 : isPrimaryVariant(variant) ? 2 : 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

const scoreWrapStyle = (compact) => ({
  marginTop: compact ? 4 : 10,
  display: "grid",
  gap: compact ? 6 : 8,
});

const scorePillStyle = {
  justifySelf: "start",
  padding: "6px 10px",
  borderRadius: 8,
  background: "rgba(34, 197, 94, 0.16)",
  border: "1px solid rgba(34, 197, 94, 0.5)",
  color: "#bbf7d0",
  fontSize: "clamp(17px, 1.25vw, 24px)",
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const centerPanelStyle = {
  position: "relative",
  zIndex: 1,
  minHeight: 0,
  borderRadius: 8,
  border: "1px solid rgba(244, 217, 140, 0.34)",
  background: "rgba(15, 23, 42, 0.68)",
  display: "grid",
  placeItems: "center",
  alignContent: "center",
  gap: 18,
  padding: 32,
  textAlign: "center",
};

const centerLogoWrapStyle = {
  padding: 18,
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.09)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
};

const centerTitleStyle = {
  margin: 0,
  maxWidth: "min(1200px, 90vw)",
  fontSize: "clamp(52px, 6vw, 112px)",
  lineHeight: 0.95,
  fontWeight: 950,
  letterSpacing: 0,
};

const centerSubtitleStyle = {
  margin: 0,
  maxWidth: "min(1100px, 88vw)",
  color: "#f4d98c",
  fontSize: "clamp(30px, 3.6vw, 64px)",
  lineHeight: 1,
  fontWeight: 900,
};

const centerMetaStyle = {
  color: "#cbd5e1",
  fontSize: "clamp(18px, 1.8vw, 30px)",
  fontWeight: 800,
};

const welcomeNoticeStyle = {
  marginTop: 6,
  padding: "14px 18px",
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.08)",
  color: "#dbeafe",
  fontSize: "clamp(18px, 1.5vw, 26px)",
  fontWeight: 800,
};

const sponsorRailStyle = (expanded) => ({
  position: "relative",
  zIndex: 1,
  minHeight: expanded ? 164 : 104,
  borderRadius: 8,
  border: "1px solid rgba(244, 217, 140, 0.3)",
  background: "rgba(15, 23, 42, 0.58)",
  padding: expanded ? 18 : 14,
  display: "grid",
  gridTemplateColumns: "minmax(286px, 0.24fr) minmax(0, 1fr)",
  gap: 14,
  alignItems: "center",
  overflow: "hidden",
});

const sponsorHeadingStyle = {
  minWidth: 0,
  display: "grid",
  gap: 6,
  alignContent: "center",
};

const sponsorTitleStyle = {
  color: "#f4d98c",
  fontSize: 16,
  fontWeight: 900,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const sponsorLevelStyle = (expanded) => ({
  color: "#5eead4",
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: expanded
    ? "clamp(32px, 2.8vw, 46px)"
    : "clamp(25px, 2vw, 34px)",
  lineHeight: 1,
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const sponsorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 12,
};

const sponsorTileStyle = (expanded) => ({
  height: expanded ? 132 : 92,
  borderRadius: 8,
  background: "#ffffff",
  padding: expanded ? 16 : 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const sponsorImageStyle = {
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
};

const sponsorEmptyStyle = {
  color: "#e2e8f0",
  fontSize: 24,
  fontWeight: 900,
  display: "flex",
  gap: 18,
  alignItems: "baseline",
  minWidth: 0,
};

const bilingualSeparatorStyle = {
  margin: "0 0.35em",
  opacity: 0.58,
};

export default PublicShowTvPage;
