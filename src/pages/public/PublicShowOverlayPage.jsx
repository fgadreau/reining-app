import React, { useEffect, useMemo, useRef, useState } from "react";
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
const OVERLAY_DEMO_QUERY_PARAM = "demo";
const DEMO_OVERLAY_CLASS_ID = "overlay-demo-open-derby";

function PublicShowOverlayPage() {
  const { associationId, showId } = useParams();
  const location = useLocation();
  const { t } = useTranslation();
  const [association, setAssociation] = useState(null);
  const [show, setShow] = useState(null);
  const [publicView, setPublicView] = useState(() => getPublicShowView(showId));
  const [sponsorSlideIndex, setSponsorSlideIndex] = useState(0);
  const selectedArena = useMemo(
    () => getOverlayArenaFromSearch(location.search),
    [location.search]
  );
  const isDemoMode = useMemo(
    () => isOverlayDemoMode(location.search),
    [location.search]
  );
  const demoOverlay = useMemo(
    () => (isDemoMode ? buildOverlayDemoData() : null),
    [isDemoMode]
  );
  const overlayAssociation = demoOverlay?.association || association;
  const overlayShow = demoOverlay?.show || show;
  const overlayPublicView = demoOverlay?.publicView || publicView;
  const publicClassIdsKey = (overlayPublicView.classIds || []).join("|");
  const liveClass = useMemo(
    () => pickOverlayLiveClass(overlayPublicView.liveClasses || [], selectedArena),
    [overlayPublicView.liveClasses, selectedArena]
  );
  const liveSummary = buildOverlayLiveSummary(liveClass, t);
  const sponsorLogos = Array.isArray(overlayAssociation?.sponsorLogos)
    ? overlayAssociation.sponsorLogos
    : [];
  const hasSponsorRail = sponsorLogos.length > 0;
  const sponsorSlides = buildSponsorSlides(sponsorLogos);
  const visibleSponsorLogos =
    sponsorSlides[sponsorSlideIndex % sponsorSlides.length] || [];

  useEffect(() => {
    if (isDemoMode) return undefined;

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
  }, [associationId, showId, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) return undefined;

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
  }, [showId, publicClassIdsKey, isDemoMode]);

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
      {isDemoMode && (
        <div style={demoBadgeStyle}>{t("public.overlay.demoBadge")}</div>
      )}

      {hasSponsorRail && (
        <aside style={sponsorRailStyle}>
          <div style={sponsorRailTitleStyle}>
            {t("public.overlay.sponsorRailTitle")}
          </div>
          <div key={sponsorSlideIndex} style={sponsorListStyle}>
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
        <div style={bottomBarAccentStyle} />
        <div style={brandBlockStyle}>
          <AssociationLogo association={overlayAssociation} size={58} />
          <div style={brandTextStyle}>
            <div style={eyebrowStyle}>
              {overlayShow?.name || t("common.show")}
            </div>
            <OverlayScrollingText style={classTitleStyle}>
              {liveClass
                ? `${liveClass.className}${
                    liveClass.classCode ? ` (${liveClass.classCode})` : ""
                  }`
                : t("public.overlay.waitingForLive")}
            </OverlayScrollingText>
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
          <OverlayScrollingText style={metricPrimaryStyle}>
            {value.primary}
          </OverlayScrollingText>
          {(value.secondary || value.score) && (
            <div style={metricSecondaryRowStyle}>
              {value.secondary && (
                <OverlayScrollingText style={metricSecondaryStyle}>
                  {value.secondary}
                </OverlayScrollingText>
              )}
              {value.score && <span style={metricScoreStyle}>{value.score}</span>}
            </div>
          )}
        </div>
      ) : (
        <OverlayScrollingText style={metricFallbackValueStyle}>
          {value}
        </OverlayScrollingText>
      )}
    </div>
  );
}

