import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getClassesForDayRepository,
  saveClassItemRepository,
} from "../../features/classes/classRepository";
import { compareScheduleItemsByStart } from "../../features/classes/classSchedule";
import {
  getAssociationRepository,
  saveAssociationRepository,
} from "../../features/associations/associationRepository";
import {
  flattenSponsorGroups,
  formatSponsorLogoDetails,
  getAssociationSponsorGroups,
  normalizeSponsorGroups,
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
import { hasPublicLivestream } from "../../features/livestream/livestreamEmbed";
import { getPaidWarmupsForDayRepository } from "../../features/paidWarmups/paidWarmupRepository";
import { getPublicShowViewRepository } from "../../features/publication/publicViewRepository";
import {
  getShowRepository,
  saveShowRepository,
} from "../../features/shows/showRepository";
import { appStyles as styles } from "../../styles/appStyles";
import { createId } from "../../utils/createId";
import {
  deleteTvDisplayVideo,
  formatTvDisplayVideoSize,
  uploadTvDisplayVideo,
  validateTvDisplayVideoFile,
} from "../../features/tvDisplay/tvDisplayVideo";

function ShowDetailPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const [association, setAssociation] = useState(null);
  const [show, setShow] = useState(null);
  const [publicView, setPublicView] = useState(null);
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
  const [selectedTvArena, setSelectedTvArena] = useState("");
  const [isLivestreamModalOpen, setIsLivestreamModalOpen] = useState(false);
  const [livestreamDraft, setLivestreamDraft] = useState({
    isLivestreamPublic: false,
    livestreamUrl: "",
    isSchedulePublic: false,
    isTvDisplayPaused: false,
    tvDisplayMessageFr: "",
    tvDisplayMessageEn: "",
    tvDisplayVideoArena: "",
  });
  const [sponsorGroupsDraft, setSponsorGroupsDraft] = useState([]);
  const [hasEditedSponsorGroups, setHasEditedSponsorGroups] = useState(false);
  const [isOptimizingSponsors, setIsOptimizingSponsors] = useState(false);
  const [tvVideoFileDraft, setTvVideoFileDraft] = useState(null);
  const [removeTvVideoDraft, setRemoveTvVideoDraft] = useState(false);
  const [tvVideoUploadProgress, setTvVideoUploadProgress] = useState(0);
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
  const publicShowcaseStatus = useMemo(
    () => buildPublicShowcaseStatus({ show, publicView, t }),
    [publicView, show, t]
  );
  const competitionTvArena = normalizeArenaName(
    livestreamDraft.tvDisplayVideoArena
  );
  const competitionTvDisplayReady = Boolean(
    show?.tvDisplayVideoPath &&
      !removeTvVideoDraft &&
      normalizeArenaName(show?.tvDisplayVideoArena).toLowerCase() ===
        competitionTvArena.toLowerCase()
  );
  const generalTvArenas = useMemo(
    () =>
      overlayArenas.filter(
        (arena) =>
          normalizeArenaName(arena).toLowerCase() !==
          competitionTvArena.toLowerCase()
      ),
    [competitionTvArena, overlayArenas]
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [nextShow, nextAssociation, nextPublicView] = await Promise.all([
        getShowRepository(showId),
        getAssociationRepository(associationId),
        getPublicShowViewRepository(showId),
      ]);
      const nextDays = nextShow
        ? await syncDaysForShowDateRangeRepository(nextShow, { language })
        : await getDaysByShowRepository(showId);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setShow(nextShow);
      setPublicView(nextPublicView);
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
    setSelectedTvArena((currentArena) =>
      generalTvArenas.includes(currentArena)
        ? currentArena
        : generalTvArenas[0] || ""
    );
  }, [generalTvArenas]);

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
      isSchedulePublic: Boolean(show?.isSchedulePublic),
      isTvDisplayPaused: Boolean(show?.isTvDisplayPaused),
      tvDisplayMessageFr: show?.tvDisplayMessageFr || "",
      tvDisplayMessageEn: show?.tvDisplayMessageEn || "",
      tvDisplayVideoArena: show?.tvDisplayVideoArena || "",
    });
    setSponsorGroupsDraft(getAssociationSponsorGroups(association));
    setHasEditedSponsorGroups(false);
    setIsOptimizingSponsors(false);
    setTvVideoFileDraft(null);
    setRemoveTvVideoDraft(false);
    setTvVideoUploadProgress(0);
    setLivestreamMessage("");
    setLivestreamMessageTone("synced");
    setIsLivestreamModalOpen(true);
  };

  const closeLivestreamSettings = () => {
    setIsLivestreamModalOpen(false);
    setCopiedOverlayKey("");
    setLivestreamMessage("");
    setIsOptimizingSponsors(false);
    setTvVideoFileDraft(null);
    setRemoveTvVideoDraft(false);
    setTvVideoUploadProgress(0);
  };

  const handleTvVideoFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) return;

    try {
      validateTvDisplayVideoFile(file);
      setTvVideoFileDraft(file);
      setRemoveTvVideoDraft(false);
      setTvVideoUploadProgress(0);
      setLivestreamMessage("");
    } catch (error) {
      setTvVideoFileDraft(null);
      setLivestreamMessage(error?.message || "Vidéo MP4 invalide.");
      setLivestreamMessageTone("warn");
    }
  };

  const removeTvVideo = () => {
    setTvVideoFileDraft(null);
    setRemoveTvVideoDraft(true);
    setLivestreamMessage("");
  };

  const addSponsorGroup = () => {
    setHasEditedSponsorGroups(true);
    setSponsorGroupsDraft((current) => [
      ...current,
      {
        id: createId("sponsor-level"),
        name: t("management.shows.newSponsorLevel", {
          number: current.length + 1,
        }),
        sortOrder: current.length + 1,
        logos: [],
      },
    ]);
  };

  const updateSponsorGroup = (groupId, updates) => {
    setHasEditedSponsorGroups(true);
    setSponsorGroupsDraft((current) =>
      normalizeSponsorGroups(
        current.map((group) =>
          group.id === groupId ? { ...group, ...updates } : group
        )
      )
    );
  };

  const moveSponsorGroup = (groupId, direction) => {
    setHasEditedSponsorGroups(true);
    setSponsorGroupsDraft((current) => {
      const index = current.findIndex((group) => group.id === groupId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return normalizeSponsorGroups(next);
    });
  };

  const removeSponsorGroup = (groupId) => {
    if (!window.confirm(t("management.shows.removeSponsorLevelConfirm"))) {
      return;
    }
    setHasEditedSponsorGroups(true);
    setSponsorGroupsDraft((current) =>
      normalizeSponsorGroups(current.filter((group) => group.id !== groupId))
    );
  };

  const handleSponsorLogoFilesChange = async (event, groupId) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;

    setHasEditedSponsorGroups(true);
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

      setSponsorGroupsDraft((current) =>
        normalizeSponsorGroups(
          current.map((group) =>
            group.id === groupId
              ? { ...group, logos: [...group.logos, ...nextSponsorLogos] }
              : group
          )
        )
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

  const updateSponsorLogo = (groupId, sponsorId, updates) => {
    setHasEditedSponsorGroups(true);
    setSponsorGroupsDraft((current) =>
      normalizeSponsorGroups(
        current.map((group) =>
          group.id === groupId
            ? {
                ...group,
                logos: group.logos.map((sponsor) =>
                  sponsor.id === sponsorId
                    ? { ...sponsor, ...updates }
                    : sponsor
                ),
              }
            : group
        )
      )
    );
  };

  const removeSponsorLogo = (groupId, sponsorId) => {
    setHasEditedSponsorGroups(true);
    setSponsorGroupsDraft((current) =>
      normalizeSponsorGroups(
        current.map((group) =>
          group.id === groupId
            ? {
                ...group,
                logos: group.logos.filter(
                  (sponsor) => sponsor.id !== sponsorId
                ),
              }
            : group
        )
      )
    );
  };

  const saveLivestreamSettings = async () => {
    if (!show) return;

    const willHaveTvVideo = Boolean(
      tvVideoFileDraft || (show.tvDisplayVideoPath && !removeTvVideoDraft)
    );
    if (
      willHaveTvVideo &&
      !String(livestreamDraft.tvDisplayVideoArena || "").trim()
    ) {
      setLivestreamMessage(
        t("management.shows.tvDisplayVideoArenaRequired")
      );
      setLivestreamMessageTone("warn");
      return;
    }

    const sponsorGroups = normalizeSponsorGroups(sponsorGroupsDraft);
    const currentSponsorGroups = getAssociationSponsorGroups(association);
    const shouldSaveSponsorGroups =
      hasEditedSponsorGroups &&
      association &&
      JSON.stringify(sponsorGroups) !== JSON.stringify(currentSponsorGroups);

    setIsSaving(true);
    try {
      const previousVideoPath = show.tvDisplayVideoPath || "";
      const uploadedVideo = tvVideoFileDraft
        ? await uploadTvDisplayVideo({
            associationId,
            showId,
            file: tvVideoFileDraft,
            onProgress: setTvVideoUploadProgress,
          })
        : null;
      const nextShow = {
        ...show,
        associationId,
        livestreamUrl: livestreamDraft.livestreamUrl,
        isLivestreamPublic: Boolean(livestreamDraft.isLivestreamPublic),
        isSchedulePublic: Boolean(livestreamDraft.isSchedulePublic),
        isTvDisplayPaused: Boolean(livestreamDraft.isTvDisplayPaused),
        tvDisplayMessageFr: livestreamDraft.tvDisplayMessageFr,
        tvDisplayMessageEn: livestreamDraft.tvDisplayMessageEn,
        tvDisplayVideoArena:
          removeTvVideoDraft && !uploadedVideo
            ? ""
            : String(livestreamDraft.tvDisplayVideoArena || "").trim(),
        tvDisplayVideoPath: uploadedVideo
          ? uploadedVideo.path
          : removeTvVideoDraft
            ? ""
            : previousVideoPath,
        tvDisplayVideoName: uploadedVideo
          ? uploadedVideo.name
          : removeTvVideoDraft
            ? ""
            : show.tvDisplayVideoName || "",
        tvDisplayVideoSize: uploadedVideo
          ? uploadedVideo.size
          : removeTvVideoDraft
            ? 0
            : Number(show.tvDisplayVideoSize || 0),
      };
      const savedShow = await saveShowRepository(nextShow);
      let savedAssociation = null;
      let sponsorLogoError = null;
      let videoCleanupError = null;

      if (shouldSaveSponsorGroups) {
        try {
          savedAssociation = await saveAssociationRepository({
            ...association,
            sponsorGroups,
            sponsorLogos: flattenSponsorGroups(sponsorGroups),
          });
        } catch (error) {
          console.error("Erreur sauvegarde commanditaires association:", error);
          sponsorLogoError = error;
        }
      }

      if (
        previousVideoPath &&
        previousVideoPath !== savedShow.tvDisplayVideoPath
      ) {
        try {
          await deleteTvDisplayVideo(previousVideoPath);
        } catch (error) {
          console.error("Erreur suppression ancienne vidéo TV:", error);
          videoCleanupError = error;
        }
      }

      setShow(savedShow);
      setTvVideoFileDraft(null);
      setRemoveTvVideoDraft(false);
      setTvVideoUploadProgress(0);
      setPublicView(await getPublicShowViewRepository(showId));
      if (savedAssociation) {
        setAssociation(savedAssociation);
        setSponsorGroupsDraft(
          getAssociationSponsorGroups(savedAssociation)
        );
        setHasEditedSponsorGroups(false);
      }

      if (sponsorLogoError || videoCleanupError) {
        setLivestreamMessage(
          t("common.localFirstSyncError", {
            message:
              sponsorLogoError?.message || videoCleanupError?.message || "",
          })
        );
        setLivestreamMessageTone("warn");
      } else {
        setLivestreamMessage(formatLocalFirstSyncNotice(savedShow, t));
        setLivestreamMessageTone(getLocalFirstSyncNoticeTone(savedShow));
      }
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

  const copyOverlayDemoLink = async () => {
    const overlayUrl = getAbsoluteOverlayDemoUrl(associationId, showId);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(overlayUrl);
        setCopiedOverlayKey("demo");
        window.setTimeout(() => setCopiedOverlayKey(""), 1800);
      } else {
        window.prompt(t("management.shows.obsOverlayPrompt"), overlayUrl);
      }
    } catch (error) {
      console.error("Erreur copie lien OBS demo:", error);
      window.prompt(t("management.shows.obsOverlayPrompt"), overlayUrl);
    }
  };

  const copyTvDisplayLink = async (arena = "") => {
    const normalizedArena = normalizeArenaName(arena);
    const tvUrl = getAbsoluteTvDisplayUrl(associationId, showId, normalizedArena);
    const copyKey = `tv:${getOverlayCopyKey(normalizedArena)}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tvUrl);
        setCopiedOverlayKey(copyKey);
        window.setTimeout(() => setCopiedOverlayKey(""), 1800);
      } else {
        window.prompt(t("management.shows.tvDisplayPrompt"), tvUrl);
      }
    } catch (error) {
      console.error("Erreur copie lien affichage manège:", error);
      window.prompt(t("management.shows.tvDisplayPrompt"), tvUrl);
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
      const orderedSourceClasses = [...sourceClasses].sort(compareScheduleItemsByStart);

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

        await saveClassItemRepository(copiedClass);
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
          <Link
            to={`/associations/${associationId}/shows/${showId}/schedule`}
            style={linkButtonStyle}
          >
            {t("management.shows.showSchedule")}
          </Link>
          <Link
            to={`/public/associations/${associationId}/shows/${showId}`}
            style={linkButtonStyle}
            target="_blank"
            rel="noreferrer"
          >
            {t("management.shows.publicShowcaseOpen")}
          </Link>
        </div>
        <PublicShowcaseStatusPanel status={publicShowcaseStatus} />
        {show?.isSchedulePublic && (
          <div style={schedulePublicBadgeStyle}>
            {t("management.shows.schedulePublicEnabled")}
          </div>
        )}
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
                    {t("management.shows.publicScheduleTitle")}
                  </h3>
                  <div style={helpTextStyle}>
                    {t("management.shows.publicScheduleHelp")}
                  </div>
                </div>

                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={Boolean(livestreamDraft.isSchedulePublic)}
                    onChange={(event) =>
                      setLivestreamDraft((current) => ({
                        ...current,
                        isSchedulePublic: event.target.checked,
                      }))
                    }
                    disabled={!access.canManageAssociation || isSaving}
                  />
                  <span>{t("management.shows.publicScheduleLabel")}</span>
                </label>

                <Link
                  to={`/associations/${associationId}/shows/${showId}/schedule`}
                  style={linkButtonStyle}
                  onClick={closeLivestreamSettings}
                >
                  {t("management.shows.openSchedule")}
                </Link>
              </section>

              <section
                style={generalTvSectionStyle}
                data-tv-settings="general"
              >
                <div>
                  <h3 style={settingsTitleStyle}>
                    {t("management.shows.tvDisplayTitle")}
                  </h3>
                  <div style={helpTextStyle}>
                    {t("management.shows.tvDisplayHelp")}
                  </div>
                </div>

                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={Boolean(livestreamDraft.isTvDisplayPaused)}
                    onChange={(event) =>
                      setLivestreamDraft((current) => ({
                        ...current,
                        isTvDisplayPaused: event.target.checked,
                      }))
                    }
                    disabled={!access.canManageAssociation || isSaving}
                  />
                  <span>{t("management.shows.tvDisplayPausedLabel")}</span>
                </label>

                <div style={editGridStyle}>
                  <div>
                    <label style={labelStyle}>
                      {t("management.shows.tvDisplayMessageFrLabel")}
                    </label>
                    <textarea
                      value={livestreamDraft.tvDisplayMessageFr}
                      onChange={(event) =>
                        setLivestreamDraft((current) => ({
                          ...current,
                          tvDisplayMessageFr: event.target.value,
                        }))
                      }
                      placeholder={t("management.shows.tvDisplayMessageFrPlaceholder")}
                      style={textareaStyle}
                      disabled={!access.canManageAssociation || isSaving}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
                      {t("management.shows.tvDisplayMessageEnLabel")}
                    </label>
                    <textarea
                      value={livestreamDraft.tvDisplayMessageEn}
                      onChange={(event) =>
                        setLivestreamDraft((current) => ({
                          ...current,
                          tvDisplayMessageEn: event.target.value,
                        }))
                      }
                      placeholder={t("management.shows.tvDisplayMessageEnPlaceholder")}
                      style={textareaStyle}
                      disabled={!access.canManageAssociation || isSaving}
                    />
                  </div>
                </div>

                <div style={arenaOverlayRowStyle}>
                  <span style={arenaOverlayNameStyle}>
                    {t("management.shows.tvDisplayGeneralTitle")}
                  </span>
                  <Link
                    to={getTvDisplayPath(associationId, showId)}
                    style={linkButtonStyle}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("management.shows.openTvDisplayGeneral")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => copyTvDisplayLink()}
                    style={secondaryButtonStyle}
                  >
                    {copiedOverlayKey === "tv:general"
                      ? t("common.linkCopied")
                      : t("management.shows.copyTvDisplayLink")}
                  </button>
                </div>

                {generalTvArenas.length > 0 ? (
                  <div style={arenaOverlayListStyle}>
                    <label style={labelStyle}>
                      {t("management.shows.tvDisplayArenaTitle")}
                    </label>
                    <div style={arenaOverlayPickerStyle}>
                      <select
                        value={selectedTvArena}
                        onChange={(event) =>
                          setSelectedTvArena(event.target.value)
                        }
                        style={inputStyle}
                      >
                        {generalTvArenas.map((arena) => (
                          <option key={arena} value={arena}>
                            {arena}
                          </option>
                        ))}
                      </select>
                      <Link
                        to={getTvDisplayPath(
                          associationId,
                          showId,
                          selectedTvArena
                        )}
                        style={linkButtonStyle}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("management.shows.openTvDisplayArena")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => copyTvDisplayLink(selectedTvArena)}
                        style={secondaryButtonStyle}
                      >
                        {copiedOverlayKey ===
                        `tv:${getOverlayCopyKey(selectedTvArena)}`
                          ? t("common.linkCopied")
                          : t("management.shows.copyTvDisplayArenaLink")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section
                style={competitionTvSectionStyle}
                data-tv-settings="competition"
              >
                <div style={competitionTvHeaderStyle}>
                  <div>
                    <div style={competitionTvEyebrowStyle}>
                      {t("management.shows.tvDisplayCompetitionEyebrow")}
                    </div>
                    <h3 style={competitionTvTitleStyle}>
                      {t("management.shows.tvDisplayVideoTitle")}
                    </h3>
                    <div style={competitionTvHelpStyle}>
                      {t("management.shows.tvDisplayVideoHelp")}
                    </div>
                  </div>
                  <span style={competitionTvBadgeStyle}>
                    {t("management.shows.tvDisplayCompetitionBadge")}
                  </span>
                </div>

                <div style={competitionTvSetupGridStyle}>
                  <div style={competitionTvStepStyle}>
                    <div style={competitionTvStepNumberStyle}>1</div>
                    <div style={competitionTvStepContentStyle}>
                      <label style={competitionTvStepLabelStyle}>
                        {t("management.shows.tvDisplayVideoArenaLabel")}
                      </label>
                      <input
                        type="text"
                        list="tv-display-video-arenas"
                        value={livestreamDraft.tvDisplayVideoArena}
                        onChange={(event) =>
                          setLivestreamDraft((current) => ({
                            ...current,
                            tvDisplayVideoArena: event.target.value,
                          }))
                        }
                        placeholder={t(
                          "management.shows.tvDisplayVideoArenaPlaceholder"
                        )}
                        style={competitionTvInputStyle}
                        disabled={!access.canManageAssociation || isSaving}
                      />
                      <datalist id="tv-display-video-arenas">
                        {overlayArenas.map((arena) => (
                          <option key={arena} value={arena} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div style={competitionTvStepStyle}>
                    <div style={competitionTvStepNumberStyle}>2</div>
                    <div style={competitionTvStepContentStyle}>
                      <label style={competitionTvStepLabelStyle}>
                        {t("management.shows.tvDisplayVideoFileLabel")}
                      </label>
                      <input
                        type="file"
                        accept="video/mp4,.mp4"
                        onChange={handleTvVideoFileChange}
                        style={competitionTvFileInputStyle}
                        disabled={!access.canManageAssociation || isSaving}
                      />
                    </div>
                  </div>
                </div>

                {tvVideoFileDraft ? (
                  <div style={competitionVideoFileSummaryStyle}>
                    <span>
                      {t("management.shows.tvDisplayVideoSelected")}: {" "}
                      <strong>{tvVideoFileDraft.name}</strong>
                      {tvVideoFileDraft.size
                        ? ` · ${formatTvDisplayVideoSize(tvVideoFileDraft.size)}`
                        : ""}
                      {isSaving && tvVideoUploadProgress > 0
                        ? ` · ${Math.round(tvVideoUploadProgress)} %`
                        : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTvVideoFileDraft(null)}
                      style={competitionSecondaryButtonStyle}
                      disabled={isSaving}
                    >
                      {t("management.shows.tvDisplayVideoCancelSelection")}
                    </button>
                  </div>
                ) : show?.tvDisplayVideoPath && !removeTvVideoDraft ? (
                  <div style={competitionVideoFileSummaryStyle}>
                    <span>
                      {t("management.shows.tvDisplayVideoCurrent")}: {" "}
                      <strong>{show.tvDisplayVideoName || "video.mp4"}</strong>
                      {show.tvDisplayVideoSize
                        ? ` · ${formatTvDisplayVideoSize(
                            show.tvDisplayVideoSize
                          )}`
                        : ""}
                    </span>
                    <button
                      type="button"
                      onClick={removeTvVideo}
                      style={competitionDangerButtonStyle}
                      disabled={isSaving}
                    >
                      {t("management.shows.tvDisplayVideoRemove")}
                    </button>
                  </div>
                ) : (
                  <div style={competitionEmptyVideoStyle}>
                    {removeTvVideoDraft
                      ? t("management.shows.tvDisplayVideoWillRemove")
                      : t("management.shows.tvDisplayVideoEmpty")}
                  </div>
                )}

                <div style={competitionTvLinkPanelStyle}>
                  <div style={competitionTvStepNumberStyle}>3</div>
                  <div style={competitionTvStepContentStyle}>
                    <div style={competitionTvStepLabelStyle}>
                      {t("management.shows.tvDisplayCompetitionLinkTitle")}
                    </div>
                    {competitionTvArena && competitionTvDisplayReady ? (
                      <div style={competitionTvLinkRowStyle}>
                        <span style={competitionTvArenaPillStyle}>
                          {competitionTvArena}
                        </span>
                        <Link
                          to={getTvDisplayPath(
                            associationId,
                            showId,
                            competitionTvArena
                          )}
                          style={competitionPrimaryLinkStyle}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("management.shows.openTvDisplayCompetition")}
                        </Link>
                        <button
                          type="button"
                          onClick={() => copyTvDisplayLink(competitionTvArena)}
                          style={competitionSecondaryButtonStyle}
                        >
                          {copiedOverlayKey ===
                          `tv:${getOverlayCopyKey(competitionTvArena)}`
                            ? t("common.linkCopied")
                            : t("management.shows.copyTvDisplayCompetition")}
                        </button>
                      </div>
                    ) : competitionTvArena ? (
                      <div style={competitionTvLinkHintStyle}>
                        {t("management.shows.tvDisplayCompetitionSaveHint")}
                      </div>
                    ) : (
                      <div style={competitionTvLinkHintStyle}>
                        {t("management.shows.tvDisplayCompetitionLinkHint")}
                      </div>
                    )}
                  </div>
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

                <div style={arenaOverlayRowStyle}>
                  <span style={arenaOverlayNameStyle}>
                    {t("management.shows.obsOverlayDemoTitle")}
                  </span>
                  <Link
                    to={getOverlayDemoPath(associationId, showId)}
                    style={linkButtonStyle}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("management.shows.openObsOverlayDemo")}
                  </Link>
                  <button
                    type="button"
                    onClick={copyOverlayDemoLink}
                    style={secondaryButtonStyle}
                  >
                    {copiedOverlayKey === "demo"
                      ? t("common.linkCopied")
                      : t("management.shows.copyObsOverlayDemoLink")}
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

                  {access.canManageAssociation ? (
                    <div style={actionRowStyleNoMargin}>
                      <button
                        type="button"
                        onClick={addSponsorGroup}
                        style={primaryButtonStyle}
                        disabled={isSaving || isOptimizingSponsors}
                      >
                        {t("management.shows.addSponsorLevel")}
                      </button>
                    </div>
                  ) : null}

                  {isOptimizingSponsors ? (
                    <div style={softNoticeStyle}>
                      {t("management.shows.sponsorLogosOptimizing")}
                    </div>
                  ) : null}

                  {sponsorGroupsDraft.length ? (
                    <div style={sponsorLevelListStyle}>
                      {sponsorGroupsDraft.map((group, groupIndex) => (
                        <section key={group.id} style={sponsorLevelCardStyle}>
                          <div style={sponsorLevelHeaderStyle}>
                            <input
                              value={group.name}
                              onChange={(event) =>
                                updateSponsorGroup(group.id, {
                                  name: event.target.value,
                                })
                              }
                              placeholder={t(
                                "management.shows.sponsorLevelName"
                              )}
                              style={sponsorLevelNameInputStyle}
                              disabled={
                                !access.canManageAssociation ||
                                isSaving ||
                                isOptimizingSponsors
                              }
                            />
                            <div style={sponsorLevelActionsStyle}>
                              <button
                                type="button"
                                onClick={() => moveSponsorGroup(group.id, -1)}
                                disabled={
                                  !access.canManageAssociation ||
                                  groupIndex === 0 ||
                                  isSaving ||
                                  isOptimizingSponsors
                                }
                                style={secondaryButtonStyle}
                              >
                                {t("management.paidWarmup.moveUp")}
                              </button>
                              <button
                                type="button"
                                onClick={() => moveSponsorGroup(group.id, 1)}
                                disabled={
                                  !access.canManageAssociation ||
                                  groupIndex === sponsorGroupsDraft.length - 1 ||
                                  isSaving ||
                                  isOptimizingSponsors
                                }
                                style={secondaryButtonStyle}
                              >
                                {t("management.paidWarmup.moveDown")}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeSponsorGroup(group.id)}
                                disabled={
                                  !access.canManageAssociation ||
                                  isSaving ||
                                  isOptimizingSponsors
                                }
                                style={dangerButtonStyle}
                              >
                                {t("management.shows.removeSponsorLevel")}
                              </button>
                            </div>
                          </div>

                          <label style={sponsorImportLabelStyle}>
                            {t("management.shows.importSponsorLogos", {
                              level:
                                group.name ||
                                t("management.shows.sponsorLevelFallback"),
                            })}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(event) =>
                                handleSponsorLogoFilesChange(event, group.id)
                              }
                              style={fileInputStyle}
                              disabled={
                                !access.canManageAssociation ||
                                isSaving ||
                                isOptimizingSponsors
                              }
                            />
                          </label>

                          {group.logos.length ? (
                            <div style={sponsorGridStyle}>
                              {group.logos.map((sponsor) => {
                                const logoDetails =
                                  formatSponsorLogoDetails(sponsor);

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
                                        updateSponsorLogo(
                                          group.id,
                                          sponsor.id,
                                          { name: event.target.value }
                                        )
                                      }
                                      placeholder={t(
                                        "management.shows.sponsorName"
                                      )}
                                      style={inputStyle}
                                      disabled={
                                        !access.canManageAssociation ||
                                        isSaving ||
                                        isOptimizingSponsors
                                      }
                                    />
                                    {logoDetails ? (
                                      <div style={sponsorMetaStyle}>
                                        {logoDetails}
                                      </div>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeSponsorLogo(group.id, sponsor.id)
                                      }
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
                              {t("management.shows.noSponsorLogosInLevel")}
                            </div>
                          )}
                        </section>
                      ))}
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

function PublicShowcaseStatusPanel({ status }) {
  if (!status) return null;

  return (
    <section style={publicStatusPanelStyle(status.tone)}>
      <div style={publicStatusHeaderStyle}>
        <div>
          <div style={publicStatusEyebrowStyle}>{status.eyebrow}</div>
          <div style={publicStatusTitleStyle}>{status.title}</div>
          <div style={publicStatusHelpStyle}>{status.help}</div>
        </div>
        <span style={publicStatusBadgeStyle(status.tone)}>{status.badge}</span>
      </div>
      <div style={publicStatusGridStyle}>
        {status.items.map((item) => (
          <div key={item.label} style={publicStatusItemStyle(item.tone)}>
            <span style={publicStatusItemLabelStyle}>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildPublicShowcaseStatus({ show, publicView, t }) {
  const isActive = show?.status === "active";
  const scheduleCount = publicView?.scheduleItemCount || 0;
  const liveCount = publicView?.liveClassCount || 0;
  const scoresheetCount = publicView?.publishedClassCount || 0;
  const resultCount = publicView?.publishedResultClassCount || 0;
  const livestreamReady = isActive && hasPublicLivestream(show);
  const hasPublicContent =
    scheduleCount > 0 ||
    liveCount > 0 ||
    scoresheetCount > 0 ||
    resultCount > 0 ||
    livestreamReady;
  const tone = !isActive ? "blocked" : hasPublicContent ? "ready" : "partial";
  const toneKey = getPublicShowcaseToneKey(tone);
  const yes = t("management.shows.publicShowcaseYes");
  const no = t("management.shows.publicShowcaseNo");
  const countValue = (count) =>
    count > 0 ? t("management.shows.publicShowcaseCount", { count }) : no;

  return {
    tone,
    eyebrow: t("management.shows.publicShowcaseStatus"),
    title: t(`management.shows.publicShowcase${toneKey}`),
    badge: t(`management.shows.publicShowcase${toneKey}Badge`),
    help: t(`management.shows.publicShowcase${toneKey}Help`),
    items: [
      {
        label: t("management.shows.publicShowcaseShowActive"),
        value: isActive ? yes : no,
        tone: isActive ? "ready" : "blocked",
      },
      {
        label: t("management.shows.publicShowcaseSchedule"),
        value: countValue(scheduleCount),
        tone:
          scheduleCount > 0 ? "ready" : show?.isSchedulePublic ? "partial" : "muted",
      },
      {
        label: t("management.shows.publicShowcaseLive"),
        value: countValue(liveCount),
        tone: liveCount > 0 ? "ready" : "muted",
      },
      {
        label: t("management.shows.publicShowcaseLivestream"),
        value: livestreamReady ? yes : no,
        tone:
          livestreamReady ? "ready" : show?.isLivestreamPublic ? "partial" : "muted",
      },
      {
        label: t("management.shows.publicShowcaseScoresheets"),
        value: countValue(scoresheetCount),
        tone: scoresheetCount > 0 ? "ready" : "muted",
      },
      {
        label: t("management.shows.publicShowcaseResults"),
        value: countValue(resultCount),
        tone: resultCount > 0 ? "ready" : "muted",
      },
    ],
  };
}

function getPublicShowcaseToneKey(tone) {
  if (tone === "ready") return "Ready";
  if (tone === "blocked") return "Blocked";
  return "Partial";
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

const publicStatusPanelStyle = (tone) => {
  const colors = getPublicStatusColors(tone);

  return {
    marginTop: 14,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    background: colors.background,
    padding: 12,
    display: "grid",
    gap: 10,
  };
};

const publicStatusHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const publicStatusEyebrowStyle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const publicStatusTitleStyle = {
  color: "#0f172a",
  fontWeight: 900,
  fontSize: 17,
  marginTop: 2,
};

const publicStatusHelpStyle = {
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.35,
  marginTop: 3,
};

const publicStatusBadgeStyle = (tone) => {
  const colors = getPublicStatusColors(tone);

  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${colors.strongBorder}`,
    background: colors.badgeBackground,
    color: colors.color,
    fontWeight: 850,
    fontSize: 13,
  };
};

const publicStatusGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 8,
};

