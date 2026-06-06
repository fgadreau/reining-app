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
import { PUBLICATION_STATUSES } from "../../features/publication/publicationRepository";
import { useTranslation } from "../../features/i18n/I18nProvider";

const SPONSOR_LOGOS_PER_SLIDE = 4;
const SPONSOR_SLIDE_INTERVAL_MS = 8000;

function PublicShowOverlayPage() {
  const { associationId, showId } = useParams();
  const location = useLocation();
  const { t } = useTranslation();
  const [association, setAssociation] = useState(null);
  const [show, setShow] = useState(null);
  const [publicView, setPublicView] = useState(() => getPublicShowView(showId));
  const [sponsorSlideIndex, setSponsorSlideIndex] = useState(0);
  const publicClassIdsKey = (publicView.classIds || []).join("|");
  const selectedArena = useMemo(
    () => getOverlayArenaFromSearch(location.search),
    [location.search]
  );
  const liveClass = useMemo(
    () => pickOverlayLiveClass(publicView.liveClasses || [], selectedArena),
    [publicView.liveClasses, selectedArena]
  );
  const liveSummary = buildOverlayLiveSummary(liveClass, t);
  const sponsorLogos = Array.isArray(association?.sponsorLogos)
    ? association.sponsorLogos
    : [];
  const hasSponsorRail = sponsorLogos.length > 0;
  const sponsorSlides = buildSponsorSlides(sponsorLogos);
  const visibleSponsorLogos =
    sponsorSlides[sponsorSlideIndex % sponsorSlides.length] || [];

  useEffect(() => {
    let isMounted = true;

    async function loadOverlay() {
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

    loadOverlay();

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

        if (!isMounted) return;
        setPublicView(nextPublicView);
      }, 200);
    };

    const unsubscribe = subscribePublicShowViewRepository(
      showId,
      publicClassIdsKey ? publicClassIdsKey.split("|") : [],
      refreshPublicView
    );

    return () => {
      isMounted = false;
      window.clearTimeout(refreshTimeout);
      unsubscribe();
    };
  }, [showId, publicClassIdsKey]);

  useEffect(() => {
    setSponsorSlideIndex(0);
  }, [sponsorLogos.length]);

  useEffect(() => {
    if (sponsorSlides.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSponsorSlideIndex(
        (currentIndex) => (currentIndex + 1) % sponsorSlides.length
      );
    }, SPONSOR_SLIDE_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [sponsorSlides.length]);

  return (
    <main style={overlayPageStyle}>
      {hasSponsorRail && (
        <aside style={sponsorRailStyle}>
          <div style={sponsorRailTitleStyle}>
            {t("public.overlay.sponsorRailTitle")}
          </div>
          <div
            key={sponsorSlideIndex}
            style={{
              ...sponsorListStyle,
              animation: "showscore-sponsor-fade 700ms ease both",
            }}
          >
            {visibleSponsorLogos.map((sponsor) => (
              <div key={sponsor.id} style={sponsorTileStyle}>
                <img
                  src={sponsor.logoDataUrl}
                  alt={sponsor.name || t("public.overlay.sponsorLogo")}
                  style={sponsorImageStyle}
                />
              </div>
            ))}
          </div>
        </aside>
      )}

      <section style={bottomBarStyle(hasSponsorRail)}>
        <div style={brandBlockStyle}>
          <AssociationLogo association={association} size={54} />
          <div style={brandTextStyle}>
            <div style={eyebrowStyle}>{show?.name || t("common.show")}</div>
            <div style={classTitleStyle}>
              {liveClass
                ? `${liveClass.className}${
                    liveClass.classCode ? ` (${liveClass.classCode})` : ""
                  }`
                : t("public.overlay.waitingForLive")}
            </div>
          </div>
        </div>

        <div style={liveCellsStyle}>
          <OverlayMetric
            label={t("public.results.onCourse")}
            value={liveSummary.active}
            accent="green"
          />
          <OverlayMetric
            label={t("public.results.statusWaiting")}
            value={liveSummary.waiting}
            accent="amber"
          />
          <OverlayMetric
            label={t("public.overlay.lastScore")}
            value={liveSummary.lastScore}
            accent="blue"
          />
        </div>

        <div style={poweredBlockStyle}>
          <span>{t("public.overlay.poweredBy")}</span>
          <strong>ShowScore.app</strong>
        </div>
      </section>
    </main>
  );
}

