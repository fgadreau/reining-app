import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import ChampionshipOccurrenceModal from "../../components/ChampionshipOccurrenceModal";
import ChampionshipVerificationRequestPanel from "../../components/ChampionshipVerificationRequestPanel";
import SeoMeta from "../../components/SeoMeta";
import ShareButton from "../../components/ShareButton";
import { getAssociationWebsiteHref } from "../../features/associations/associationProfile";
import { getPublicAssociationRepository } from "../../features/publication/publicViewRepository";
import { getPublicChampionshipSeasonRepository } from "../../features/championship/championshipRepository";
import {
  buildChampionshipFunFacts,
  getChampionshipIncludedShows,
} from "../../features/championship/championshipStandings";
import { buildChampionshipPublicSeo } from "../../features/seo/publicSeo";
import { formatChampionshipPoints } from "../../features/championship/championshipPoints";
import { useTranslation } from "../../features/i18n/I18nProvider";
import {
  buildChampionshipPdfFileName,
  generateChampionshipPdf,
} from "../../utils/generateChampionshipPdf";
import {
  publicBadgeStyle,
  publicCardStyle,
  publicColors,
  publicEmptyStateStyle,
  publicEyebrowStyle,
  publicHeroStyle,
  publicMutedTextStyle,
  publicPageStyle,
  publicPrimaryActionStyle,
  publicSecondaryActionStyle,
  publicSubtitleStyle,
  publicTitleStyle,
} from "../../styles/publicStyles";