const publicStatusItemStyle = (tone) => {
  const colors = getPublicStatusColors(tone);

  return {
    display: "grid",
    gap: 2,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    background: "#fff",
    padding: 9,
    color: colors.color,
    minWidth: 0,
  };
};

const publicStatusItemLabelStyle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
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

const generalTvSectionStyle = {
  display: "grid",
  gap: 14,
  padding: 18,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  borderLeft: "5px solid #64748b",
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
};

const competitionTvSectionStyle = {
  display: "grid",
  gap: 16,
  padding: 20,
  borderRadius: 16,
  border: "2px solid #0f766e",
  background: "linear-gradient(135deg, #0f172a 0%, #164e63 100%)",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.18)",
};

const competitionTvHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
};

const competitionTvEyebrowStyle = {
  marginBottom: 5,
  color: "#5eead4",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const competitionTvTitleStyle = {
  margin: 0,
  color: "#fff",
  fontSize: 23,
  lineHeight: 1.1,
};

const competitionTvHelpStyle = {
  maxWidth: 680,
  marginTop: 7,
  color: "#cbd5e1",
  fontSize: 14,
  lineHeight: 1.45,
};

const competitionTvBadgeStyle = {
  padding: "7px 11px",
  borderRadius: 999,
  border: "1px solid rgba(94, 234, 212, 0.5)",
  background: "rgba(20, 184, 166, 0.18)",
  color: "#99f6e4",
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const competitionTvSetupGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const competitionTvStepStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(255, 255, 255, 0.14)",
  background: "rgba(255, 255, 255, 0.07)",
};

const competitionTvStepNumberStyle = {
  flex: "0 0 30px",
  width: 30,
  height: 30,
  display: "grid",
  placeItems: "center",
  borderRadius: 999,
  background: "#f4d98c",
  color: "#17252c",
  fontSize: 15,
  fontWeight: 950,
};

const competitionTvStepContentStyle = {
  flex: "1 1 auto",
  minWidth: 0,
  display: "grid",
  gap: 8,
};

const competitionTvStepLabelStyle = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
};

