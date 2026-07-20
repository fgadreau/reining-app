import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
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
import {
  hasChampionshipRules,
  normalizeChampionshipRules,
} from "../../features/championship/championshipRules";
import { buildChampionshipPublicSeo } from "../../features/seo/publicSeo";
import { formatChampionshipPoints } from "../../features/championship/championshipPoints";
import {
  subscribeChampionshipUpdatesRepository,
  unsubscribeChampionshipUpdatesRepository,
  validateChampionshipUpdateSubscriptionForm,
} from "../../features/championship/championshipUpdateSubscriptionRepository";
import {
  seedChampionshipDemo,
  shouldSeedChampionshipDemo,
} from "../../features/demo/championshipDemo";
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
  const location = useLocation();
  const { t, language } = useTranslation();
  const isMobileLayout = useChampionshipMobileLayout();
  const [association, setAssociation] = useState(null);
  const [season, setSeason] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openClassId, setOpenClassId] = useState(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);
  const [isVerificationPanelOpen, setIsVerificationPanelOpen] = useState(false);
  const [verificationPrefill, setVerificationPrefill] = useState(null);
  const [isFunFactsOpen, setIsFunFactsOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isMobileShowsOpen, setIsMobileShowsOpen] = useState(false);
  const [isSubscriptionFormOpen, setIsSubscriptionFormOpen] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState({
    name: "",
    email: "",
    consentAccepted: false,
    website: "",
  });
  const [subscriptionErrors, setSubscriptionErrors] = useState({});
  const [subscriptionState, setSubscriptionState] = useState({
    status: "idle",
    message: "",
  });
  const [unsubscribeState, setUnsubscribeState] = useState({
    status: "idle",
    message: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const classes = Array.isArray(season?.classes) ? season.classes : [];
  const associationWebsiteHref = getAssociationWebsiteHref(association);
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const includedShows = useMemo(
    () => getChampionshipIncludedShows(season),
    [season]
  );
  const funFacts = useMemo(() => buildChampionshipFunFacts(season), [season]);
  const hasFunFacts = hasChampionshipFunFacts(funFacts);
  const championshipRules = useMemo(
    () => normalizeChampionshipRules(season),
    [season]
  );
  const hasRules = hasChampionshipRules(championshipRules);
  const filteredClasses = useMemo(
    () =>
      filterChampionshipClasses(classes, normalizedSearchQuery, selectedClassId),
    [classes, normalizedSearchQuery, selectedClassId]
  );
  const seo = useMemo(
    () => buildChampionshipPublicSeo({ association, season, t }),
    [association, season, t]
  );
  const unsubscribeToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("unsubscribe") || "";
  }, [location.search]);

  useEffect(() => {
    if (!shouldSeedChampionshipDemo(location.search)) return;

    const { publicUrl } = seedChampionshipDemo();
    window.location.replace(publicUrl);
  }, [location.search]);

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
      setVerificationPrefill(null);
      setIsFunFactsOpen(false);
      setIsMobileMoreOpen(false);
      setIsMobileShowsOpen(false);
      setIsSubscriptionFormOpen(false);
      setSelectedClassId("");
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [associationId]);

  useEffect(() => {
    if (!unsubscribeToken) return undefined;

    let isMounted = true;

    async function unsubscribe() {
      setUnsubscribeState({
        status: "sending",
        message: t("championship.updates.unsubscribeSending"),
      });

      const result = await unsubscribeChampionshipUpdatesRepository({
        associationId,
        token: unsubscribeToken,
      });

      if (!isMounted) return;

      setUnsubscribeState(
        result.ok
          ? {
              status: "success",
              message: t("championship.updates.unsubscribeSuccess"),
            }
          : {
              status: "error",
              message:
                result.reason === "supabase_unavailable"
                  ? t("championship.updates.supabaseUnavailable")
                  : t("championship.updates.unsubscribeFailed"),
            }
      );
    }

    unsubscribe();

    return () => {
      isMounted = false;
    };
  }, [associationId, unsubscribeToken, t]);

  useEffect(() => {
    if (!normalizedSearchQuery) return;

    setSelectedOccurrence(null);
    setOpenClassId(filteredClasses[0]?.id || null);
  }, [filteredClasses, normalizedSearchQuery]);

  useEffect(() => {
    if (!isMobileLayout) {
      setIsMobileMoreOpen(false);
      setIsMobileShowsOpen(false);
      setSelectedClassId("");
    }
  }, [isMobileLayout]);

  const toggleClass = (classId, isOpen) => {
    setSelectedOccurrence(null);
    setOpenClassId(isOpen ? null : classId);
  };

  const updateSelectedClassFilter = (classId) => {
    setSelectedClassId(classId);
    setSelectedOccurrence(null);
    setOpenClassId(classId || null);
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

  const openVerificationPanel = (prefill = null) => {
    setVerificationPrefill(prefill);
    setIsVerificationPanelOpen(true);
  };

  const requestOccurrenceVerification = ({ classEntry, event, result }) => {
    openVerificationPanel({
      classId: classEntry?.id || "",
      showKeys: event?.eventKey ? [event.eventKey] : [],
      rider: result?.rider || "",
      horse: result?.horse || "",
    });
    setSelectedOccurrence(null);
  };

  const updateSubscriptionField = (field, value) => {
    setSubscriptionForm((current) => ({
      ...current,
      [field]: value,
    }));
    setSubscriptionErrors((current) => {
      if (!current[field]) return current;
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
    setSubscriptionState({ status: "idle", message: "" });
  };

  const submitSubscription = async (event) => {
    event.preventDefault();

    const errors = validateChampionshipUpdateSubscriptionForm(subscriptionForm);
    if (Object.keys(errors).length > 0) {
      setSubscriptionErrors(errors);
      setSubscriptionState({
        status: "error",
        message: t("championship.updates.requiredFields"),
      });
      return;
    }

    setSubscriptionState({
      status: "sending",
      message: t("championship.updates.subscribeSending"),
    });

    const result = await subscribeChampionshipUpdatesRepository({
      associationId,
      association,
      season,
      form: subscriptionForm,
      language,
      sourceUrl: getCurrentPageUrl(),
    });

    if (result.ok) {
      setSubscriptionForm((current) => ({
        ...current,
        name: "",
        email: "",
        consentAccepted: false,
      }));
      setSubscriptionErrors({});
      setSubscriptionState({
        status: "success",
        message: t("championship.updates.subscribeSuccess"),
      });
      return;
    }

    setSubscriptionState({
      status: "error",
      message:
        result.reason === "supabase_unavailable"
          ? t("championship.updates.supabaseUnavailable")
          : t("championship.updates.subscribeFailed"),
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
          {isMobileLayout ? (
            <>
              {classes.length > 0 && (
                <button
                  type="button"
                  onClick={() => openVerificationPanel()}
                  style={primaryActionButtonStyle}
                >
                  {t("championship.verification.open")}
                </button>
              )}
              <ShareButton
                url={`/public/associations/${associationId}/championnat`}
                title={seo.title}
                text={seo.description}
              />
              {(classes.length > 0 || associationWebsiteHref || hasRules) && (
                <div style={mobileMoreActionsWrapStyle}>
                  <button
                    type="button"
                    onClick={() => setIsMobileMoreOpen((value) => !value)}
                    style={secondaryButtonStyle}
                    aria-expanded={isMobileMoreOpen}
                    aria-controls="championship-mobile-more-actions"
                  >
                    {t("championship.public.moreActions")}
                  </button>
                  {isMobileMoreOpen && (
                    <div
                      id="championship-mobile-more-actions"
                      style={mobileMoreActionsPanelStyle}
                    >
                      {classes.length > 0 && hasFunFacts && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsFunFactsOpen(true);
                            setIsMobileMoreOpen(false);
                          }}
                          style={mobileMoreActionButtonStyle}
                        >
                          {t("championship.public.funFactsOpen")}
                        </button>
                      )}
                      {hasRules && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsRulesOpen(true);
                            setIsMobileMoreOpen(false);
                          }}
                          style={mobileMoreActionButtonStyle}
                        >
                          {t("championship.public.rulesOpen")}
                        </button>
                      )}
                      {classes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            downloadChampionshipPdf();
                            setIsMobileMoreOpen(false);
                          }}
                          style={mobileMoreActionButtonStyle}
                        >
                          {t("championship.public.downloadPdf")}
                        </button>
                      )}
                      {associationWebsiteHref && (
                        <a
                          href={associationWebsiteHref}
                          target="_blank"
                          rel="noreferrer"
                          style={mobileMoreActionLinkStyle}
                          onClick={() => setIsMobileMoreOpen(false)}
                        >
                          {t("common.website")}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {hasRules && (
                <button
                  type="button"
                  onClick={() => setIsRulesOpen(true)}
                  style={quietActionButtonStyle}
                >
                  {t("championship.public.rulesOpen")}
                </button>
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
                    onClick={() => openVerificationPanel()}
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
              {associationWebsiteHref && (
                <a
                  href={associationWebsiteHref}
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
            </>
          )}
        </div>
      </section>

      {unsubscribeState.status !== "idle" && (
        <div
          style={
            unsubscribeState.status === "success"
              ? updateSuccessNoticeStyle
              : unsubscribeState.status === "error"
                ? updateErrorNoticeStyle
                : updateInfoNoticeStyle
          }
        >
          {unsubscribeState.message}
        </div>
      )}

      {isLoading ? (
        <div style={emptyStateStyle}>{t("championship.public.loading")}</div>
      ) : !season ? (
        <>
          <ChampionshipUpdateSubscribePanel
            form={subscriptionForm}
            errors={subscriptionErrors}
            state={subscriptionState}
            isMobileLayout={isMobileLayout}
            isOpen={!isMobileLayout || isSubscriptionFormOpen}
            onToggle={() => setIsSubscriptionFormOpen((value) => !value)}
            onChange={updateSubscriptionField}
            onSubmit={submitSubscription}
            t={t}
          />
          <div style={emptyStateStyle}>{t("championship.public.empty")}</div>
        </>
      ) : (
        <>
          <ChampionshipUpdateSubscribePanel
            form={subscriptionForm}
            errors={subscriptionErrors}
            state={subscriptionState}
            isMobileLayout={isMobileLayout}
            isOpen={!isMobileLayout || isSubscriptionFormOpen}
            onToggle={() => setIsSubscriptionFormOpen((value) => !value)}
            onChange={updateSubscriptionField}
            onSubmit={submitSubscription}
            t={t}
          />

          {isMobileLayout ? (
            <MobileChampionshipSummary
              updatedAt={season.updatedAt || season.importedAt}
              shows={includedShows}
              isShowsOpen={isMobileShowsOpen}
              onToggleShows={() => setIsMobileShowsOpen((value) => !value)}
              t={t}
            />
          ) : (
            <section style={summaryStyle}>
              <SummaryItem
                label={t("championship.public.classes")}
                value={season.classCount || 0}
              />
              <SummaryItem
                label={t("championship.public.events")}
                value={season.eventCount || 0}
              />
              <SummaryItem
                label={t("championship.public.shows")}
                value={season.showCount ?? includedShows.length}
              />
              <SummaryItem
                label={t("championship.public.teams")}
                value={season.teamCount || 0}
              />
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
          )}

          <section style={isMobileLayout ? mobileSearchStyle : searchStyle}>
            <label style={searchLabelStyle} htmlFor="championship-search">
              {t("championship.public.searchLabel")}
            </label>
            {isMobileLayout && classes.length > 1 && (
              <select
                value={selectedClassId}
                onChange={(event) => updateSelectedClassFilter(event.target.value)}
                style={mobileClassFilterSelectStyle}
                aria-label={t("championship.public.classFilter")}
              >
                <option value="">{t("championship.public.allClasses")}</option>
                {classes.map((classEntry) => (
                  <option key={classEntry.id} value={classEntry.id}>
                    {classEntry.name}
                  </option>
                ))}
              </select>
            )}
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
        onRequestVerification={requestOccurrenceVerification}
        t={t}
      />
      <ChampionshipFunFactsModal
        isOpen={isFunFactsOpen}
        onClose={() => setIsFunFactsOpen(false)}
        funFacts={funFacts}
        t={t}
      />
      <ChampionshipRulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        rules={championshipRules}
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
        prefill={verificationPrefill}
        t={t}
      />
    </div>
  );
}

function ChampionshipUpdateSubscribePanel({
  form,
  errors,
  state,
  isMobileLayout,
  isOpen,
  onToggle,
  onChange,
  onSubmit,
  t,
}) {
  return (
    <section
      style={isMobileLayout ? mobileSubscriptionPanelStyle : subscriptionPanelStyle}
    >
      <div style={subscriptionHeaderStyle}>
        <div>
          <div style={subscriptionTitleStyle}>
            {t("championship.updates.publicTitle")}
          </div>
          <div style={subscriptionHelpStyle}>
            {t("championship.updates.publicHelp")}
          </div>
        </div>
        {isMobileLayout && (
          <button
            type="button"
            onClick={onToggle}
            style={subscriptionToggleButtonStyle}
            aria-expanded={isOpen}
          >
            {isOpen
              ? t("championship.updates.close")
              : t("championship.updates.open")}
          </button>
        )}
      </div>

      {isOpen && (
        <form
          onSubmit={onSubmit}
          style={isMobileLayout ? mobileSubscriptionFormStyle : subscriptionFormStyle}
        >
          <label style={subscriptionFieldStyle}>
            <span style={subscriptionLabelStyle}>
              {t("championship.updates.name")}
            </span>
            <input
              value={form.name}
              onChange={(event) => onChange("name", event.target.value)}
              style={subscriptionInputStyle}
              autoComplete="name"
            />
          </label>
          <label style={subscriptionFieldStyle}>
            <span style={subscriptionLabelStyle}>
              {t("championship.updates.email")}
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => onChange("email", event.target.value)}
              style={
                errors.email
                  ? subscriptionInputErrorStyle
                  : subscriptionInputStyle
              }
              autoComplete="email"
              required
            />
          </label>
          <label style={subscriptionHoneypotStyle} aria-hidden="true">
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(event) => onChange("website", event.target.value)}
            />
          </label>
          <label style={subscriptionConsentStyle}>
            <input
              type="checkbox"
              checked={form.consentAccepted}
              onChange={(event) =>
                onChange("consentAccepted", event.target.checked)
              }
            />
            <span>
              {t("championship.updates.consent")}
            </span>
          </label>
          <button
            type="submit"
            style={subscriptionSubmitButtonStyle}
            disabled={state.status === "sending"}
          >
            {state.status === "sending"
              ? t("championship.updates.subscribeSending")
              : t("championship.updates.subscribe")}
          </button>
        </form>
      )}

      {state.message && (
        <div
          style={
            state.status === "success"
              ? updateSuccessNoticeStyle
              : state.status === "error"
                ? updateErrorNoticeStyle
                : updateInfoNoticeStyle
          }
        >
          {state.message}
        </div>
      )}
    </section>
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
                            {detail.disqualified
                              ? t("championship.occurrence.disqualifiedShort")
                              : formatChampionshipPoints(detail.points)}
                          </div>
                          <div style={eventCellMetaStyle}>
                            {formatChampionshipDetailMeta(detail, t)}
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
              <div style={mobilePointsPillStyle}>
                <span style={mobilePointsValueStyle}>
                  {formatChampionshipPoints(team.totalPoints)}
                </span>
                <span style={mobilePointsLabelStyle}>pts</span>
              </div>
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
                        {detail.disqualified
                          ? t("championship.occurrence.disqualifiedShort")
                          : `${formatChampionshipPoints(detail.points)} pts`}
                      </span>
                      <span style={mobileOccurrenceMetaStyle}>
                        {formatChampionshipDetailMeta(detail, t)}
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

function ChampionshipRulesModal({ isOpen, onClose, rules, t }) {
  if (!isOpen) return null;

  return (
    <div style={funFactsBackdropStyle} role="presentation" onClick={onClose}>
      <section
        style={championshipRulesModalStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="championship-rules-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={funFactsHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>
              {t("championship.public.rulesEyebrow")}
            </div>
            <h2 id="championship-rules-title" style={funFactsTitleStyle}>
              {t("championship.public.rulesTitle")}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={funFactsCloseButtonStyle}>
            {t("championship.public.rulesClose")}
          </button>
        </div>

        <div style={championshipRulesContentStyle}>
          {rules.rulesStatement && (
            <section style={championshipRuleSectionStyle}>
              <h3 style={championshipRuleTitleStyle}>
                {t("championship.public.rulesStatementTitle")}
              </h3>
              <div style={championshipRuleTextStyle}>
                {rules.rulesStatement}
              </div>
            </section>
          )}
          {rules.pointsExplanation && (
            <section style={championshipRuleSectionStyle}>
              <h3 style={championshipRuleTitleStyle}>
                {t("championship.public.pointsExplanationTitle")}
              </h3>
              <div style={championshipRuleTextStyle}>
                {rules.pointsExplanation}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function MobileChampionshipSummary({
  updatedAt,
  shows,
  isShowsOpen,
  onToggleShows,
  t,
}) {
  const showCount = Array.isArray(shows) ? shows.length : 0;

  return (
    <section style={mobileCompactSummaryStyle}>
      <div style={mobileCompactSummaryLineStyle}>
        <div style={mobileCompactUpdatedStyle}>
          <span style={mobileCompactSummaryLabelStyle}>
            {t("championship.public.updated")}
          </span>
          <strong style={mobileCompactSummaryValueStyle}>
            {formatDate(updatedAt)}
          </strong>
        </div>
        <button
          type="button"
          onClick={onToggleShows}
          style={mobileIncludedShowsButtonStyle}
          aria-expanded={isShowsOpen}
        >
          {showCount > 0
            ? t("championship.public.includedShowCount", { count: showCount })
            : t("championship.public.noIncludedShows")}
        </button>
      </div>
      {isShowsOpen && (
        <div style={mobileIncludedShowsListStyle}>
          {showCount > 0 ? (
            shows.map((show) => (
              <span key={show.key} style={mobileIncludedShowChipStyle}>
                {formatIncludedShowLabel(show)}
              </span>
            ))
          ) : (
            <span style={mutedTextStyle}>
              {t("championship.public.noIncludedShows")}
            </span>
          )}
        </div>
      )}
    </section>
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

  return window.matchMedia("(max-width: 980px)");
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

function formatChampionshipDetailMeta(detail, t) {
  if (detail.disqualified) {
    return detail.dqReason
      ? t("championship.occurrence.disqualificationReason", {
          reason: detail.dqReason,
        })
      : t("championship.occurrence.disqualifiedShort");
  }

  const placeScore = t("championship.public.placeScore", {
    place: detail.placeNum || "-",
    score: detail.totalScore || "-",
  });
  const backNumber = String(detail.backNumber || "").trim();

  return backNumber
    ? `${t("public.results.backNumber")} ${backNumber} · ${placeScore}`
    : placeScore;
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

function filterChampionshipClasses(classes, query, selectedClassId = "") {
  const selectedClasses = selectedClassId
    ? classes.filter((classEntry) => classEntry.id === selectedClassId)
    : classes;

  if (!query) return selectedClasses;

  return selectedClasses
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

const mobileMoreActionsWrapStyle = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
};

const mobileMoreActionsPanelStyle = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  zIndex: 30,
  width: "min(220px, calc(100vw - 32px))",
  display: "grid",
  gap: 6,
  padding: 8,
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  background: publicColors.surface,
  boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)",
};

const mobileMoreActionButtonStyle = {
  ...publicSecondaryActionStyle,
  width: "100%",
  justifyContent: "flex-start",
  minHeight: 40,
  padding: "8px 10px",
  font: "inherit",
  background: "#fff",
};

const mobileMoreActionLinkStyle = {
  ...mobileMoreActionButtonStyle,
  boxSizing: "border-box",
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

const subscriptionPanelStyle = {
  ...publicCardStyle,
  marginBottom: 12,
};

const mobileSubscriptionPanelStyle = {
  ...subscriptionPanelStyle,
  padding: 10,
  marginBottom: 10,
};

const subscriptionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const subscriptionTitleStyle = {
  color: publicColors.text,
  fontSize: 16,
  fontWeight: 950,
  lineHeight: 1.18,
};

const subscriptionHelpStyle = {
  marginTop: 2,
  color: publicColors.muted,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.3,
};

const subscriptionToggleButtonStyle = {
  ...publicSecondaryActionStyle,
  flex: "0 0 auto",
  minHeight: 34,
  padding: "7px 9px",
  font: "inherit",
  fontSize: 12,
};

const subscriptionFormStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr) auto",
  gap: 8,
  alignItems: "end",
  marginTop: 10,
};

const mobileSubscriptionFormStyle = {
  ...subscriptionFormStyle,
  gridTemplateColumns: "1fr",
};

const subscriptionFieldStyle = {
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const subscriptionLabelStyle = {
  color: publicColors.muted,
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const subscriptionInputStyle = {
  width: "100%",
  minHeight: 38,
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: "8px 9px",
  color: publicColors.text,
  background: publicColors.surface,
  font: "inherit",
  fontSize: 14,
  boxSizing: "border-box",
};

const subscriptionInputErrorStyle = {
  ...subscriptionInputStyle,
  borderColor: "#ef4444",
};

const subscriptionConsentStyle = {
  gridColumn: "1 / -1",
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  color: publicColors.muted,
  fontSize: 12,
  fontWeight: 750,
  lineHeight: 1.32,
};

const subscriptionSubmitButtonStyle = {
  ...publicPrimaryActionStyle,
  minHeight: 38,
  padding: "8px 11px",
  font: "inherit",
  whiteSpace: "nowrap",
};

const subscriptionHoneypotStyle = {
  position: "absolute",
  left: "-10000px",
  width: 1,
  height: 1,
  overflow: "hidden",
};

const updateInfoNoticeStyle = {
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  background: "#f8fafc",
  color: publicColors.text,
  padding: "8px 10px",
  marginTop: 8,
  marginBottom: 10,
  fontSize: 13,
  fontWeight: 800,
};

const updateSuccessNoticeStyle = {
  ...updateInfoNoticeStyle,
  borderColor: "#86efac",
  background: "#f0fdf4",
  color: "#166534",
};

const updateErrorNoticeStyle = {
  ...updateInfoNoticeStyle,
  borderColor: "#fecaca",
  background: "#fef2f2",
  color: "#991b1b",
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

const mobileCompactSummaryStyle = {
  ...publicCardStyle,
  padding: "8px 10px",
  marginBottom: 10,
};

const mobileCompactSummaryLineStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const mobileCompactUpdatedStyle = {
  minWidth: 0,
};

const mobileCompactSummaryLabelStyle = {
  display: "block",
  color: publicColors.muted,
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const mobileCompactSummaryValueStyle = {
  display: "block",
  color: publicColors.text,
  fontSize: 13,
  lineHeight: 1.12,
};

const mobileIncludedShowsButtonStyle = {
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  background: "#f8fafc",
  color: publicColors.text,
  padding: "7px 9px",
  font: "inherit",
  fontSize: 12,
  fontWeight: 850,
  cursor: "pointer",
  flex: "0 0 auto",
};

const mobileIncludedShowsListStyle = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginTop: 8,
  paddingTop: 8,
  borderTop: `1px solid ${publicColors.border}`,
};

const mobileIncludedShowChipStyle = {
  display: "inline-flex",
  alignItems: "center",
  border: `1px solid ${publicColors.border}`,
  borderRadius: 999,
  background: "#f8fafc",
  color: publicColors.text,
  padding: "5px 8px",
  fontSize: 12,
  fontWeight: 850,
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

const mobileClassFilterSelectStyle = {
  width: "100%",
  minHeight: 40,
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  marginBottom: 7,
  color: publicColors.text,
  background: publicColors.surface,
  font: "inherit",
  fontSize: 14,
  fontWeight: 800,
  boxSizing: "border-box",
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

const championshipRulesModalStyle = {
  ...funFactsModalStyle,
  width: "min(680px, 100%)",
};

const championshipRulesContentStyle = {
  display: "grid",
  gap: 14,
};

const championshipRuleSectionStyle = {
  borderTop: `1px solid ${publicColors.border}`,
  paddingTop: 13,
};

const championshipRuleTitleStyle = {
  margin: "0 0 7px",
  color: publicColors.text,
  fontSize: 16,
  lineHeight: 1.25,
};

const championshipRuleTextStyle = {
  color: publicColors.text,
  fontSize: 14,
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
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
  gap: 6,
  padding: 8,
  borderTop: `1px solid ${publicColors.border}`,
  background: publicColors.surfaceSoft,
};

const mobileTeamCardStyle = {
  background: publicColors.surface,
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: 8,
};

const mobileTeamHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "40px minmax(0, 1fr) auto",
  gap: 8,
  alignItems: "center",
};

const mobileRankStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 32,
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
  marginTop: 1,
  color: publicColors.softText,
  fontWeight: 800,
  fontSize: 12,
  lineHeight: 1.16,
  overflowWrap: "anywhere",
};

const mobilePointsPillStyle = {
  display: "grid",
  justifyItems: "end",
  alignSelf: "stretch",
  minWidth: 44,
  borderRadius: 8,
  background: publicColors.surfaceSoft,
  padding: "5px 7px",
  border: `1px solid ${publicColors.border}`,
};

const mobilePointsValueStyle = {
  color: publicColors.text,
  fontWeight: 950,
  fontSize: 16,
  lineHeight: 1,
};

const mobilePointsLabelStyle = {
  color: publicColors.muted,
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const mobileOccurrenceListStyle = {
  display: "grid",
  gap: 5,
  marginTop: 7,
};

const mobileOccurrenceButtonStyle = {
  width: "100%",
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  background: publicColors.surface,
  padding: "6px 8px",
  font: "inherit",
  color: publicColors.text,
  textAlign: "left",
  cursor: "pointer",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  columnGap: 8,
  rowGap: 1,
  alignItems: "center",
};

const mobileOccurrenceLabelStyle = {
  display: "block",
  color: publicColors.text,
  fontSize: 12,
  fontWeight: 900,
  lineHeight: 1.12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const mobileOccurrenceValueStyle = {
  display: "block",
  color: publicColors.text,
  fontSize: 12,
  fontWeight: 950,
  lineHeight: 1.1,
  whiteSpace: "nowrap",
};

const mobileOccurrenceMetaStyle = {
  display: "block",
  gridColumn: "1 / -1",
  color: publicColors.muted,
  fontSize: 10,
  fontWeight: 750,
  lineHeight: 1.15,
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