function PublicAssociationChampionshipPage() {
  const { associationId } = useParams();
  const { t } = useTranslation();
  const isMobileLayout = useChampionshipMobileLayout();
  const [association, setAssociation] = useState(null);
  const [season, setSeason] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openClassId, setOpenClassId] = useState(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);
  const [isVerificationPanelOpen, setIsVerificationPanelOpen] = useState(false);
  const [isFunFactsOpen, setIsFunFactsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const classes = Array.isArray(season?.classes) ? season.classes : [];
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const includedShows = useMemo(
    () => getChampionshipIncludedShows(season),
    [season]
  );
  const funFacts = useMemo(() => buildChampionshipFunFacts(season), [season]);
  const hasFunFacts = hasChampionshipFunFacts(funFacts);
  const filteredClasses = useMemo(
    () => filterChampionshipClasses(classes, normalizedSearchQuery),
    [classes, normalizedSearchQuery]
  );
  const seo = useMemo(
    () => buildChampionshipPublicSeo({ association, season, t }),
    [association, season, t]
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [nextAssociation, nextSeason] = await Promise.all([
        getPublicAssociationRepository(associationId),
        Promise.resolve(getPublicChampionshipSeasonRepository(associationId)),
      ]);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setSeason(nextSeason);
      setOpenClassId(null);
      setSelectedOccurrence(null);
      setIsVerificationPanelOpen(false);
      setIsFunFactsOpen(false);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [associationId]);

  useEffect(() => {
    if (!normalizedSearchQuery) return;

    setSelectedOccurrence(null);
    setOpenClassId(filteredClasses[0]?.id || null);
  }, [filteredClasses, normalizedSearchQuery]);

  const toggleClass = (classId, isOpen) => {
    setSelectedOccurrence(null);
    setOpenClassId(isOpen ? null : classId);
  };

  const openOccurrence = ({ classEntry, event, teamKey = "" }) => {
    const fullClassEntry =
      classes.find((item) => item.id === classEntry?.id) || classEntry;
    const fullEvent =
      (Array.isArray(fullClassEntry?.events) ? fullClassEntry.events : []).find(
        (item) => item.eventKey === event?.eventKey
      ) || event;

    setSelectedOccurrence({
      classEntry: fullClassEntry,
      event: fullEvent,
      teamKey,
    });
  };

  const downloadChampionshipPdf = () => {
    if (!season) return;

    try {
      const generatedAt = new Date();
      const pdf = generateChampionshipPdf({
        associationName: association?.name || association?.shortName || "",
        associationAbbreviation: association?.shortName || "ASSOC",
        associationLogoDataUrl: association?.logoDataUrl || null,
        season,
        generatedAt,
      });
      const fileName = buildChampionshipPdfFileName({
        associationAbbreviation: association?.shortName || "ASSOC",
        seasonTitle: season?.title || t("championship.public.title"),
        year: season?.year || "",
        generatedAt,
      });

      pdf.save(fileName);
    } catch (error) {
      alert(error?.message || t("championship.public.downloadPdfFailed"));
    }
  };

  return (
    <div style={publicPageStyle}>
      <SeoMeta
        title={seo.title}
        description={seo.description}
        canonicalPath={`/public/associations/${associationId}/championnat`}
        imageUrl={association?.logoDataUrl}
      />

      <div style={navRowStyle}>
        <Link to={`/public/associations/${associationId}`} style={secondaryLinkStyle}>
          {t("championship.public.back")}
        </Link>
      </div>

      <section style={isMobileLayout ? mobileHeroStyle : heroStyle}>
        <div style={heroBrandStyle}>
          <AssociationLogo association={association} size={isMobileLayout ? 44 : 58} />
          <div>
            <div style={eyebrowStyle}>{t("championship.public.eyebrow")}</div>
            <h1 style={isMobileLayout ? mobileTitleStyle : titleStyle}>
              {season?.title || t("championship.public.title")}
            </h1>
            {season?.status === "published" && !isMobileLayout && (
              <div style={provisionalHeaderStyle}>
                {t("championship.status.published")}
              </div>
            )}
            <div style={subtitleStyle}>
              {association?.shortName || association?.name || t("common.association")}
              {season?.year ? ` · ${season.year}` : ""}
            </div>
          </div>
        </div>
        <div style={isMobileLayout ? mobileHeroActionsStyle : heroActionsStyle}>
          {season?.status && (
            <span style={publicBadgeStyle(season.status === "final" ? "success" : "info")}>
              {season.status === "final"
                ? t("championship.status.final")
                : t("championship.status.published")}
            </span>
          )}
          {classes.length > 0 && (
            <>
              {hasFunFacts && (
                <button
                  type="button"
                  onClick={() => setIsFunFactsOpen(true)}
                  style={quietActionButtonStyle}
                >
                  {t("championship.public.funFactsOpen")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsVerificationPanelOpen(true)}
                style={primaryActionButtonStyle}
              >
                {t("championship.verification.open")}
              </button>
              <button
                type="button"
                onClick={downloadChampionshipPdf}
                style={secondaryButtonStyle}
              >
                {t("championship.public.downloadPdf")}
              </button>
            </>
          )}
          {getAssociationWebsiteHref(association) && (
            <a
              href={getAssociationWebsiteHref(association)}
              target="_blank"
              rel="noreferrer"
              style={secondaryLinkStyle}
            >
              {t("common.website")}
            </a>
          )}
          <ShareButton
            url={`/public/associations/${associationId}/championnat`}
            title={seo.title}
            text={seo.description}
          />
        </div>
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>{t("championship.public.loading")}</div>
      ) : !season ? (
        <div style={emptyStateStyle}>{t("championship.public.empty")}</div>
      ) : (
        <>
          <section style={isMobileLayout ? mobileSummaryStyle : summaryStyle}>
            <SummaryItem
              label={t("championship.public.classes")}
              value={season.classCount || 0}
              compact={isMobileLayout}
            />
            <SummaryItem
              label={t("championship.public.events")}
              value={season.eventCount || 0}
              compact={isMobileLayout}
            />
            <SummaryItem
              label={t("championship.public.shows")}
              value={season.showCount ?? includedShows.length}
              compact={isMobileLayout}
            />
            <SummaryItem
              label={t("championship.public.teams")}
              value={season.teamCount || 0}
              compact={isMobileLayout}
            />
            <SummaryItem
              label={t("championship.public.updated")}
              value={formatDate(season.updatedAt || season.importedAt)}
              compact={isMobileLayout}
            />
            <SummaryShowsItem
              label={t("championship.public.includedShows")}
              shows={includedShows}
              emptyText={t("championship.public.noIncludedShows")}
              t={t}
            />
          </section>

          <section style={isMobileLayout ? mobileSearchStyle : searchStyle}>
            <label style={searchLabelStyle} htmlFor="championship-search">
              {t("championship.public.searchLabel")}
            </label>
            <div style={isMobileLayout ? mobileSearchRowStyle : searchRowStyle}>
              <input
                id="championship-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("championship.public.searchPlaceholder")}
                style={searchInputStyle}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={clearSearchButtonStyle}
                >
                  {t("championship.public.clearSearch")}
                </button>
              )}
            </div>
          </section>

          {filteredClasses.length === 0 ? (
            <div style={emptyStateStyle}>{t("championship.public.noSearchResults")}</div>
          ) : (
          <div style={classListStyle}>
            {filteredClasses.map((classEntry) => {
              const isOpen = openClassId === classEntry.id;

              return (
                <article key={classEntry.id} style={classCardStyle}>
                  <button
                    type="button"
                    onClick={() => toggleClass(classEntry.id, isOpen)}
                    style={
                      isMobileLayout
                        ? mobileClassHeaderButtonStyle
                        : classHeaderButtonStyle
                    }
                  >
                    <span>
                      <span
                        style={isMobileLayout ? mobileClassTitleStyle : classTitleStyle}
                      >
                        {classEntry.name}
                      </span>
                      <span style={classMetaStyle}>
                        {t("championship.public.classMeta", {
                          events: classEntry.events.length,
                          teams: classEntry.teams.length,
                        })}
                      </span>
                    </span>
                    <span style={isMobileLayout ? mobileViewToggleStyle : viewToggleStyle}>
                      {isOpen ? t("public.results.hide") : t("public.results.view")}
                    </span>
                  </button>

                  {isOpen && (
                    <ChampionshipClassTable
                      classEntry={classEntry}
                      isMobileLayout={isMobileLayout}
                      onSelectOccurrence={openOccurrence}
                      t={t}
                    />
                  )}
                </article>
              );
            })}
          </div>
          )}
        </>
      )}

      <ChampionshipOccurrenceModal
        occurrence={selectedOccurrence}
        onClose={() => setSelectedOccurrence(null)}
        t={t}
      />
      <ChampionshipFunFactsModal
        isOpen={isFunFactsOpen}
        onClose={() => setIsFunFactsOpen(false)}
        funFacts={funFacts}
        t={t}
      />
      <ChampionshipVerificationRequestPanel
        isOpen={isVerificationPanelOpen}
        onClose={() => setIsVerificationPanelOpen(false)}
        associationId={associationId}
        association={association}
        season={season}
        classes={classes}
        championshipUrl={getCurrentPageUrl()}
        t={t}
      />
    </div>
  );
}