function OverlayScrollingText({ children, style, scrollPadding = 34 }) {
  const text = children == null ? "" : String(children);
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    const measure = () => {
      const outer = outerRef.current;
      const inner = innerRef.current;

      if (!outer || !inner) {
        setScrollDistance(0);
        return;
      }

      const overflow = inner.scrollWidth - outer.clientWidth;
      setScrollDistance(overflow > 2 ? Math.ceil(overflow + scrollPadding) : 0);
    };

    measure();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);

    if (resizeObserver && outerRef.current) {
      resizeObserver.observe(outerRef.current);
    }

    const animationFrame = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", measure);
    };
  }, [text, scrollPadding]);

  const durationSeconds = Math.min(Math.max(scrollDistance / 18, 9), 22);
  const innerStyle =
    scrollDistance > 0
      ? {
          display: "inline-block",
          minWidth: "max-content",
          paddingRight: scrollPadding,
          "--showscore-marquee-distance": `${scrollDistance}px`,
          animation: `showscore-overlay-marquee ${durationSeconds}s ease-in-out infinite alternate`,
        }
      : {
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        };

  return (
    <div
      ref={outerRef}
      style={{
        ...style,
        overflow: "hidden",
        textOverflow: "clip",
      }}
    >
      <span ref={innerRef} style={innerStyle}>
        {text}
      </span>
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

function isOverlayDemoMode(search) {
  try {
    const value = new URLSearchParams(search || "").get(OVERLAY_DEMO_QUERY_PARAM);

    return value === "1" || value === "true";
  } catch (error) {
    return false;
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
  const owner = run?.owner || "";
  const backNumber = run?.backNumber
    ? `${t("public.results.backNumber")} ${run.backNumber}`
    : "";

  return {
    meta: [draw, backNumber].filter(Boolean).join(" · "),
    primary: rider,
    secondary: [horse, owner].filter(Boolean).join(" · "),
    score: options.score == null ? "" : String(options.score).trim(),
  };
}

function buildOverlayDemoData() {
  const logoDataUrl = buildOverlayDemoLogoDataUrl("SRC", "#1a1712", "#e6c47a");
  const sponsorLogos = [
    {
      id: "demo-overlay-sponsor-saddlery",
      name: "Sterling Ranch Saddlery",
      logoDataUrl: buildOverlayDemoLogoDataUrl("SRS", "#2b2117", "#f2d18d"),
    },
    {
      id: "demo-overlay-sponsor-nutrition",
      name: "Crown Feed Co.",
      logoDataUrl: buildOverlayDemoLogoDataUrl("CFC", "#11352d", "#d8f3dc"),
    },
    {
      id: "demo-overlay-sponsor-trailers",
      name: "Northline Trailers",
      logoDataUrl: buildOverlayDemoLogoDataUrl("NT", "#14213d", "#f7d794"),
    },
    {
      id: "demo-overlay-sponsor-vet",
      name: "Elite Equine Vet",
      logoDataUrl: buildOverlayDemoLogoDataUrl("EEV", "#3a1d2b", "#ffe3ec"),
    },
  ];

  return {
    association: {
      id: "demo-overlay-association",
      name: "ShowScore Reining Club",
      shortName: "SRC",
      logoDataUrl,
      sponsorLogos,
    },
    show: {
      id: "demo-overlay-show",
      name: "Royal Reining Classic 2026",
      status: "active",
    },
    publicView: {
      classIds: [DEMO_OVERLAY_CLASS_ID],
      liveClasses: [
        {
          id: DEMO_OVERLAY_CLASS_ID,
          classId: DEMO_OVERLAY_CLASS_ID,
          className: "Open Derby Level 4",
          classCode: "OD-L4",
          arena: "Main Coliseum",
          publicationStatus: PUBLICATION_STATUSES.LIVE_SCORING,
          activeRun: {
            id: "demo-overlay-run-12",
            draw: 12,
            backNumber: "214",
            rider: "Camille Gauthier",
            horse: "Gunna Shine Tonight",
            owner: "Ecurie Beaulieu",
          },
          nextRun: {
            id: "demo-overlay-run-13",
            draw: 13,
            backNumber: "305",
            rider: "Nicolas Tremblay",
            horse: "Custom Platinum Star",
            owner: "Ferme Tremblay Performance",
          },
          secondNextRun: {
            id: "demo-overlay-run-14",
            draw: 14,
            backNumber: "117",
            rider: "Amelie Fortin",
            horse: "Whizkey In The Dark",
            owner: "Ranch des Erables",
          },
          latestScore: {
            id: "demo-overlay-run-11",
            draw: 11,
            backNumber: "188",
            rider: "Marc-Antoine Roy",
            horse: "Platinum Whiz",
            owner: "Les Ecuries Roy",
            scoreTotal: "72.5",
          },
          lastPassedRuns: [
            {
              id: "demo-overlay-run-11",
              draw: 11,
              backNumber: "188",
              rider: "Marc-Antoine Roy",
              horse: "Platinum Whiz",
              owner: "Les Ecuries Roy",
              scoreTotal: "72.5",
            },
          ],
        },
      ],
    },
  };
}

function buildOverlayDemoLogoDataUrl(label, background, foreground) {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220">',
    `<rect width="360" height="220" rx="28" fill="${background}"/>`,
    '<rect x="22" y="22" width="316" height="176" rx="22" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="4"/>',
    `<text x="180" y="124" text-anchor="middle" font-family="Georgia, serif" font-size="64" font-weight="700" fill="${foreground}">${label}</text>`,
    '<path d="M92 153c52 30 124 30 176 0" fill="none" stroke="rgba(255,255,255,0.34)" stroke-width="8" stroke-linecap="round"/>',
    '</svg>',
  ].join("");

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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

const demoBadgeStyle = {
  position: "absolute",
  top: 28,
  left: 32,
  padding: "7px 12px",
  borderRadius: 8,
  background: "rgba(22, 18, 12, 0.84)",
  border: "1px solid rgba(230, 196, 122, 0.62)",
  color: "#f6e7bf",
  boxShadow: "0 14px 34px rgba(0, 0, 0, 0.34)",
  fontSize: 13,
  fontWeight: 900,
  textTransform: "uppercase",
};

const sponsorRailStyle = {
  position: "absolute",
  top: 28,
  right: 32,
  bottom: 158,
  width: "clamp(150px, 11vw, 228px)",
  borderRadius: 8,
  background:
    "linear-gradient(180deg, rgba(25, 20, 13, 0.94), rgba(10, 12, 16, 0.88))",
  border: "1px solid rgba(230, 196, 122, 0.44)",
  boxShadow: "0 24px 54px rgba(0, 0, 0, 0.38)",
  padding: 14,
  boxSizing: "border-box",
  display: "grid",
  gridTemplateRows: "auto 1fr",
  gap: 12,
  backdropFilter: "blur(10px)",
};

const sponsorRailTitleStyle = {
  color: "#f6e7bf",
  fontSize: 14,
  fontWeight: 900,
  textAlign: "center",
  textTransform: "uppercase",
  borderBottom: "1px solid rgba(230, 196, 122, 0.32)",
  paddingBottom: 10,
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
  background:
    "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(242,238,229,0.94))",
  border: "1px solid rgba(230, 196, 122, 0.28)",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 10,
};

const sponsorImageStyle = {
  maxWidth: "100%",
  maxHeight: "clamp(44px, 5vh, 84px)",
  objectFit: "contain",
};

const bottomBarStyle = (hasSponsorRail) => ({
  position: "absolute",
  left: 32,
  right: hasSponsorRail ? "calc(clamp(150px, 11vw, 228px) + 72px)" : 32,
  bottom: 28,
  minHeight: 126,
  borderRadius: 8,
  background:
    "linear-gradient(135deg, rgba(22, 18, 12, 0.95), rgba(42, 34, 23, 0.92) 48%, rgba(9, 13, 18, 0.92))",
  border: "1px solid rgba(230, 196, 122, 0.48)",
  boxShadow: "0 26px 64px rgba(0, 0, 0, 0.42)",
  display: "grid",
  gridTemplateColumns:
    "minmax(360px, 0.95fr) minmax(620px, 2.15fr) minmax(112px, 0.2fr)",
  alignItems: "stretch",
  gap: 14,
  padding: 14,
  boxSizing: "border-box",
  overflow: "hidden",
  backdropFilter: "blur(10px)",
});

const bottomBarAccentStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 3,
  background:
    "linear-gradient(90deg, rgba(230,196,122,0), rgba(230,196,122,0.92), rgba(132,217,162,0.68), rgba(230,196,122,0))",
};

const brandBlockStyle = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 14,
  paddingLeft: 4,
  position: "relative",
};

