import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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

function PublicShowOverlayPage() {
  const { associationId, showId } = useParams();
  const { t } = useTranslation();
  const [association, setAssociation] = useState(null);
  const [show, setShow] = useState(null);
  const [publicView, setPublicView] = useState(() => getPublicShowView(showId));
  const publicClassIdsKey = (publicView.classIds || []).join("|");
  const liveClass = useMemo(
    () => pickOverlayLiveClass(publicView.liveClasses || []),
    [publicView.liveClasses]
  );
  const liveSummary = buildOverlayLiveSummary(liveClass, t);
  const sponsorLogos = Array.isArray(association?.sponsorLogos)
    ? association.sponsorLogos
    : [];
  const hasSponsorRail = sponsorLogos.length > 0;

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

  return (
    <main style={overlayPageStyle}>
      {hasSponsorRail && (
        <aside style={sponsorRailStyle}>
          <div style={sponsorRailTitleStyle}>
            {t("public.overlay.sponsorRailTitle")}
          </div>
          <div style={sponsorListStyle}>
            {sponsorLogos.map((sponsor) => (
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

function OverlayMetric({ label, value, accent }) {
  return (
    <div style={metricStyle}>
      <div style={metricLabelStyle(accent)}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
    </div>
  );
}

function pickOverlayLiveClass(liveClasses) {
  const classes = Array.isArray(liveClasses) ? liveClasses.filter(Boolean) : [];

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
      ? `${formatOverlayRun(lastScoreRun, t)} · ${lastScoreRun.scoreTotal}`
      : t("public.overlay.noScoreYet"),
  };
}

function formatOverlayRun(run, t) {
  const draw = run?.draw ? `#${run.draw}` : "";
  const rider = run?.rider || t("public.results.riderFallback");
  const horse = run?.horse || "";
  const backNumber = run?.backNumber
    ? `${t("public.results.backNumber")} ${run.backNumber}`
    : "";
  const details = [draw, backNumber].filter(Boolean).join(" · ");

  return [details, rider, horse].filter(Boolean).join(" | ");
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
  minHeight: 86,
  borderRadius: 8,
  background: "rgba(8, 13, 24, 0.88)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  boxShadow: "0 18px 40px rgba(0, 0, 0, 0.32)",
  display: "grid",
  gridTemplateColumns: "minmax(240px, 0.8fr) minmax(420px, 1.8fr) minmax(150px, 0.4fr)",
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
  padding: "8px 10px",
  boxSizing: "border-box",
  display: "grid",
  alignContent: "center",
  gap: 4,
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
  fontSize: "clamp(17px, 1.45vw, 28px)",
  fontWeight: 950,
  lineHeight: 1.08,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
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
