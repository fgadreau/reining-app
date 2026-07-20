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
  const sponsorLogos = Array.isArray(association?.sponsorLogos)
    ? association.sponsorLogos
    : [];
  const sponsorSlides = buildSponsorSlides(sponsorLogos);
  const visibleSponsors =
    sponsorSlides[sponsorSlideIndex % sponsorSlides.length] || [];
  const liveItem = useMemo(
    () => pickTvLiveItem(publicView, selectedArena),
    [publicView, selectedArena]
  );
  const publicClassIdsKey = (publicView?.classIds || []).join("|");
  const displayMode = show?.isTvDisplayPaused
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
  }, [sponsorLogos.length]);

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
    <main style={pageStyle}>
      <div style={backgroundGlowStyle} />
      <header style={headerStyle}>
        <div style={brandStyle}>
          <AssociationLogo association={association} size={74} />
          <div style={{ minWidth: 0 }}>
            <div style={eyebrowStyle}>
              <BilingualText fr="Affichage manège" en="Arena display" />
            </div>
            <div style={showTitleStyle}>{show?.name || association?.name || ""}</div>
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

      {displayMode === "paused" ? (
        <PausePanel association={association} show={show} />
      ) : displayMode === "live" ? (
        <LivePanel liveItem={liveItem} />
      ) : (
        <WelcomePanel association={association} show={show} />
      )}

      <SponsorRail sponsors={visibleSponsors} />
    </main>
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

      <aside style={sideStackStyle}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>
            <BilingualText fr="À venir" en="Up next" />
          </div>
          <ParticipantCard
            labelFr="Prochain"
            labelEn="Next"
            participant={upcoming[0]}
            variant="next"
          />
          <ParticipantCard
            labelFr="2e prochain"
            labelEn="Second next"
            participant={upcoming[1]}
            variant="waiting"
          />
        </div>

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
  return (
    <section style={centerPanelStyle}>
      <div style={centerLogoWrapStyle}>
        <AssociationLogo association={association} size={148} />
      </div>
      <div style={sectionKickerStyle}>
        <BilingualText fr="Bienvenue à" en="Welcome to" />
      </div>
      <h1 style={centerTitleStyle}>{association?.name || show?.name || ""}</h1>
      <h2 style={centerSubtitleStyle}>{show?.name || ""}</h2>
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
  const emptyLabel = compact
    ? { fr: "—", en: "" }
    : { fr: "À confirmer", en: "To confirm" };
  const data = participant || emptyLabel;
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

function SponsorRail({ sponsors }) {
  const hasSponsors = sponsors.length > 0;

  return (
    <footer style={sponsorRailStyle}>
      <div style={sponsorTitleStyle}>
        <BilingualText fr="Commanditaires" en="Sponsors" />
      </div>
      {hasSponsors ? (
        <div style={sponsorGridStyle}>
          {sponsors.map((sponsor) => (
            <div key={sponsor.id} style={sponsorTileStyle}>
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

function buildSponsorSlides(sponsorLogos) {
  const logos = Array.isArray(sponsorLogos) ? sponsorLogos.filter(Boolean) : [];

  if (!logos.length) return [];

  const slides = [];
  for (let index = 0; index < logos.length; index += SPONSORS_PER_SLIDE) {
    slides.push(logos.slice(index, index + SPONSORS_PER_SLIDE));
  }

  return slides;
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
  gridTemplateColumns: "minmax(0, 1.55fr) minmax(340px, 0.72fr)",
  gap: 14,
};

const liveHeroStyle = {
  minWidth: 0,
  borderRadius: 8,
  border: "1px solid rgba(244, 217, 140, 0.34)",
  background: "rgba(15, 23, 42, 0.68)",
  padding: 18,
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

const sideStackStyle = {
  minWidth: 0,
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) minmax(0, 0.96fr)",
  gap: 14,
};

const panelStyle = {
  minHeight: 0,
  borderRadius: 8,
  border: "1px solid rgba(148, 163, 184, 0.34)",
  background: "rgba(15, 23, 42, 0.54)",
  padding: 12,
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) minmax(0, 1fr)",
  gap: 8,
  overflow: "hidden",
};

const lastPanelStyle = {
  ...panelStyle,
  gridTemplateRows: "auto minmax(0, 1fr)",
};

const panelTitleStyle = {
  color: "#f4d98c",
  fontSize: "clamp(15px, 1.05vw, 18px)",
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
    borderRadius: 8,
    border: `1px solid ${accent}`,
    background: isDrag
      ? "rgba(67, 56, 202, 0.42)"
      : "rgba(255, 255, 255, 0.08)",
    padding: compact ? 12 : isPrimaryVariant(variant) ? 18 : 14,
    display: "grid",
    alignContent: "start",
    gap: compact ? 4 : isPrimaryVariant(variant) ? 10 : 6,
    boxShadow: `inset 4px 0 0 ${accent}`,
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

const sponsorRailStyle = {
  position: "relative",
  zIndex: 1,
  minHeight: 104,
  borderRadius: 8,
  border: "1px solid rgba(244, 217, 140, 0.3)",
  background: "rgba(15, 23, 42, 0.58)",
  padding: 14,
  display: "grid",
  gridTemplateColumns: "minmax(286px, 0.24fr) minmax(0, 1fr)",
  gap: 14,
  alignItems: "center",
  overflow: "hidden",
};

const sponsorTitleStyle = {
  color: "#f4d98c",
  fontSize: 18,
  fontWeight: 950,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const sponsorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 12,
};

const sponsorTileStyle = {
  height: 92,
  borderRadius: 8,
  background: "#ffffff",
  padding: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

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