function ChampionshipClassTable({
  classEntry,
  isMobileLayout,
  onSelectOccurrence,
  t,
}) {
  if (isMobileLayout) {
    return (
      <ChampionshipClassMobileStandings
        classEntry={classEntry}
        onSelectOccurrence={onSelectOccurrence}
        t={t}
      />
    );
  }

  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={stickyThStyle}>{t("championship.public.rank")}</th>
            <th style={stickyThStyle}>{t("public.results.rider")}</th>
            <th style={stickyThStyle}>{t("public.results.horse")}</th>
            <th style={thStyle}>{t("championship.public.totalPoints")}</th>
            {classEntry.events.map((event) => (
              <th key={event.eventKey} style={eventThStyle}>
                <button
                  type="button"
                  onClick={() => onSelectOccurrence({ classEntry, event })}
                  style={eventHeaderButtonStyle}
                >
                  {event.label}
                </button>
                <div style={smallHeaderStyle}>Pts</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {classEntry.teams.map((team) => {
            const detailsByEvent = new Map(
              team.details.map((detail) => [detail.eventKey, detail])
            );

            return (
              <tr key={team.teamKey}>
                <td style={tdStyle}>#{team.rank}</td>
                <td style={nameTdStyle}>{team.rider}</td>
                <td style={nameTdStyle}>{team.horse}</td>
                <td style={strongTdStyle}>
                  {formatChampionshipPoints(team.totalPoints)}
                </td>
                {classEntry.events.map((event) => {
                  const detail = detailsByEvent.get(event.eventKey);

                  return (
                    <td key={`${team.teamKey}-${event.eventKey}`} style={tdStyle}>
                      <button
                        type="button"
                        onClick={() =>
                          onSelectOccurrence({
                            classEntry,
                            event,
                            teamKey: team.teamKey,
                          })
                        }
                        style={detail ? eventCellButtonStyle : mutedEventCellButtonStyle}
                      >
                        {detail ? (
                          <>
                          <div style={eventCellPointsStyle}>
                            {formatChampionshipPoints(detail.points)}
                          </div>
                          <div style={eventCellMetaStyle}>
                            {t("championship.public.placeScore", {
                              place: detail.placeNum || "-",
                              score: detail.totalScore || "-",
                            })}
                          </div>
                          </>
                        ) : (
                          <span style={mutedCellStyle}>0</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td style={footerTdStyle} colSpan={4}>
              {t("championship.public.eventTotals")}
            </td>
            {classEntry.events.map((event) => (
              <td key={`${event.eventKey}-total`} style={footerTdStyle}>
                <div>{formatChampionshipPoints(event.totalPoints)}</div>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ChampionshipClassMobileStandings({ classEntry, onSelectOccurrence, t }) {
  const eventsByKey = new Map(
    (classEntry.events || []).map((event) => [event.eventKey, event])
  );

  return (
    <div style={mobileStandingsStyle}>
      {classEntry.teams.map((team) => {
        const details = Array.isArray(team.details) ? team.details : [];

        return (
          <article key={team.teamKey} style={mobileTeamCardStyle}>
            <div style={mobileTeamHeaderStyle}>
              <div style={mobileRankStyle}>#{team.rank}</div>
              <div style={mobileTeamIdentityStyle}>
                <div style={mobileRiderStyle}>{team.rider || "-"}</div>
                <div style={mobileHorseStyle}>{team.horse || "-"}</div>
              </div>
            </div>

            <div style={mobileTotalsStyle}>
              <MobileTotal
                label={t("championship.public.totalPoints")}
                value={formatChampionshipPoints(team.totalPoints)}
              />
            </div>

            <div style={mobileOccurrenceHeaderStyle}>
              {t("championship.public.mobileOccurrences")}
            </div>
            {details.length > 0 ? (
              <div style={mobileOccurrenceListStyle}>
                {details.map((detail) => {
                  const event = eventsByKey.get(detail.eventKey) || detail;
                  const detailLabel =
                    detail.eventLabel ||
                    event.label ||
                    detail.showName ||
                    detail.showNum ||
                    "-";

                  return (
                    <button
                      key={`${team.teamKey}-${detail.eventKey}`}
                      type="button"
                      onClick={() =>
                        onSelectOccurrence({
                          classEntry,
                          event,
                          teamKey: team.teamKey,
                        })
                      }
                      style={mobileOccurrenceButtonStyle}
                    >
                      <span style={mobileOccurrenceLabelStyle}>
                        {detailLabel}
                      </span>
                      <span style={mobileOccurrenceValueStyle}>
                        {formatChampionshipPoints(detail.points)} pts
                      </span>
                      <span style={mobileOccurrenceMetaStyle}>
                        {t("championship.public.placeScore", {
                          place: detail.placeNum || "-",
                          score: detail.totalScore || "-",
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={mutedTextStyle}>
                {t("championship.public.mobileNoOccurrences")}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function MobileTotal({ label, value }) {
  return (
    <div style={mobileTotalStyle}>
      <div style={mobileTotalLabelStyle}>{label}</div>
      <div style={mobileTotalValueStyle}>{value}</div>
    </div>
  );
}

function ChampionshipFunFactsModal({ isOpen, onClose, funFacts, t }) {
  if (!isOpen) return null;

  const facts = [
    {
      key: "highestReiningScore",
      title: t("championship.public.funFactsHighestReiningScore"),
      entries: funFacts.highestReiningScore || [],
      renderValue: (entry) => formatChampionshipPoints(entry.score),
      renderMeta: (entry) =>
        [entry.className, entry.showLabel].filter(Boolean).join(" · "),
    },
    {
      key: "highestRanchRidingScore",
      title: t("championship.public.funFactsHighestRanchRidingScore"),
      entries: funFacts.highestRanchRidingScore || [],
      renderValue: (entry) => formatChampionshipPoints(entry.score),
      renderMeta: (entry) =>
        [entry.className, entry.showLabel].filter(Boolean).join(" · "),
    },
    {
      key: "topRiderPoints",
      title: t("championship.public.funFactsTopRiderPoints"),
      entries: funFacts.topRiderPoints || [],
      renderValue: (entry) =>
        `${formatChampionshipPoints(entry.totalPoints)} pts`,
      renderName: (entry) => entry.rider || "-",
      renderMeta: () => t("championship.public.funFactsAllClassesAndTeams"),
    },
    {
      key: "topHorsePoints",
      title: t("championship.public.funFactsTopHorsePoints"),
      entries: funFacts.topHorsePoints || [],
      renderValue: (entry) =>
        `${formatChampionshipPoints(entry.totalPoints)} pts`,
      renderName: (entry) => entry.horse || "-",
      renderMeta: () => t("championship.public.funFactsAllClassesAndTeams"),
    },
    {
      key: "topTeamPoints",
      title: t("championship.public.funFactsTopTeamPoints"),
      entries: funFacts.topTeamPoints || [],
      renderValue: (entry) =>
        `${formatChampionshipPoints(entry.totalPoints)} pts`,
      renderMeta: () => t("championship.public.funFactsAllClassesAndTeams"),
    },
    {
      key: "mostPodiums",
      title: t("championship.public.funFactsMostPodiums"),
      entries: funFacts.mostPodiums || [],
      renderValue: (entry) =>
        entry.podiumCount === 1
          ? t("championship.public.funFactsPodiumCountOne")
          : t("championship.public.funFactsPodiumCount", {
              count: entry.podiumCount,
            }),
      renderMeta: () => t("championship.public.funFactsAllClassesAndTeams"),
    },
    {
      key: "bestProgression",
      title: t("championship.public.funFactsBestProgression"),
      entries: funFacts.bestProgression || [],
      renderValue: (entry) =>
        `${formatSignedChampionshipPoints(entry.progressionDelta)} pts`,
      renderMeta: (entry) =>
        t("championship.public.funFactsProgressionMeta", {
          first: formatChampionshipPoints(entry.firstScoreAverage),
          last: formatChampionshipPoints(entry.lastScoreAverage),
        }),
    },
    {
      key: "mostClasses",
      title: t("championship.public.funFactsMostClasses"),
      entries: funFacts.mostClasses || [],
      renderValue: (entry) =>
        entry.classCount === 1
          ? t("championship.public.funFactsClassCountOne")
          : t("championship.public.funFactsClassCount", {
              count: entry.classCount,
            }),
      renderMeta: () => t("championship.public.funFactsActiveMeta"),
    },
  ].filter((fact) => fact.entries.length > 0);

  return (
    <div style={funFactsBackdropStyle} role="presentation" onClick={onClose}>
      <section
        style={funFactsModalStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="championship-fun-facts-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={funFactsHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>{t("championship.public.funFactsEyebrow")}</div>
            <h2 id="championship-fun-facts-title" style={funFactsTitleStyle}>
              {t("championship.public.funFactsTitle")}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={funFactsCloseButtonStyle}>
            {t("championship.public.funFactsClose")}
          </button>
        </div>

        <div style={funFactsListStyle}>
          {facts.map((fact) => (
            <div key={fact.key} style={funFactsRowStyle}>
              <div style={funFactLabelStyle}>{fact.title}</div>
              <div style={funFactEntryListStyle}>
                {fact.entries.map((entry) => (
                  <div
                    key={`${fact.key}-${entry.rider}-${entry.horse}-${fact.renderValue(entry)}-${fact.renderMeta(entry)}`}
                    style={funFactEntryStyle}
                  >
                    <div style={funFactValueStyle}>{fact.renderValue(entry)}</div>
                    <div style={funFactNameStyle}>
                      {fact.renderName
                        ? fact.renderName(entry)
                        : formatFunFactTeam(entry, t)}
                    </div>
                    {fact.renderMeta(entry) && (
                      <div style={funFactMetaStyle}>{fact.renderMeta(entry)}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryItem({ label, value, compact = false }) {
  return (
    <div style={compact ? mobileSummaryItemStyle : summaryItemStyle}>
      <div style={compact ? mobileSummaryValueStyle : summaryValueStyle}>
        {value}
      </div>
      <div style={mutedTextStyle}>{label}</div>
    </div>
  );
}

function useChampionshipMobileLayout() {
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    getChampionshipMobileMediaQuery()?.matches || false
  );

  useEffect(() => {
    const mediaQuery = getChampionshipMobileMediaQuery();

    if (!mediaQuery) {
      setIsMobileLayout(false);
      return undefined;
    }

    const update = () => setIsMobileLayout(mediaQuery.matches);

    update();
    mediaQuery.addEventListener?.("change", update);

    return () => {
      mediaQuery.removeEventListener?.("change", update);
    };
  }, []);

  return isMobileLayout;
}

function getChampionshipMobileMediaQuery() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }

  return window.matchMedia("(max-width: 680px)");
}

function SummaryShowsItem({ label, shows, emptyText, t }) {
  return (
    <div style={summaryShowsItemStyle}>
      <div style={summaryShowsHeaderStyle}>
        <div style={summaryShowsTitleStyle}>{label}</div>
        <div style={mutedTextStyle}>
          {t("championship.public.showCount", { count: shows.length })}
        </div>
      </div>
      {shows.length > 0 ? (
        <div style={showChipListStyle}>
          {shows.map((show) => (
            <span key={show.key} style={showChipStyle}>
              {formatIncludedShowLabel(show)}
              {show.occurrenceCount ? (
                <span style={showChipMetaStyle}>
                  {t("championship.public.eventCount", {
                    count: show.occurrenceCount,
                  })}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      ) : (
        <div style={mutedTextStyle}>{emptyText}</div>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function formatIncludedShowLabel(show) {
  return show.label || show.showName || show.showNum || show.key || "Show";
}

function getCurrentPageUrl() {
  return typeof window === "undefined" ? "" : window.location.href;
}

function hasChampionshipFunFacts(funFacts) {
  return Boolean(
    funFacts &&
      ((funFacts.highestReiningScore || []).length ||
        (funFacts.highestRanchRidingScore || []).length ||
        (funFacts.highestScore || []).length ||
        (funFacts.topRiderPoints || []).length ||
        (funFacts.topHorsePoints || []).length ||
        (funFacts.topTeamPoints || []).length ||
        (funFacts.mostPodiums || []).length ||
        (funFacts.bestProgression || []).length ||
        (funFacts.mostClasses || []).length)
  );
}

function formatSignedChampionshipPoints(value) {
  const number = Number(value);
  const formatted = formatChampionshipPoints(value);

  return number > 0 ? `+${formatted}` : formatted;
}

function formatFunFactTeam(entry, t) {
  const label = [entry.rider, entry.horse]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(` ${t("championship.public.funFactsWithHorse")} `);

  return label || "-";
}

function filterChampionshipClasses(classes, query) {
  if (!query) return classes;

  return classes
    .map((classEntry) => {
      const classMatches = normalizeSearchText(classEntry.name).includes(query);
      const matchingTeams = classEntry.teams.filter((team) =>
        normalizeSearchText(`${team.rider} ${team.horse}`).includes(query)
      );

      if (classMatches) return classEntry;
      if (!matchingTeams.length) return null;

      return {
        ...classEntry,
        teams: matchingTeams,
      };
    })
    .filter(Boolean);
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const navRowStyle = {
  marginBottom: 16,
};

const heroStyle = {
  ...publicHeroStyle,
};

const mobileHeroStyle = {
  ...publicHeroStyle,
  padding: 12,
  gap: 10,
  marginBottom: 10,
};

const heroBrandStyle = {
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  minWidth: 0,
};

const heroActionsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  alignItems: "center",
};

const mobileHeroActionsStyle = {
  ...heroActionsStyle,
  width: "100%",
  justifyContent: "flex-start",
  gap: 6,
};

const eyebrowStyle = {
  ...publicEyebrowStyle,
};

const titleStyle = {
  ...publicTitleStyle,
  fontSize: 30,
};

const mobileTitleStyle = {
  ...publicTitleStyle,
  margin: "2px 0",
  fontSize: 21,
  lineHeight: 1.08,
};

const provisionalHeaderStyle = {
  display: "inline-block",
  margin: "2px 0 6px",
  color: "#92400e",
  background: "#fef3c7",
  border: "1px solid #f59e0b",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 26,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const subtitleStyle = {
  ...publicSubtitleStyle,
};

const mutedTextStyle = {
  ...publicMutedTextStyle,
};

const secondaryLinkStyle = {
  ...publicSecondaryActionStyle,
  maxWidth: "100%",
};

const secondaryButtonStyle = {
  ...publicSecondaryActionStyle,
  maxWidth: "100%",
  font: "inherit",
};

const quietActionButtonStyle = {
  ...publicSecondaryActionStyle,
  maxWidth: "100%",
  font: "inherit",
  background: "#f8fafc",
};

const primaryActionButtonStyle = {
  ...publicPrimaryActionStyle,
  maxWidth: "100%",
  font: "inherit",
};

const emptyStateStyle = {
  ...publicEmptyStateStyle,
  borderStyle: "dashed",
  color: publicColors.muted,
};

const summaryStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  marginBottom: 12,
};

const mobileSummaryStyle = {
  ...summaryStyle,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
  marginBottom: 10,
};

const summaryItemStyle = {
  ...publicCardStyle,
};

const mobileSummaryItemStyle = {
  ...summaryItemStyle,
  padding: 10,
};

const summaryShowsItemStyle = {
  ...summaryItemStyle,
  gridColumn: "1 / -1",
};

const summaryShowsHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 10,
};

const summaryShowsTitleStyle = {
  color: publicColors.text,
  fontWeight: 900,
};

const showChipListStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const showChipStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: `1px solid ${publicColors.border}`,
  borderRadius: 999,
  background: "#f8fafc",
  color: publicColors.text,
  padding: "7px 10px",
  fontSize: 13,
  fontWeight: 850,
};

const showChipMetaStyle = {
  color: publicColors.muted,
  fontSize: 12,
  fontWeight: 750,
};

const searchStyle = {
  ...publicCardStyle,
  marginBottom: 12,
};

const mobileSearchStyle = {
  ...searchStyle,
  padding: 10,
  marginBottom: 10,
};

const searchLabelStyle = {
  display: "block",
  color: publicColors.text,
  fontSize: 14,
  fontWeight: 900,
  marginBottom: 8,
};

const searchRowStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const mobileSearchRowStyle = {
  ...searchRowStyle,
  gap: 6,
};

const searchInputStyle = {
  flex: "1 1 260px",
  minHeight: 42,
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: "9px 10px",
  fontSize: 15,
  color: publicColors.text,
  background: publicColors.surface,
  boxSizing: "border-box",
};

const clearSearchButtonStyle = {
  ...publicSecondaryActionStyle,
  minHeight: 42,
};

const summaryValueStyle = {
  fontSize: 24,
  fontWeight: 900,
  color: publicColors.text,
};

const mobileSummaryValueStyle = {
  ...summaryValueStyle,
  fontSize: 20,
  lineHeight: 1,
};

const funFactsBackdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 940,
  background: "rgba(15, 23, 42, 0.32)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 14,
};

const funFactsModalStyle = {
  width: "min(520px, 100%)",
  maxHeight: "calc(100dvh - 28px)",
  overflow: "auto",
  background: publicColors.surface,
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  boxShadow: "0 22px 70px rgba(15, 23, 42, 0.25)",
  padding: 16,
};

const funFactsHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 10,
};

const funFactsTitleStyle = {
  margin: "2px 0 0",
  color: publicColors.text,
  fontSize: 20,
  lineHeight: 1.2,
};

const funFactsCloseButtonStyle = {
  ...publicSecondaryActionStyle,
  font: "inherit",
  flex: "0 0 auto",
  minHeight: 36,
  padding: "7px 10px",
};

const funFactsListStyle = {
  display: "grid",
  gap: 0,
  borderTop: `1px solid ${publicColors.border}`,
};

const funFactsRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(120px, 0.8fr) minmax(0, 1.2fr)",
  gap: 12,
  padding: "13px 0",
  borderBottom: `1px solid ${publicColors.border}`,
};

const funFactLabelStyle = {
  color: publicColors.muted,
  fontSize: 13,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const funFactEntryListStyle = {
  display: "grid",
  gap: 10,
};

const funFactEntryStyle = {
  minWidth: 0,
};

const funFactValueStyle = {
  color: publicColors.text,
  fontSize: 22,
  fontWeight: 950,
  lineHeight: 1.05,
};

const funFactNameStyle = {
  marginTop: 4,
  color: publicColors.text,
  fontSize: 14,
  fontWeight: 850,
  lineHeight: 1.25,
};

const funFactMetaStyle = {
  marginTop: 2,
  color: publicColors.muted,
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.25,
};

const classListStyle = {
  display: "grid",
  gap: 12,
};

const classCardStyle = {
  ...publicCardStyle,
  padding: 0,
  overflow: "hidden",
};

const classHeaderButtonStyle = {
  width: "100%",
  border: 0,
  background: publicColors.surface,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  cursor: "pointer",
  textAlign: "left",
};

const mobileClassHeaderButtonStyle = {
  ...classHeaderButtonStyle,
  padding: 11,
  gap: 8,
  alignItems: "flex-start",
};

const classTitleStyle = {
  display: "block",
  color: publicColors.text,
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1.2,
};

const mobileClassTitleStyle = {
  ...classTitleStyle,
  fontSize: 16,
  lineHeight: 1.16,
};

const classMetaStyle = {
  display: "block",
  marginTop: 4,
  color: publicColors.muted,
  fontSize: 13,
  fontWeight: 750,
};

const viewToggleStyle = {
  ...publicPrimaryActionStyle,
  minHeight: 36,
  padding: "7px 10px",
  fontSize: 13,
  flex: "0 0 auto",
};

const mobileViewToggleStyle = {
  ...viewToggleStyle,
  minHeight: 30,
  padding: "5px 8px",
  fontSize: 12,
};

const mobileStandingsStyle = {
  display: "grid",
  gap: 8,
  padding: 10,
  borderTop: `1px solid ${publicColors.border}`,
  background: publicColors.surfaceSoft,
};

const mobileTeamCardStyle = {
  background: publicColors.surface,
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: 10,
};

const mobileTeamHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr)",
  gap: 9,
  alignItems: "start",
};

const mobileRankStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 34,
  borderRadius: 8,
  background: publicColors.primary,
  color: publicColors.primaryText,
  fontWeight: 950,
  fontSize: 14,
};

const mobileTeamIdentityStyle = {
  minWidth: 0,
};

const mobileRiderStyle = {
  color: publicColors.text,
  fontWeight: 950,
  fontSize: 15,
  lineHeight: 1.2,
  overflowWrap: "anywhere",
};

const mobileHorseStyle = {
  marginTop: 2,
  color: publicColors.softText,
  fontWeight: 800,
  fontSize: 13,
  lineHeight: 1.22,
  overflowWrap: "anywhere",
};

const mobileTotalsStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 8,
  marginTop: 10,
};

const mobileTotalStyle = {
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  background: publicColors.surfaceSoft,
  padding: "7px 8px",
};

const mobileTotalLabelStyle = {
  color: publicColors.muted,
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const mobileTotalValueStyle = {
  marginTop: 2,
  color: publicColors.text,
  fontWeight: 950,
  fontSize: 15,
};

const mobileOccurrenceHeaderStyle = {
  marginTop: 10,
  color: publicColors.muted,
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const mobileOccurrenceListStyle = {
  display: "grid",
  gap: 6,
  marginTop: 6,
};

const mobileOccurrenceButtonStyle = {
  width: "100%",
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  background: publicColors.surface,
  padding: "8px 9px",
  font: "inherit",
  color: publicColors.text,
  textAlign: "left",
  cursor: "pointer",
};

const mobileOccurrenceLabelStyle = {
  display: "block",
  color: publicColors.text,
  fontSize: 13,
  fontWeight: 900,
  lineHeight: 1.18,
};

const mobileOccurrenceValueStyle = {
  display: "block",
  marginTop: 3,
  color: publicColors.text,
  fontSize: 13,
  fontWeight: 950,
};

const mobileOccurrenceMetaStyle = {
  display: "block",
  marginTop: 2,
  color: publicColors.muted,
  fontSize: 11,
  fontWeight: 750,
};

const tableWrapStyle = {
  overflowX: "auto",
  borderTop: `1px solid ${publicColors.border}`,
};

const tableStyle = {
  width: "100%",
  minWidth: 980,
  borderCollapse: "collapse",
};

const thStyle = {
  borderBottom: `1px solid ${publicColors.border}`,
  borderRight: `1px solid ${publicColors.border}`,
  padding: "9px 8px",
  background: publicColors.surfaceSoft,
  color: publicColors.text,
  textAlign: "center",
  fontSize: 13,
};

const stickyThStyle = {
  ...thStyle,
  textAlign: "left",
};

const eventThStyle = {
  ...thStyle,
  minWidth: 120,
};

const eventHeaderButtonStyle = {
  width: "100%",
  border: 0,
  background: "transparent",
  color: publicColors.text,
  padding: 0,
  font: "inherit",
  fontWeight: 900,
  cursor: "pointer",
  textAlign: "center",
  lineHeight: 1.2,
  wordBreak: "break-word",
};

const smallHeaderStyle = {
  color: publicColors.muted,
  fontSize: 11,
  marginTop: 2,
};

const tdStyle = {
  borderBottom: `1px solid ${publicColors.border}`,
  borderRight: `1px solid ${publicColors.border}`,
  padding: "9px 8px",
  textAlign: "center",
  verticalAlign: "top",
  fontSize: 13,
};

const nameTdStyle = {
  ...tdStyle,
  textAlign: "left",
  fontWeight: 800,
  minWidth: 150,
};

const strongTdStyle = {
  ...tdStyle,
  fontWeight: 900,
};

const eventCellPointsStyle = {
  fontWeight: 900,
  color: publicColors.text,
};

const eventCellMetaStyle = {
  color: publicColors.muted,
  fontSize: 11,
  marginTop: 3,
};

const mutedCellStyle = {
  color: publicColors.muted,
};

const eventCellButtonStyle = {
  width: "100%",
  minHeight: 54,
  border: 0,
  background: "transparent",
  padding: 0,
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  textAlign: "center",
};

const mutedEventCellButtonStyle = {
  ...eventCellButtonStyle,
  minHeight: 40,
};

const footerTdStyle = {
  ...tdStyle,
  background: publicColors.surfaceSoft,
  fontWeight: 900,
};

export default PublicAssociationChampionshipPage;