const brandTextStyle = {
  minWidth: 0,
};

const eyebrowStyle = {
  color: "#f6e7bf",
  fontWeight: 850,
  fontSize: 14,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const classTitleStyle = {
  marginTop: 5,
  fontSize: 28,
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
  gap: 12,
};

const metricStyle = {
  minWidth: 0,
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.1)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
  padding: "10px 12px 11px",
  boxSizing: "border-box",
  display: "grid",
  alignContent: "center",
  gap: 7,
};

const metricLabelStyle = (accent) => ({
  color:
    accent === "green" ? "#84d9a2" : accent === "amber" ? "#f4c76c" : "#9cc8ff",
  fontWeight: 900,
  fontSize: 13,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});

const metricValueStyle = {
  minWidth: 0,
  display: "grid",
  gap: 2,
};

const metricFallbackValueStyle = {
  minWidth: 0,
  fontSize: 22,
  fontWeight: 950,
  lineHeight: 1.1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricMetaStyle = {
  color: "#d7d0c2",
  fontSize: 13,
  fontWeight: 850,
  lineHeight: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricPrimaryStyle = {
  color: "#fff",
  fontSize: 26,
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
  color: "#e7e0d2",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.05,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricScoreStyle = {
  flex: "0 0 auto",
  color: "#1f1609",
  background: "linear-gradient(135deg, #f6e7bf, #d6a84f)",
  borderRadius: 6,
  padding: "2px 8px",
  fontSize: 14,
  fontWeight: 950,
  lineHeight: 1.2,
};

const poweredBlockStyle = {
  justifySelf: "end",
  alignSelf: "center",
  textAlign: "right",
  color: "#d7d0c2",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.15,
  display: "grid",
};

export default PublicShowOverlayPage;