function buildSponsorSlides(sponsorLogos) {
  const logos = Array.isArray(sponsorLogos) ? sponsorLogos.filter(Boolean) : [];

  if (!logos.length) {
    return [[]];
  }

  const slides = [];

  for (let index = 0; index < logos.length; index += SPONSOR_LOGOS_PER_SLIDE) {
    slides.push(logos.slice(index, index + SPONSOR_LOGOS_PER_SLIDE));
  }

  return slides;
}

function OverlayMetric({ label, value, accent }) {
  const hasStructuredValue = value && typeof value === "object";

  return (
    <div style={metricStyle}>
      <div style={metricLabelStyle(accent)}>{label}</div>
      {hasStructuredValue ? (
        <div style={metricValueStyle}>
          {value.meta && <div style={metricMetaStyle}>{value.meta}</div>}
          <div style={metricPrimaryStyle}>{value.primary}</div>
          {(value.secondary || value.score) && (
            <div style={metricSecondaryRowStyle}>
              {value.secondary && (
                <span style={metricSecondaryStyle}>{value.secondary}</span>
              )}
              {value.score && <span style={metricScoreStyle}>{value.score}</span>}
            </div>
          )}
        </div>
      ) : (
        <div style={metricFallbackValueStyle}>{value}</div>
      )}
    </div>
  );
}

function normalizeArenaName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getOverlayArenaFromSearch(search) {
  try {
    return normalizeArenaName(new URLSearchParams(search || "").get("arena"));
  } catch (error) {
    return "";
  }
}

function filterLiveClassesByArena(liveClasses, arena) {
  const classes = Array.isArray(liveClasses) ? liveClasses.filter(Boolean) : [];
  const selectedArena = normalizeArenaName(arena).toLowerCase();

  if (!selectedArena) return classes;

  return classes.filter(
    (classView) =>
      normalizeArenaName(classView?.arena).toLowerCase() === selectedArena
  );
}

function pickOverlayLiveClass(liveClasses, arena = "") {
  const classes = filterLiveClassesByArena(liveClasses, arena);

  return (
    classes.find((classView) => classView.activeRun) ||
    classes.find((classView) => classView.nextRun) ||
    classes.find(
      (classView) =>
        classView.publicationStatus !== PUBLICATION_STATUSES.LIVE_FINISHED
    ) ||
    classes[0] ||
    null
  );
}

function buildOverlayLiveSummary(classView, t) {
  if (!classView) {
    return {
      active: t("public.overlay.noActiveRun"),
      waiting: t("public.overlay.noWaitingRun"),
      lastScore: t("public.overlay.noScoreYet"),
    };
  }

  const activeRun = classView.dragBreak?.isActive
    ? null
    : classView.activeRun || null;
  const waitingRun =
    classView.dragBreak?.nextRun ||
    classView.nextRun ||
    classView.secondNextRun ||
    null;
  const lastScoreRun =
    classView.latestScore ||
    (classView.lastPassedRuns || []).find((run) =>
      String(run?.scoreTotal || "").trim()
    );

  return {
    active: activeRun
      ? formatOverlayRun(activeRun, t)
      : classView.dragBreak?.isActive
        ? t("public.results.drag")
        : t("public.overlay.noActiveRun"),
    waiting: waitingRun ? formatOverlayRun(waitingRun, t) : t("public.overlay.noWaitingRun"),
    lastScore: lastScoreRun
      ? formatOverlayRun(lastScoreRun, t, { score: lastScoreRun.scoreTotal })
      : t("public.overlay.noScoreYet"),
  };
}

function formatOverlayRun(run, t, options = {}) {
  const draw = run?.draw ? `#${run.draw}` : "";
  const rider = run?.rider || t("public.results.riderFallback");
  const horse = run?.horse || "";
  const backNumber = run?.backNumber
    ? `${t("public.results.backNumber")} ${run.backNumber}`
    : "";

  return {
    meta: [draw, backNumber].filter(Boolean).join(" · "),
    primary: rider,
    secondary: horse,
    score: options.score == null ? "" : String(options.score).trim(),
  };
}

const overlayPageStyle = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
  background: "transparent",
  color: "#fff",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  pointerEvents: "none",
};

