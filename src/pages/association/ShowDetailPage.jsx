import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getClassesForDayRepository,
  saveClassItemRepository,
} from "../../features/classes/classRepository";
import {
  getAssociationRepository,
  saveAssociationRepository,
} from "../../features/associations/associationRepository";
import {
  formatSponsorLogoDetails,
  normalizeSponsorLogos,
  optimizeSponsorLogoFile,
} from "../../features/associations/sponsorLogos";
import {
  dayHasScheduleItemsRepository,
  deleteDayRepository,
  getDaysByShowRepository,
  saveDayRepository,
  syncDaysForShowDateRangeRepository,
} from "../../features/days/dayRepository";
import {
  formatDayLabel,
  getShowDateRange,
  getSortOrderForShowDate,
  isDateInShowRange,
  sortDaysByDate,
} from "../../features/days/dayDateUtils";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { getDefaultShowRouteForRoles } from "../../features/auth/showRoleRouting";
import { getCloudSyncStatus } from "../../features/cloud/supabaseStatus";
import {
  formatLocalFirstSyncNotice,
  getLocalFirstSyncNoticeTone,
} from "../../features/cloud/localFirstSyncMessages";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { getPaidWarmupsForDayRepository } from "../../features/paidWarmups/paidWarmupRepository";
import { PUBLICATION_STATUSES } from "../../features/publication/publicationRepository";
import { savePublicationStateRepository } from "../../features/publication/publicationCloudRepository";
import {
  getShowRepository,
  saveShowRepository,
} from "../../features/shows/showRepository";
import { appStyles as styles } from "../../styles/appStyles";
import { createId } from "../../utils/createId";

function ShowDetailPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const [association, setAssociation] = useState(null);
  const [show, setShow] = useState(null);
  const [days, setDays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ date: "" });
  const [isAddingDay, setIsAddingDay] = useState(false);
  const [newDayDate, setNewDayDate] = useState("");
  const [copiedOverlayKey, setCopiedOverlayKey] = useState("");
  const [overlayArenas, setOverlayArenas] = useState([]);
  const [selectedOverlayArena, setSelectedOverlayArena] = useState("");
  const [isLivestreamModalOpen, setIsLivestreamModalOpen] = useState(false);
  const [livestreamDraft, setLivestreamDraft] = useState({
    isLivestreamPublic: false,
    livestreamUrl: "",
  });
  const [sponsorLogosDraft, setSponsorLogosDraft] = useState([]);
  const [isOptimizingSponsors, setIsOptimizingSponsors] = useState(false);
  const [livestreamMessage, setLivestreamMessage] = useState("");
  const [livestreamMessageTone, setLivestreamMessageTone] = useState("synced");
  const [copyDraft, setCopyDraft] = useState({
    sourceDayId: "",
    targetDate: "",
  });
  const access = useAssociationAccess(associationId);

  const cloudStatus = getCloudSyncStatus(access.user);
  const showDateRange = useMemo(() => getShowDateRange(show), [show]);
  const sortedDays = useMemo(() => sortDaysByDate(days), [days]);
  const rangeStartDate = showDateRange[0] || "";
  const rangeEndDate = showDateRange[showDateRange.length - 1] || "";

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [nextShow, nextAssociation] = await Promise.all([
        getShowRepository(showId),
        getAssociationRepository(associationId),
      ]);
      const nextDays = nextShow
        ? await syncDaysForShowDateRangeRepository(nextShow, { language })
        : await getDaysByShowRepository(showId);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setShow(nextShow);
      setDays(nextDays);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [associationId, language, showId]);

  useEffect(() => {
    let isMounted = true;

    async function loadOverlayArenas() {
      const arenas = await getOverlayArenasForDays(sortedDays);

      if (!isMounted) return;
      setOverlayArenas(arenas);
    }

    loadOverlayArenas();

    return () => {
      isMounted = false;
    };
  }, [sortedDays]);

  useEffect(() => {
    setSelectedOverlayArena((currentArena) =>
      overlayArenas.includes(currentArena) ? currentArena : overlayArenas[0] || ""
    );
  }, [overlayArenas]);

  useEffect(() => {
    if (access.isLoadingAccess) return;

    const targetPath = getDefaultShowRouteForRoles({
      associationId,
      showId,
      roles: access.associationRoles,
    });
    const currentPath = `/associations/${associationId}/shows/${showId}`;

    if (targetPath !== currentPath) {
      navigate(targetPath, { replace: true });
    }
  }, [
    access.associationRoles,
    access.isLoadingAccess,
    associationId,
    navigate,
    showId,
  ]);

  const buildDayForDate = (date) => {
    return {
      id: createId("day"),
      associationId,
      showId,
      date,
      label: formatDayLabel(date, language),
      sortOrder: getSortOrderForShowDate(date, show),
    };
  };

  const getFirstAvailableDate = () => {
    const existingDates = new Set(days.map((day) => day.date).filter(Boolean));
    return (
      showDateRange.find((date) => !existingDates.has(date)) ||
      showDateRange[0] ||
      ""
    );
  };

  const startCreateDay = () => {
    if (showDateRange.length === 0) {
      alert(t("management.days.noDateRange"));
      return;
    }

    setNewDayDate(getFirstAvailableDate());
    setIsAddingDay(true);
  };

  const cancelCreateDay = () => {
    setIsAddingDay(false);
    setNewDayDate("");
  };

  const saveNewDay = async () => {
    if (!isDateInShowRange(newDayDate, show)) {
      alert(t("management.days.dateOutOfRange"));
      return;
    }

    if (days.some((day) => day.date === newDayDate)) {
      alert(t("management.days.dateAlreadyExists"));
      return;
    }

    const newDay = buildDayForDate(newDayDate);
    setIsSaving(true);
    try {
      const savedDay = await saveDayRepository(newDay);
      setDays((current) => sortDaysByDate([...current, savedDay]));
      cancelCreateDay();
    } catch (error) {
      console.error("Erreur sauvegarde journée:", error);
      alert(t("common.saveFailed", { message: error?.message || "" }));
    } finally {
      setIsSaving(false);
    }
  };

  const startEditDay = (day) => {
    setEditingId(day.id);
    setDraft({ date: day.date || "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ date: "" });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const currentDay = days.find((day) => day.id === editingId);
    if (!currentDay) return;

    if (!isDateInShowRange(draft.date, show)) {
      alert(t("management.days.dateOutOfRange"));
      return;
    }

    if (days.some((day) => day.id !== editingId && day.date === draft.date)) {
      alert(t("management.days.dateAlreadyExists"));
      return;
    }

    const nextDay = {
      ...currentDay,
      associationId,
      showId,
      date: draft.date,
      label: formatDayLabel(draft.date, language),
      sortOrder: getSortOrderForShowDate(draft.date, show),
    };

    setIsSaving(true);
    try {
      await saveDayRepository(nextDay);
      setDays((current) =>
        sortDaysByDate(
          current.map((day) => (day.id === editingId ? nextDay : day))
        )
      );
      setEditingId(null);
    } catch (error) {
      console.error("Erreur sauvegarde journée:", error);
      alert(t("common.saveFailed", { message: error?.message || "" }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDay = async (dayId) => {
    const hasScheduleItems = await dayHasScheduleItemsRepository(dayId);

    if (hasScheduleItems) {
      alert(t("management.days.deleteBlocked"));
      return;
    }

    const confirmed = window.confirm(t("management.days.deleteConfirm"));
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await deleteDayRepository(dayId);
      setDays((current) => current.filter((day) => day.id !== dayId));

      if (editingId === dayId) {
        cancelEdit();
      }
    } catch (error) {
      console.error("Erreur suppression journée:", error);
      alert(t("common.deleteFailed", { message: error?.message || "" }));
    } finally {
      setIsSaving(false);
    }
  };

  const openLivestreamSettings = () => {
    setLivestreamDraft({
      isLivestreamPublic: Boolean(show?.isLivestreamPublic),
      livestreamUrl: show?.livestreamUrl || "",
    });
    setSponsorLogosDraft(normalizeSponsorLogos(association?.sponsorLogos));
    setIsOptimizingSponsors(false);
    setLivestreamMessage("");
    setLivestreamMessageTone("synced");
    setIsLivestreamModalOpen(true);
  };

  const closeLivestreamSettings = () => {
    setIsLivestreamModalOpen(false);
    setCopiedOverlayKey("");
    setLivestreamMessage("");
    setIsOptimizingSponsors(false);
  };

  const handleSponsorLogoFilesChange = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;

    setIsOptimizingSponsors(true);
    setLivestreamMessage("");

    try {
      const nextSponsorLogos = await Promise.all(
        files.map(async (file) => {
          const optimizedLogo = await optimizeSponsorLogoFile(file);

          return {
            id: createId("sponsor"),
            name: file.name.replace(/\.[^.]+$/, ""),
            logoDataUrl: optimizedLogo.dataUrl,
            width: optimizedLogo.width,
            height: optimizedLogo.height,
            originalBytes: optimizedLogo.originalBytes,
            optimizedBytes: optimizedLogo.optimizedBytes,
            mimeType: optimizedLogo.mimeType,
          };
        })
      );

      setSponsorLogosDraft((current) =>
        normalizeSponsorLogos([...current, ...nextSponsorLogos])
      );
    } catch (error) {
      console.error("Erreur ajout logos commanditaires:", error);
      setLivestreamMessage(
        t("management.shows.sponsorLogosOptimizeFailed", {
          message: error?.message || "",
        })
      );
      setLivestreamMessageTone("warn");
    } finally {
      setIsOptimizingSponsors(false);
    }
  };

  const updateSponsorLogo = (sponsorId, updates) => {
    setSponsorLogosDraft((current) =>
      current.map((sponsor) =>
        sponsor.id === sponsorId ? { ...sponsor, ...updates } : sponsor
      )
    );
  };

  const removeSponsorLogo = (sponsorId) => {
    setSponsorLogosDraft((current) =>
      current.filter((sponsor) => sponsor.id !== sponsorId)
    );
  };

  const saveLivestreamSettings = async () => {
    if (!show) return;

    const nextShow = {
      ...show,
      associationId,
      livestreamUrl: livestreamDraft.livestreamUrl,
      isLivestreamPublic: Boolean(livestreamDraft.isLivestreamPublic),
    };
    const sponsorLogos = normalizeSponsorLogos(sponsorLogosDraft);

    setIsSaving(true);
    try {
      const [savedShow, savedAssociation] = await Promise.all([
        saveShowRepository(nextShow),
        association
          ? saveAssociationRepository({
              ...association,
              sponsorLogos,
            })
          : Promise.resolve(null),
      ]);
      setShow(savedShow);
      if (savedAssociation) {
        setAssociation(savedAssociation);
        setSponsorLogosDraft(normalizeSponsorLogos(savedAssociation.sponsorLogos));
      }
      setLivestreamMessage(formatLocalFirstSyncNotice(savedShow, t));
      setLivestreamMessageTone(getLocalFirstSyncNoticeTone(savedShow));
    } catch (error) {
      console.error("Erreur sauvegarde réglages livestream:", error);
      setLivestreamMessage(
        t("common.localFirstSyncError", {
          message: error?.message || "",
        })
      );
      setLivestreamMessageTone("warn");
    } finally {
      setIsSaving(false);
    }
  };

  const copyOverlayLink = async (arena = "") => {
    const normalizedArena = normalizeArenaName(arena);
    const overlayUrl = getAbsoluteOverlayUrl(
      associationId,
      showId,
      normalizedArena
    );
    const copyKey = getOverlayCopyKey(normalizedArena);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(overlayUrl);
        setCopiedOverlayKey(copyKey);
        window.setTimeout(() => setCopiedOverlayKey(""), 1800);
      } else {
        window.prompt(t("management.shows.obsOverlayPrompt"), overlayUrl);
      }
    } catch (error) {
      console.error("Erreur copie lien OBS:", error);
      window.prompt(t("management.shows.obsOverlayPrompt"), overlayUrl);
    }
  };

  const startCopyClasses = (day) => {
    if (showDateRange.length === 0) {
      alert(t("management.days.noDateRange"));
      return;
    }

    const targetDate =
      showDateRange.find((date) => date !== day.date) || showDateRange[0] || "";

    setCopyDraft({
      sourceDayId: day.id,
      targetDate,
    });
  };

  const cancelCopyClasses = () => {
    setCopyDraft({ sourceDayId: "", targetDate: "" });
  };

  const handleCopyClassesToDate = async (sourceDay) => {
    const targetDate = copyDraft.targetDate;

    if (!isDateInShowRange(targetDate, show)) {
      alert(t("management.days.dateOutOfRange"));
      return;
    }

    if (sourceDay.date === targetDate) {
      alert(t("management.days.copySameDay"));
      return;
    }

    setIsSaving(true);

    try {
      const sourceClasses = await getClassesForDayRepository(sourceDay.id);

      if (sourceClasses.length === 0) {
        alert(t("management.days.copyNoClasses"));
        return;
      }

      let targetDay = days.find((day) => day.date === targetDate);
      let nextDaysForOverlay = days;

      if (!targetDay) {
        targetDay = await saveDayRepository(buildDayForDate(targetDate));
        nextDaysForOverlay = sortDaysByDate([...days, targetDay]);
        setDays(nextDaysForOverlay);
      }

      const [targetClasses, targetWarmups] = await Promise.all([
        getClassesForDayRepository(targetDay.id),
        getPaidWarmupsForDayRepository(targetDay.id),
      ]);
      const targetSortOrder = Math.max(
        0,
        ...targetClasses.map((item) => item.sortOrder || 0),
        ...targetWarmups.map((item) => item.sortOrder || 0)
      );
      const orderedSourceClasses = [...sourceClasses].sort((a, b) => {
        const sortOrder = (a.sortOrder || 0) - (b.sortOrder || 0);
        if (sortOrder !== 0) return sortOrder;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

      for (const [index, sourceClass] of orderedSourceClasses.entries()) {
        const copiedClass = {
          id: createId("class"),
          associationId,
          showId,
          dayId: targetDay.id,
          name: sourceClass.name || "",
          classCode: sourceClass.classCode || "",
          arena: sourceClass.arena || "",
          pattern: sourceClass.pattern || "",
          customPattern: sourceClass.customPattern || null,
          judgeName: sourceClass.judgeName || "",
          showName: show?.name || "",
          date: targetDay.date || "",
          dayLabel: targetDay.label || "",
          sortOrder: targetSortOrder + index + 1,
        };

        const savedClass = await saveClassItemRepository(copiedClass);
        await savePublicationStateRepository(savedClass.id, {
          status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
          publishedAt: null,
          publishedBy: null,
        });
      }

      alert(
        t("management.days.copySuccess", {
          count: orderedSourceClasses.length,
        })
      );
      setOverlayArenas(await getOverlayArenasForDays(nextDaysForOverlay));
      cancelCopyClasses();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: 16,
        }}
      >
        <h1 style={{ marginTop: 0 }}>{show?.name || t("common.show")}</h1>
        <div style={{ fontWeight: 700 }}>
          {show?.venue || t("management.days.venueFallback")}
        </div>
        <div style={{ color: "#64748b", marginTop: 4 }}>
          {show?.location || ""}
          {show?.startDate ? ` • ${show.startDate}` : ""}
          {show?.endDate
            ? ` ${t("management.shows.dateRangeJoin")} ${show.endDate}`
            : ""}
        </div>
        <div style={{ color: "#64748b", marginTop: 4 }}>
          {t("management.shows.statusPrefix")}: {formatShowStatus(show?.status, t)}
        </div>
        <div style={actionRowStyle}>
          <button
            type="button"
            onClick={openLivestreamSettings}
            style={primaryButtonStyle}
          >
            {t("management.shows.livestreamSettings")}
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          <span style={syncBadgeStyle(cloudStatus.configured)}>
            {t("management.sync.label")}: {getSyncLabel(cloudStatus, t)}
          </span>
          <span style={accessBadgeStyle(access.canManageAssociation)}>
            {t("management.shows.accessLabel")}:{" "}
            {access.isLoadingAccess
              ? t("management.shows.accessLoading")
              : access.roleLabel}
          </span>
        </div>
      </div>

      {isLivestreamModalOpen && (
        <div style={modalBackdropStyle} role="presentation">
          <section
            style={modalPanelStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="livestream-settings-title"
          >
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalEyebrowStyle}>
                  {t("management.shows.livestreamSettings")}
                </div>
                <h2 id="livestream-settings-title" style={modalTitleStyle}>
                  {show?.name || t("common.show")}
                </h2>
                <div style={modalDescriptionStyle}>
                  {t("management.shows.livestreamSettingsHelp")}
                </div>
              </div>
              <button
                type="button"
                onClick={closeLivestreamSettings}
                style={iconCloseButtonStyle}
                aria-label={t("management.days.cancel")}
              >
                x
              </button>
            </div>

            <div style={modalBodyStyle}>
              <section style={settingsSectionStyle}>
                <div>
                  <h3 style={settingsTitleStyle}>
                    {t("management.shows.livestreamVideoTitle")}
                  </h3>
                  <div style={helpTextStyle}>
                    {t("management.shows.livestreamHelp")}
                  </div>
                </div>

                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={Boolean(livestreamDraft.isLivestreamPublic)}
                    onChange={(event) =>
                      setLivestreamDraft((current) => ({
                        ...current,
                        isLivestreamPublic: event.target.checked,
                      }))
                    }
                    disabled={!access.canManageAssociation || isSaving}
                  />
                  <span>{t("management.shows.livestreamPublicLabel")}</span>
                </label>

                <div>
                  <label style={labelStyle}>
                    {t("management.shows.livestreamUrlLabel")}
                  </label>
                  <input
                    type="text"
                    value={livestreamDraft.livestreamUrl}
                    onChange={(event) =>
                      setLivestreamDraft((current) => ({
                        ...current,
                        livestreamUrl: event.target.value,
                      }))
                    }
                    placeholder="https://youtube.com/watch?v=..."
                    style={inputStyle}
                    disabled={!access.canManageAssociation || isSaving}
                  />
                </div>
              </section>

              <section style={settingsSectionStyle}>
                <div>
                  <h3 style={settingsTitleStyle}>
                    {t("management.shows.obsOverlayTitle")}
                  </h3>
                  <div style={helpTextStyle}>
                    {t("management.shows.obsOverlayHelp")}
                  </div>
                </div>

                <div style={arenaOverlayRowStyle}>
                  <span style={arenaOverlayNameStyle}>
                    {t("management.shows.obsOverlayGeneralTitle")}
                  </span>
                  <Link
                    to={getOverlayPath(associationId, showId)}
                    style={linkButtonStyle}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("management.shows.openObsOverlayGeneral")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => copyOverlayLink()}
                    style={secondaryButtonStyle}
                  >
                    {copiedOverlayKey === getOverlayCopyKey()
                      ? t("common.linkCopied")
                      : t("management.shows.copyObsOverlayLink")}
                  </button>
                </div>

                {overlayArenas.length > 0 ? (
                  <div style={arenaOverlayListStyle}>
                    <label style={labelStyle}>
                      {t("management.shows.obsOverlayArenaTitle")}
                    </label>
                    <div style={arenaOverlayPickerStyle}>
                      <select
                        value={selectedOverlayArena}
                        onChange={(event) =>
                          setSelectedOverlayArena(event.target.value)
                        }
                        style={inputStyle}
                      >
                        {overlayArenas.map((arena) => (
                          <option key={arena} value={arena}>
                            {arena}
                          </option>
                        ))}
                      </select>
                      <Link
                        to={getOverlayPath(
                          associationId,
                          showId,
                          selectedOverlayArena
                        )}
                        style={linkButtonStyle}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("management.shows.openObsOverlayArena")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => copyOverlayLink(selectedOverlayArena)}
                        style={secondaryButtonStyle}
                      >
                        {copiedOverlayKey === getOverlayCopyKey(selectedOverlayArena)
                          ? t("common.linkCopied")
                          : t("management.shows.copyObsOverlayArenaLink")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={softNoticeStyle}>
                    {t("management.shows.obsOverlayNoArena")}
                  </div>
                )}

                <div style={overlaySponsorSectionStyle}>
                  <div>
                    <h4 style={overlaySponsorTitleStyle}>
                      {t("management.shows.overlaySponsorLogosTitle")}
                    </h4>
                    <div style={helpTextStyle}>
                      {t("management.shows.overlaySponsorLogosHelp")}
                    </div>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleSponsorLogoFilesChange}
                    style={fileInputStyle}
                    disabled={
                      !access.canManageAssociation ||
                      isSaving ||
                      isOptimizingSponsors
                    }
                  />

                  {isOptimizingSponsors ? (
                    <div style={softNoticeStyle}>
                      {t("management.shows.sponsorLogosOptimizing")}
                    </div>
                  ) : null}

                  {sponsorLogosDraft.length ? (
                    <div style={sponsorGridStyle}>
                      {sponsorLogosDraft.map((sponsor) => {
                        const logoDetails = formatSponsorLogoDetails(sponsor);

                        return (
                          <div key={sponsor.id} style={sponsorCardStyle}>
                            <div style={sponsorPreviewStyle}>
                              <img
                                src={sponsor.logoDataUrl}
                                alt={
                                  sponsor.name ||
                                  t("management.shows.sponsorLogo")
                                }
                                style={sponsorImageStyle}
                              />
                            </div>
                            <input
                              value={sponsor.name}
                              onChange={(event) =>
                                updateSponsorLogo(sponsor.id, {
                                  name: event.target.value,
                                })
                              }
                              placeholder={t("management.shows.sponsorName")}
                              style={inputStyle}
                              disabled={
                                !access.canManageAssociation ||
                                isSaving ||
                                isOptimizingSponsors
                              }
                            />
                            {logoDetails ? (
                              <div style={sponsorMetaStyle}>{logoDetails}</div>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => removeSponsorLogo(sponsor.id)}
                              disabled={
                                !access.canManageAssociation ||
                                isSaving ||
                                isOptimizingSponsors
                              }
                              style={secondaryButtonStyle}
                            >
                              {t("management.shows.removeSponsorLogo")}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={softNoticeStyle}>
                      {t("management.shows.noSponsorLogos")}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {livestreamMessage && (
              <div style={syncNoticeStyle(livestreamMessageTone)}>
                {livestreamMessage}
              </div>
            )}

            <div style={modalFooterStyle}>
              <button
                type="button"
                onClick={closeLivestreamSettings}
                style={secondaryButtonStyle}
                disabled={isSaving}
              >
                {t("management.days.cancel")}
              </button>
              {access.canManageAssociation && (
                <button
                  type="button"
                  onClick={saveLivestreamSettings}
                  style={primaryButtonStyle}
                  disabled={isSaving || isOptimizingSponsors}
                >
                  {isSaving
                    ? t("management.shows.saving")
                    : t("management.shows.save")}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      <div style={headerWrapStyle}>
        <h2 style={{ fontSize: 20, margin: 0 }}>{t("management.days.title")}</h2>

        <div style={actionRowStyleNoMargin}>
          {access.canManageAssociation && (
            <button
              onClick={startCreateDay}
              style={primaryButtonStyle}
              disabled={isSaving}
            >
              {t("management.days.addDay")}
            </button>
          )}
        </div>
      </div>

      {isAddingDay && access.canManageAssociation && (
        <div style={inlineFormStyle}>
          <div style={editGridStyle}>
            <div>
              <label style={labelStyle}>{t("management.days.dateLabel")}</label>
              <input
                type="date"
                value={newDayDate}
                min={rangeStartDate || undefined}
                max={rangeEndDate || undefined}
                onChange={(event) => setNewDayDate(event.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={actionRowStyle}>
            <button
              type="button"
              onClick={saveNewDay}
              style={primaryButtonStyle}
              disabled={isSaving}
            >
              {t("management.days.save")}
            </button>

            <button
              type="button"
              onClick={cancelCreateDay}
              style={secondaryButtonStyle}
              disabled={isSaving}
            >
              {t("management.days.cancel")}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={emptyStateStyle}>{t("management.days.loading")}</div>
      ) : sortedDays.length === 0 ? (
        <div style={emptyStateStyle}>{t("management.days.empty")}</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {sortedDays.map((day) => {
            const isEditing = editingId === day.id;
            const isCopying = copyDraft.sourceDayId === day.id;
            const isOutOfRange =
              Boolean(day.date) && !isDateInShowRange(day.date, show);

            return (
              <div key={day.id} style={cardStyle}>
                {!isEditing ? (
                  <>
                    <div style={cardHeaderStyle}>
                      <div>
                        <div style={cardTitleStyle}>
                          {day.label || t("management.days.dayFallback")}
                        </div>

                        <div style={cardMetaStyle}>
                          {day.date || t("public.results.dateTbd")}
                        </div>
                      </div>

                      {isOutOfRange && (
                        <div style={warningBadgeStyle}>
                          {t("management.days.outOfRange")}
                        </div>
                      )}
                    </div>

                    <div style={actionRowStyle}>
                      {(access.canManageAssociation ||
                        access.canScoreAssociation) && (
                        <Link
                          to={`/associations/${associationId}/shows/${showId}/days/${day.id}`}
                          style={linkButtonStyle}
                        >
                          {t("management.days.openClasses")}
                        </Link>
                      )}

                      {access.canManageAssociation && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditDay(day)}
                            style={secondaryButtonStyle}
                            disabled={isSaving}
                          >
                            {t("management.days.edit")}
                          </button>

                          <button
                            type="button"
                            onClick={() => startCopyClasses(day)}
                            style={secondaryButtonStyle}
                            disabled={isSaving}
                          >
                            {t("management.days.copyClasses")}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDay(day.id)}
                            style={dangerButtonStyle}
                            disabled={isSaving}
                          >
                            {t("management.days.delete")}
                          </button>
                        </>
                      )}
                    </div>

                    {isCopying && (
                      <div style={copyFormStyle}>
                        <div style={editGridStyle}>
                          <div>
                            <label style={labelStyle}>
                              {t("management.days.copyTargetDateLabel")}
                            </label>
                            <input
                              type="date"
                              value={copyDraft.targetDate}
                              min={rangeStartDate || undefined}
                              max={rangeEndDate || undefined}
                              onChange={(event) =>
                                setCopyDraft((current) => ({
                                  ...current,
                                  targetDate: event.target.value,
                                }))
                              }
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        <div style={actionRowStyle}>
                          <button
                            type="button"
                            onClick={() => handleCopyClassesToDate(day)}
                            style={primaryButtonStyle}
                            disabled={isSaving}
                          >
                            {t("management.days.copyClassesSubmit")}
                          </button>

                          <button
                            type="button"
                            onClick={cancelCopyClasses}
                            style={secondaryButtonStyle}
                            disabled={isSaving}
                          >
                            {t("management.days.cancel")}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={editGridStyle}>
                      <div>
                        <label style={labelStyle}>{t("management.days.dateLabel")}</label>
                        <input
                          type="date"
                          value={draft.date}
                          min={rangeStartDate || undefined}
                          max={rangeEndDate || undefined}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, date: e.target.value }))
                          }
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div style={actionRowStyle}>
                      <button
                        type="button"
                        onClick={saveEdit}
                        style={primaryButtonStyle}
                        disabled={isSaving}
                      >
                        {t("management.days.save")}
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={secondaryButtonStyle}
                        disabled={isSaving}
                      >
                        {t("management.days.cancel")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const headerWrapStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const cardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const cardTitleStyle = {
  fontWeight: 700,
  fontSize: 18,
};

const cardMetaStyle = {
  color: "#64748b",
  marginTop: 6,
};

const actionRowStyle = {
  marginTop: 14,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const actionRowStyleNoMargin = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const inlineFormStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
};

const copyFormStyle = {
  marginTop: 14,
  paddingTop: 14,
  borderTop: "1px solid #e2e8f0",
};

const arenaOverlayListStyle = {
  display: "grid",
  gap: 8,
  paddingTop: 10,
  borderTop: "1px solid #e2e8f0",
};

const arenaOverlayRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const arenaOverlayPickerStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  alignItems: "center",
};

const arenaOverlayNameStyle = {
  minWidth: 120,
  color: "#111827",
  fontWeight: 800,
};

const overlaySponsorSectionStyle = {
  display: "grid",
  gap: 12,
  paddingTop: 12,
  borderTop: "1px solid #e2e8f0",
};

const overlaySponsorTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: 15,
};

const fileInputStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  border: "1px dashed #cbd5e1",
  boxSizing: "border-box",
  background: "#fff",
};

const sponsorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
};

const sponsorCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  display: "grid",
  gap: 8,
  background: "#fff",
};

const sponsorPreviewStyle = {
  minHeight: 76,
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#f8fafc",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 8,
};

const sponsorImageStyle = {
  maxWidth: "100%",
  maxHeight: 62,
  objectFit: "contain",
};

const sponsorMetaStyle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const editGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const labelStyle = {
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
};

const helpTextStyle = {
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.35,
};

const checkboxLabelStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "#111827",
  fontWeight: 800,
};

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "rgba(15, 23, 42, 0.48)",
  boxSizing: "border-box",
};

const modalPanelStyle = {
  width: "min(920px, 100%)",
  maxHeight: "calc(100vh - 32px)",
  overflow: "auto",
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.28)",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  padding: 18,
  borderBottom: "1px solid #e2e8f0",
};

const modalEyebrowStyle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const modalTitleStyle = {
  margin: "4px 0",
  color: "#0f172a",
};

const modalDescriptionStyle = {
  color: "#475569",
};

const iconCloseButtonStyle = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontSize: 24,
  lineHeight: 1,
};

const modalBodyStyle = {
  display: "grid",
  gap: 14,
  padding: 18,
};

const settingsSectionStyle = {
  display: "grid",
  gap: 12,
  padding: 14,
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc",
};

const settingsTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: 18,
};

const modalFooterStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  padding: 18,
  borderTop: "1px solid #e2e8f0",
};

const softNoticeStyle = {
  padding: 12,
  borderRadius: 8,
  border: "1px dashed #cbd5e1",
  color: "#475569",
  background: "#fff",
};

const syncNoticeStyle = (tone) => ({
  margin: "0 18px 18px",
  padding: 12,
  borderRadius: 8,
  border: `1px solid ${tone === "warn" ? "#fdba74" : "#86efac"}`,
  background: tone === "warn" ? "#fff7ed" : "#f0fdf4",
  color: tone === "warn" ? "#9a3412" : "#166534",
  fontWeight: 800,
});

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

const dangerButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #ef4444",
  background: "#fff5f5",
  color: "#991b1b",
  cursor: "pointer",
};

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

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
};

const warningBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #fdba74",
  background: "#fff7ed",
  color: "#9a3412",
  fontWeight: 700,
  fontSize: 13,
};

const syncBadgeStyle = (isCloudReady) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${isCloudReady ? "#86efac" : "#cbd5e1"}`,
  background: isCloudReady ? "#ecfdf5" : "#f8fafc",
  color: isCloudReady ? "#166534" : "#475569",
  fontWeight: 700,
  fontSize: 13,
});

const accessBadgeStyle = (hasManagementAccess) => ({
  display: "inline-flex",
  alignItems: "center",
  marginLeft: 8,
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${hasManagementAccess ? "#86efac" : "#fdba74"}`,
  background: hasManagementAccess ? "#ecfdf5" : "#fff7ed",
  color: hasManagementAccess ? "#166534" : "#9a3412",
  fontWeight: 700,
  fontSize: 13,
});

function formatShowStatus(status, t) {
  if (status === "active") return t("management.shows.statusActive");
  if (status === "completed") return t("management.shows.statusCompleted");
  if (status === "draft") return t("management.shows.statusDraft");
  return "—";
}

function getSyncLabel(cloudStatus, t) {
  if (!cloudStatus.configured) return t("management.sync.local");
  if (cloudStatus.authenticated) return t("management.sync.connected");
  return t("management.sync.disconnected");
}

function normalizeArenaName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function getOverlayArenasForDays(days) {
  const dayList = Array.isArray(days) ? days.filter((day) => day?.id) : [];

  if (!dayList.length) return [];

  let classesByDay = [];

  try {
    classesByDay = await Promise.all(
      dayList.map((day) => getClassesForDayRepository(day.id))
    );
  } catch (error) {
    console.error("Erreur chargement arenas overlay OBS:", error);
    return [];
  }

  const arenasByName = new Map();

  classesByDay.flat().forEach((classItem) => {
    const arena = normalizeArenaName(classItem?.arena);
    if (!arena) return;

    arenasByName.set(arena.toLowerCase(), arena);
  });

  return Array.from(arenasByName.values()).sort((a, b) =>
    a.localeCompare(b)
  );
}

function getOverlayCopyKey(arena = "") {
  const normalizedArena = normalizeArenaName(arena);
  return normalizedArena ? `arena:${normalizedArena.toLowerCase()}` : "general";
}

function getOverlayPath(associationId, showId, arena = "") {
  const path = `/public/associations/${associationId}/shows/${showId}/overlay`;
  const normalizedArena = normalizeArenaName(arena);

  if (!normalizedArena) return path;

  const params = new URLSearchParams({ arena: normalizedArena });
  return `${path}?${params.toString()}`;
}

function getAbsoluteOverlayUrl(associationId, showId, arena = "") {
  const path = getOverlayPath(associationId, showId, arena);
  const origin =
    typeof window === "undefined" || !window.location?.origin
      ? ""
      : window.location.origin;

  return `${origin}${path}`;
}

export default ShowDetailPage;
