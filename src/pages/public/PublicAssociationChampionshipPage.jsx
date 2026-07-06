import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import SeoMeta from "../../components/SeoMeta";
import ShareButton from "../../components/ShareButton";
import { getAssociationWebsiteHref } from "../../features/associations/associationProfile";
import { getPublicAssociationRepository } from "../../features/publication/publicViewRepository";
import { getPublicChampionshipSeasonRepository } from "../../features/championship/championshipRepository";
import { getChampionshipIncludedShows } from "../../features/championship/championshipStandings";
import { buildChampionshipPublicSeo } from "../../features/seo/publicSeo";
import {
  formatChampionshipMoney,
  formatChampionshipPoints,
} from "../../features/championship/championshipPoints";
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
  const [association, setAssociation] = useState(null);
  const [season, setSeason] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openClassId, setOpenClassId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const classes = Array.isArray(season?.classes) ? season.classes : [];
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const includedShows = useMemo(
    () => getChampionshipIncludedShows(season),
    [season]
  );
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
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [associationId]);

  useEffect(() => {
    if (!normalizedSearchQuery) return;

    setOpenClassId(filteredClasses[0]?.id || null);
  }, [filteredClasses, normalizedSearchQuery]);

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

      <section style={heroStyle}>
        <div style={heroBrandStyle}>
          <AssociationLogo association={association} size={58} />
          <div>
            <div style={eyebrowStyle}>{t("championship.public.eyebrow")}</div>
            <h1 style={titleStyle}>{season?.title || t("championship.public.title")}</h1>
            {season?.status === "published" && (
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
        <div style={heroActionsStyle}>
          {season?.status && (
            <span style={publicBadgeStyle(season.status === "final" ? "success" : "info")}>
              {season.status === "final"
                ? t("championship.status.final")
                : t("championship.status.published")}
            </span>
          )}
          {classes.length > 0 && (
            <button
              type="button"
              onClick={downloadChampionshipPdf}
              style={secondaryButtonStyle}
            >
              {t("championship.public.downloadPdf")}
            </button>
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
          <section style={summaryStyle}>
            <SummaryItem label={t("championship.public.classes")} value={season.classCount || 0} />
            <SummaryItem label={t("championship.public.events")} value={season.eventCount || 0} />
            <SummaryItem
              label={t("championship.public.shows")}
              value={season.showCount ?? includedShows.length}
            />
            <SummaryItem label={t("championship.public.teams")} value={season.teamCount || 0} />
            <SummaryItem
              label={t("championship.public.updated")}
              value={formatDate(season.updatedAt || season.importedAt)}
            />
            <SummaryShowsItem
              label={t("championship.public.includedShows")}
              shows={includedShows}
              emptyText={t("championship.public.noIncludedShows")}
              t={t}
            />
          </section>

          <section style={searchStyle}>
            <label style={searchLabelStyle} htmlFor="championship-search">
              {t("championship.public.searchLabel")}
            </label>
            <div style={searchRowStyle}>
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
                    onClick={() => setOpenClassId(isOpen ? null : classEntry.id)}
                    style={classHeaderButtonStyle}
                  >
                    <span>
                      <span style={classTitleStyle}>{classEntry.name}</span>
                      <span style={classMetaStyle}>
                        {t("championship.public.classMeta", {
                          events: classEntry.events.length,
                          teams: classEntry.teams.length,
                        })}
                      </span>
                    </span>
                    <span style={viewToggleStyle}>
                      {isOpen ? t("public.results.hide") : t("public.results.view")}
                    </span>
                  </button>

                  {isOpen && (
                    <ChampionshipClassTable classEntry={classEntry} t={t} />
                  )}
                </article>
              );
            })}
          </div>
          )}
        </>
      )}
    </div>
  );
}

function ChampionshipClassTable({ classEntry, t }) {
  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={stickyThStyle}>{t("championship.public.rank")}</th>
            <th style={stickyThStyle}>{t("public.results.rider")}</th>
            <th style={stickyThStyle}>{t("public.results.horse")}</th>
            <th style={thStyle}>{t("championship.public.totalPoints")}</th>
            <th style={thStyle}>{t("championship.public.totalMoney")}</th>
            {classEntry.events.map((event) => (
              <th key={event.eventKey} style={eventThStyle}>
                <div>{event.label}</div>
                <div style={smallHeaderStyle}>Pts / $</div>
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
                <td style={strongTdStyle}>
                  {formatChampionshipMoney(team.totalMoney)}
                </td>
                {classEntry.events.map((event) => {
                  const detail = detailsByEvent.get(event.eventKey);

                  return (
                    <td key={`${team.teamKey}-${event.eventKey}`} style={tdStyle}>
                      {detail ? (
                        <div>
                          <div style={eventCellPointsStyle}>
                            {formatChampionshipPoints(detail.points)}
                          </div>
                          <div style={eventCellMoneyStyle}>
                            {formatChampionshipMoney(detail.moneyWon)}
                          </div>
                          <div style={eventCellMetaStyle}>
                            {t("championship.public.placeScore", {
                              place: detail.placeNum || "-",
                              score: detail.totalScore || "-",
                            })}
                          </div>
                        </div>
                      ) : (
                        <span style={mutedCellStyle}>0 / 0.00 $</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td style={footerTdStyle} colSpan={5}>
              {t("championship.public.eventTotals")}
            </td>
            {classEntry.events.map((event) => (
              <td key={`${event.eventKey}-total`} style={footerTdStyle}>
                <div>{formatChampionshipPoints(event.totalPoints)}</div>
                <div>{formatChampionshipMoney(event.totalMoney)}</div>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div style={summaryItemStyle}>
      <div style={summaryValueStyle}>{value}</div>
      <div style={mutedTextStyle}>{label}</div>
    </div>
  );
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

const eyebrowStyle = {
  ...publicEyebrowStyle,
};

const titleStyle = {
  ...publicTitleStyle,
  fontSize: 30,
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

const summaryItemStyle = {
  ...publicCardStyle,
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

const classTitleStyle = {
  display: "block",
  color: publicColors.text,
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1.2,
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

const eventCellMoneyStyle = {
  color: publicColors.softText,
  marginTop: 2,
};

const eventCellMetaStyle = {
  color: publicColors.muted,
  fontSize: 11,
  marginTop: 3,
};

const mutedCellStyle = {
  color: publicColors.muted,
};

const footerTdStyle = {
  ...tdStyle,
  background: publicColors.surfaceSoft,
  fontWeight: 900,
};

export default PublicAssociationChampionshipPage;