const sponsorRailStyle = {
  position: "absolute",
  top: 24,
  right: 24,
  bottom: 134,
  width: "clamp(132px, 11vw, 220px)",
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.9)",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  boxShadow: "0 18px 40px rgba(0, 0, 0, 0.28)",
  padding: 12,
  boxSizing: "border-box",
  display: "grid",
  gridTemplateRows: "auto 1fr",
  gap: 10,
};

const sponsorRailTitleStyle = {
  color: "#101827",
  fontSize: "clamp(13px, 1vw, 18px)",
  fontWeight: 900,
  textAlign: "center",
  textTransform: "uppercase",
  letterSpacing: 0,
};

const sponsorListStyle = {
  minHeight: 0,
  display: "grid",
  gap: 10,
  alignContent: "start",
};

const sponsorTileStyle = {
  minHeight: "clamp(58px, 6vh, 104px)",
  borderRadius: 8,
  background: "#fff",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 8,
};

const sponsorImageStyle = {
  maxWidth: "100%",
  maxHeight: "clamp(44px, 5vh, 84px)",
  objectFit: "contain",
};

const bottomBarStyle = (hasSponsorRail) => ({
  position: "absolute",
  left: 24,
  right: hasSponsorRail ? "calc(clamp(132px, 11vw, 220px) + 48px)" : 24,
  bottom: 24,
  minHeight: 108,
  borderRadius: 8,
  background: "rgba(8, 13, 24, 0.88)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  boxShadow: "0 18px 40px rgba(0, 0, 0, 0.32)",
  display: "grid",
  gridTemplateColumns:
    "minmax(230px, 0.65fr) minmax(540px, 2.35fr) minmax(118px, 0.25fr)",
  alignItems: "stretch",
  gap: 12,
  padding: 12,
  boxSizing: "border-box",
});

const brandBlockStyle = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const brandTextStyle = {
  minWidth: 0,
};

const eyebrowStyle = {
  color: "#cbd5e1",
  fontWeight: 850,
  fontSize: "clamp(12px, 0.95vw, 18px)",
  textTransform: "uppercase",
  letterSpacing: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const classTitleStyle = {
  marginTop: 3,
  fontSize: "clamp(18px, 1.7vw, 32px)",
  fontWeight: 950,
  lineHeight: 1.05,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const liveCellsStyle = {
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const metricStyle = {
  minWidth: 0,
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  padding: "8px 10px 9px",
  boxSizing: "border-box",
  display: "grid",
  alignContent: "center",
  gap: 5,
};

const metricLabelStyle = (accent) => ({
  color:
    accent === "green" ? "#86efac" : accent === "amber" ? "#fcd34d" : "#93c5fd",
  fontWeight: 900,
  fontSize: "clamp(12px, 0.95vw, 18px)",
  textTransform: "uppercase",
  letterSpacing: 0,
  whiteSpace: "nowrap",
});

const metricValueStyle = {
  minWidth: 0,
  display: "grid",
  gap: 2,
};

const metricFallbackValueStyle = {
  minWidth: 0,
  fontSize: "clamp(16px, 1.25vw, 24px)",
  fontWeight: 950,
  lineHeight: 1.1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricMetaStyle = {
  color: "#cbd5e1",
  fontSize: "clamp(11px, 0.82vw, 15px)",
  fontWeight: 850,
  lineHeight: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricPrimaryStyle = {
  color: "#fff",
  fontSize: "clamp(18px, 1.45vw, 27px)",
  fontWeight: 950,
  lineHeight: 1.02,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricSecondaryRowStyle = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const metricSecondaryStyle = {
  flex: "1 1 auto",
  minWidth: 0,
  color: "#d1d5db",
  fontSize: "clamp(11px, 0.82vw, 15px)",
  fontWeight: 800,
  lineHeight: 1.05,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricScoreStyle = {
  flex: "0 0 auto",
  color: "#101827",
  background: "#93c5fd",
  borderRadius: 6,
  padding: "1px 6px",
  fontSize: "clamp(11px, 0.82vw, 15px)",
  fontWeight: 950,
  lineHeight: 1.2,
};

const poweredBlockStyle = {
  justifySelf: "end",
  alignSelf: "center",
  textAlign: "right",
  color: "#cbd5e1",
  fontSize: "clamp(12px, 0.9vw, 18px)",
  fontWeight: 800,
  lineHeight: 1.15,
  display: "grid",
};

export default PublicShowOverlayPage;