const competitionTvInputStyle = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 9,
  border: "1px solid #94a3b8",
  background: "#fff",
  color: "#0f172a",
  boxSizing: "border-box",
  fontSize: 15,
  fontWeight: 750,
};

const competitionTvFileInputStyle = {
  ...competitionTvInputStyle,
  padding: 8,
  borderStyle: "dashed",
};

const competitionVideoFileSummaryStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  padding: 13,
  borderRadius: 10,
  border: "1px solid rgba(94, 234, 212, 0.4)",
  background: "rgba(15, 118, 110, 0.24)",
  color: "#ccfbf1",
};

const competitionEmptyVideoStyle = {
  padding: 13,
  borderRadius: 10,
  border: "1px dashed rgba(203, 213, 225, 0.45)",
  background: "rgba(255, 255, 255, 0.05)",
  color: "#cbd5e1",
};

const competitionTvLinkPanelStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(244, 217, 140, 0.42)",
  background: "rgba(244, 217, 140, 0.09)",
};

const competitionTvLinkRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  flexWrap: "wrap",
};

const competitionTvArenaPillStyle = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.12)",
  color: "#fff",
  fontWeight: 950,
};

const competitionPrimaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 9,
  border: "1px solid #f4d98c",
  background: "#f4d98c",
  color: "#17252c",
  textDecoration: "none",
  fontWeight: 900,
};

const competitionSecondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 9,
  border: "1px solid rgba(255, 255, 255, 0.35)",
  background: "rgba(255, 255, 255, 0.08)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 850,
};

const competitionDangerButtonStyle = {
  ...competitionSecondaryButtonStyle,
  border: "1px solid rgba(252, 165, 165, 0.65)",
  background: "rgba(127, 29, 29, 0.28)",
  color: "#fecaca",
};

const competitionTvLinkHintStyle = {
  color: "#fde68a",
  fontSize: 13,
  fontWeight: 800,
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

const sponsorLevelListStyle = {
  display: "grid",
  gap: 14,
};

const sponsorLevelCardStyle = {
  display: "grid",
  gap: 12,
  padding: 14,
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#f8fafc",
};

const sponsorLevelHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const sponsorLevelNameInputStyle = {
  minWidth: 220,
  flex: "1 1 280px",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #94a3b8",
  background: "#fff",
  color: "#0f172a",
  fontSize: 17,
  fontWeight: 850,
  boxSizing: "border-box",
};

const sponsorLevelActionsStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const sponsorImportLabelStyle = {
  display: "grid",
  gap: 6,
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
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

const textareaStyle = {
  ...inputStyle,
  minHeight: 86,
  resize: "vertical",
  fontFamily: "inherit",
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

const schedulePublicBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  marginTop: 10,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #93c5fd",
  background: "#eff6ff",
  color: "#1d4ed8",
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

function getPublicStatusColors(tone) {
  if (tone === "ready") {
    return {
      border: "#bbf7d0",
      strongBorder: "#86efac",
      background: "#f0fdf4",
      badgeBackground: "#dcfce7",
      color: "#166534",
    };
  }

  if (tone === "blocked") {
    return {
      border: "#fed7aa",
      strongBorder: "#fdba74",
      background: "#fff7ed",
      badgeBackground: "#ffedd5",
      color: "#9a3412",
    };
  }

  if (tone === "partial") {
    return {
      border: "#fde68a",
      strongBorder: "#facc15",
      background: "#fefce8",
      badgeBackground: "#fef9c3",
      color: "#854d0e",
    };
  }

  return {
    border: "#e2e8f0",
    strongBorder: "#cbd5e1",
    background: "#f8fafc",
    badgeBackground: "#f8fafc",
    color: "#475569",
  };
}

function normalizeArenaName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function getOverlayArenasForDays(days) {
  const dayList = Array.isArray(days) ? days.filter((day) => day?.id) : [];

  if (!dayList.length) return [];

  let scheduleItemsByDay = [];

  try {
    scheduleItemsByDay = await Promise.all(
      dayList.map(async (day) => {
        const [classes, warmups] = await Promise.all([
          getClassesForDayRepository(day.id),
          getPaidWarmupsForDayRepository(day.id),
        ]);

        return [...classes, ...warmups];
      })
    );
  } catch (error) {
    console.error("Erreur chargement arenas overlay OBS:", error);
    return [];
  }

  const arenasByName = new Map();

  scheduleItemsByDay.flat().forEach((item) => {
    const arena = normalizeArenaName(item?.arena);
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

function getOverlayDemoPath(associationId, showId) {
  const path = `/public/associations/${associationId}/shows/${showId}/overlay`;
  const params = new URLSearchParams({ demo: "1" });

  return `${path}?${params.toString()}`;
}

function getTvDisplayPath(associationId, showId, arena = "") {
  const path = `/public/associations/${associationId}/shows/${showId}/tv`;
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

function getAbsoluteOverlayDemoUrl(associationId, showId) {
  const path = getOverlayDemoPath(associationId, showId);
  const origin =
    typeof window === "undefined" || !window.location?.origin
      ? ""
      : window.location.origin;

  return `${origin}${path}`;
}

function getAbsoluteTvDisplayUrl(associationId, showId, arena = "") {
  const path = getTvDisplayPath(associationId, showId, arena);
  const origin =
    typeof window === "undefined" || !window.location?.origin
      ? ""
      : window.location.origin;

  return `${origin}${path}`;
}

export default ShowDetailPage;
