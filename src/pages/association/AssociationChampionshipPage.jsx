import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAssociationRepository } from "../../features/associations/associationRepository";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import {
  getClassFullDataRepository,
  getClassesForDayRepository,
} from "../../features/classes/classRepository";
import {
  applyChampionshipEventLabels,
  buildChampionshipDisqualificationKey,
  buildChampionshipDatasetFromImports,
  buildChampionshipImportBatchFromCsv,
  getChampionshipIncludedShows,
  buildChampionshipResultDuplicateKey,
  isChampionshipRowIgnored,
  normalizeChampionshipCorrections,
} from "../../features/championship/championshipStandings";
import {
  getLatestChampionshipSeasonRepository,
  saveChampionshipSeasonRepository,
} from "../../features/championship/championshipRepository";
import {
  buildDefaultChampionshipUpdateCampaignForm,
  getChampionshipUpdateSubscriberSummaryRepository,
  sendChampionshipUpdateCampaignRepository,
  validateChampionshipUpdateCampaignForm,
} from "../../features/championship/championshipUpdateSubscriptionRepository";
import {
  buildShowScoreChampionshipImportBatch,
  buildShowScoreChampionshipImportPreview,
  getShowScoreChampionshipSelectionSummary,
} from "../../features/championship/showScoreChampionshipImport";
import {
  formatLocalFirstSyncNotice,
  getLocalFirstSyncNoticeTone,
} from "../../features/cloud/localFirstSyncMessages";
import { getDaysByShowRepository } from "../../features/days/dayRepository";
import { formatChampionshipPoints } from "../../features/championship/championshipPoints";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { getShowsByAssociationRepository } from "../../features/shows/showRepository";
import { appStyles as styles } from "../../styles/appStyles";
import {
  buildChampionshipPdfFileName,
  generateChampionshipPdf,
} from "../../utils/generateChampionshipPdf";
import {
  CHAMPIONSHIP_RULE_TEXT_MAX_LENGTH,
  normalizeChampionshipRules,
} from "../../features/championship/championshipRules";

function AssociationChampionshipPage() {
  const { associationId } = useParams();
  const { t, language } = useTranslation();
  const access = useAssociationAccess(associationId);
  const [association, setAssociation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [season, setSeason] = useState(null);
  const [seasonTitle, setSeasonTitle] = useState("Championnat de saison");
  const [seasonYear, setSeasonYear] = useState(String(new Date().getFullYear()));
  const [seasonStatus, setSeasonStatus] = useState("draft");
  const [rulesStatement, setRulesStatement] = useState("");
  const [pointsExplanation, setPointsExplanation] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [resetFiles, setResetFiles] = useState([]);
  const [resetInputKey, setResetInputKey] = useState(0);
  const [preview, setPreview] = useState(null);
  const [showScoreImportPreview, setShowScoreImportPreview] = useState(null);
  const [showScoreExcludedClassKeys, setShowScoreExcludedClassKeys] = useState([]);
  const [dqForm, setDqForm] = useState({
    classId: "",
    eventKey: "",
    resultKey: "",
    reason: "",
  });
  const [dqErrorMessage, setDqErrorMessage] = useState("");
  const [subscriberSummary, setSubscriberSummary] = useState({
    ok: false,
    activeCount: 0,
    totalCount: 0,
  });
  const [isLoadingSubscriberSummary, setIsLoadingSubscriberSummary] =
    useState(false);
  const [campaignForm, setCampaignForm] = useState(() =>
    buildDefaultChampionshipUpdateCampaignForm({
      seasonTitle: "Championnat de saison",
      seasonYear: String(new Date().getFullYear()),
      t,
      language,
    })
  );
  const [campaignErrors, setCampaignErrors] = useState({});
  const [campaignStatus, setCampaignStatus] = useState({
    tone: "",
    message: "",
  });
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [eventLabels, setEventLabels] = useState({});
  const [eventOrder, setEventOrder] = useState({});
  const [pendingDuplicateImport, setPendingDuplicateImport] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isReadingReset, setIsReadingReset] = useState(false);
  const [isLoadingShowScoreImport, setIsLoadingShowScoreImport] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [nextAssociation, nextSeason, nextSubscriberSummary] = await Promise.all([
        getAssociationRepository(associationId),
        Promise.resolve(getLatestChampionshipSeasonRepository(associationId)),
        getChampionshipUpdateSubscriberSummaryRepository(associationId),
      ]);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setSeason(nextSeason);
      setSubscriberSummary(nextSubscriberSummary);
      if (nextSeason) {
        const nextEventLabels = nextSeason.publicEventLabels || {};
        const nextEventOrder = buildEventOrderSettings(
          getChampionshipIncludedShows(nextSeason),
          nextSeason.publicEventOrder || {}
        );
        const nextPreview = applyChampionshipEventLabels(
          nextSeason,
          nextEventLabels,
          nextEventOrder
        );

        setSeasonTitle(nextSeason.title || "Championnat de saison");
        setSeasonYear(nextSeason.year || String(new Date().getFullYear()));
        setSeasonStatus(nextSeason.status || "draft");
        const nextRules = normalizeChampionshipRules(nextSeason);
        setRulesStatement(nextRules.rulesStatement);
        setPointsExplanation(nextRules.pointsExplanation);
        setEventLabels(nextEventLabels);
        setEventOrder(nextEventOrder);
        setPreview(nextPreview);
        setCampaignForm(
          buildDefaultChampionshipUpdateCampaignForm({
            seasonTitle: nextSeason.title || "Championnat de saison",
            seasonYear: nextSeason.year || String(new Date().getFullYear()),
            t,
            language,
          })
        );
      }
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [associationId]);

  const canManage = access.canManageAssociation;
  const validation = preview?.validation || null;
  const classSummaries = useMemo(
    () => (Array.isArray(preview?.classes) ? preview.classes : []),
    [preview]
  );
  const technicalShows = useMemo(
    () => getChampionshipIncludedShows(preview),
    [preview]
  );
  const showScoreSelection = useMemo(
    () =>
      getShowScoreChampionshipSelectionSummary(
        showScoreImportPreview,
        showScoreExcludedClassKeys
      ),
    [showScoreImportPreview, showScoreExcludedClassKeys]
  );
  const championshipCorrections = useMemo(
    () => normalizeChampionshipCorrections(preview?.corrections || {}),
    [preview]
  );

  const updateSeasonTitle = (value) => {
    setSeasonTitle(value);
    setSaveMessage("");
  };

  const updateSeasonYear = (value) => {
    setSeasonYear(value);
    setSaveMessage("");
  };

  const updateSeasonStatus = (value) => {
    setSeasonStatus(value);
    setSaveMessage("");
  };

  const updateRulesStatement = (value) => {
    setRulesStatement(value);
    setSaveMessage("");
  };

  const updatePointsExplanation = (value) => {
    setPointsExplanation(value);
    setSaveMessage("");
  };

  const rebuildPreviewFromImports = (
    imports,
    labels = eventLabels,
    order = eventOrder,
    nextStatus = seasonStatus,
    corrections = preview?.corrections || season?.corrections || {}
  ) => {
    const nextEventLabels = sanitizeEventLabels(labels);
    const dataset = buildChampionshipDatasetFromImports({
      imports,
      corrections,
      seasonTitle,
      year: seasonYear,
      status: nextStatus,
    });
    const nextEventOrder = buildEventOrderSettings(
      getChampionshipIncludedShows(dataset),
      order
    );

    return applyChampionshipEventLabels(
      {
        ...dataset,
        id: season?.id || preview?.id || "",
        associationId,
      },
      nextEventLabels,
      nextEventOrder
    );
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const text = await readFileText(file);
      setCsvText(text);
    } catch (error) {
      setErrorMessage(error?.message || t("championship.admin.fileReadFailed"));
    }
  };

  const handleResetFilesChange = (event) => {
    const files = Array.from(event.target.files || []).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setResetFiles(files);
    setErrorMessage("");
    setSaveMessage("");
  };

  const commitImportBatches = (importBatches, { replace = false } = {}) => {
    const nextImports = replace
      ? importBatches
      : [...getPreviewImports(preview), ...importBatches];
    const nextEventLabels = sanitizeEventLabels(eventLabels);
    const nextPreview = rebuildPreviewFromImports(
      nextImports,
      nextEventLabels,
      eventOrder
    );
    setEventLabels(nextEventLabels);
    setEventOrder(nextPreview.publicEventOrder || {});
    setPreview(nextPreview);
    setPendingDuplicateImport(null);
    setCsvText("");
    setFileName("");
    setFileInputKey((current) => current + 1);
    if (importBatches.some((importBatch) => importBatch?.sourceType === "showscore")) {
      setShowScoreImportPreview(null);
      setShowScoreExcludedClassKeys([]);
    }
    if (replace) {
      setResetFiles([]);
      setResetInputKey((current) => current + 1);
    }
  };

  const commitImportBatch = (importBatch) => {
    commitImportBatches([importBatch]);
  };

  const addCsvToSeason = () => {
    setErrorMessage("");
    setSaveMessage("");

    try {
      const importBatch = buildChampionshipImportBatchFromCsv({
        csvText,
        fileName,
      });
      const duplicates = findDuplicateRowsForImports(
        getPreviewImports(preview),
        [importBatch]
      );

      if (duplicates.length > 0) {
        setPendingDuplicateImport({
          mode: "append",
          importBatches: [importBatch],
          duplicates,
        });
        return;
      }

      commitImportBatch(importBatch);
    } catch (error) {
      setErrorMessage(error?.message || t("championship.admin.analysisFailed"));
    }
  };

  const analyzeShowScoreResults = async () => {
    setIsLoadingShowScoreImport(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const classDataItems = await loadAssociationShowScoreClassData(associationId);
      const nextPreview = buildShowScoreChampionshipImportPreview({
        association,
        classDataItems,
      });

      setShowScoreImportPreview(nextPreview);
      setShowScoreExcludedClassKeys(nextPreview.defaultExcludedClassKeys || []);

      if (!nextPreview.rows.length) {
        setSaveMessage(t("championship.admin.showScoreImportEmpty"));
      }
    } catch (error) {
      setErrorMessage(
        error?.message || t("championship.admin.showScoreImportFailed")
      );
    } finally {
      setIsLoadingShowScoreImport(false);
    }
  };

  const toggleShowScoreClassInclusion = (classKey, include) => {
    setShowScoreExcludedClassKeys((current) => {
      const keys = new Set(current);

      if (include) {
        keys.delete(classKey);
      } else {
        keys.add(classKey);
      }

      return Array.from(keys);
    });
    setSaveMessage("");
  };

  const addShowScoreResultsToSeason = () => {
    if (!showScoreImportPreview) return;

    setErrorMessage("");
    setSaveMessage("");

    const selection = getShowScoreChampionshipSelectionSummary(
      showScoreImportPreview,
      showScoreExcludedClassKeys
    );

    if (selection.selectedRowCount <= 0) {
      setErrorMessage(t("championship.admin.showScoreImportNoSelectedRows"));
      return;
    }

    const importBatch = buildShowScoreChampionshipImportBatch({
      preview: showScoreImportPreview,
      excludedClassKeys: showScoreExcludedClassKeys,
    });
    const duplicates = findDuplicateRowsForImports(
      getPreviewImports(preview),
      [importBatch]
    );

    if (duplicates.length > 0) {
      setPendingDuplicateImport({
        mode: "append",
        importBatches: [importBatch],
        duplicates,
      });
      return;
    }

    commitImportBatch(importBatch);
  };

  const reimportAllCsvFiles = async () => {
    if (!resetFiles.length) return;

    const confirmed = window.confirm(t("championship.admin.resetImportConfirm"));
    if (!confirmed) return;

    setIsReadingReset(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const importBatches = [];

      for (const file of resetFiles) {
        const text = await readFileText(file);
        importBatches.push(
          buildChampionshipImportBatchFromCsv({
            csvText: text,
            fileName: file.name,
          })
        );
      }

      const duplicates = findDuplicateRowsForImports([], importBatches);

      if (duplicates.length > 0) {
        setPendingDuplicateImport({
          mode: "reset",
          importBatches,
          duplicates,
        });
        return;
      }

      commitImportBatches(importBatches, { replace: true });
    } catch (error) {
      setErrorMessage(error?.message || t("championship.admin.analysisFailed"));
    } finally {
      setIsReadingReset(false);
    }
  };

  const resolvePendingDuplicateImport = (action) => {
    if (!pendingDuplicateImport) return;

    if (action === "cancel") {
      setPendingDuplicateImport(null);
      return;
    }

    if (action === "keep-existing") {
      const duplicateRowKeys = new Set(
        pendingDuplicateImport.duplicates.map(
          (duplicate) => `${duplicate.importId}:${duplicate.rowIndex}`
        )
      );
      const adjustedImports = pendingDuplicateImport.importBatches.map(
        (importBatch) => ({
          ...importBatch,
          ignoredDuplicateRowCount: importBatch.rows.filter((row, rowIndex) =>
            duplicateRowKeys.has(`${importBatch.id}:${rowIndex}`)
          ).length,
          rows: importBatch.rows.map((row, rowIndex) => {
            if (!duplicateRowKeys.has(`${importBatch.id}:${rowIndex}`)) {
              return row;
            }

            return {
              ...row,
              ignoredForChampionship: true,
              ignoredReason: "duplicate_keep_existing",
            };
          }),
        })
      );

      commitImportBatches(adjustedImports, {
        replace: pendingDuplicateImport.mode === "reset",
      });
      return;
    }

    commitImportBatches(pendingDuplicateImport.importBatches, {
      replace: pendingDuplicateImport.mode === "reset",
    });
  };

  const removeImportBatch = (importId) => {
    const confirmed = window.confirm(t("championship.admin.removeImportConfirm"));
    if (!confirmed) return;

    const nextImports = getPreviewImports(preview).filter(
      (importBatch) => importBatch.id !== importId
    );
    const nextPreview = rebuildPreviewFromImports(nextImports);
    setPreview(nextPreview);
    setEventOrder(nextPreview.publicEventOrder || {});
    setSaveMessage("");
  };

  const updateDqForm = (field, value) => {
    setDqForm((current) => {
      if (field === "classId") {
        return {
          classId: value,
          eventKey: "",
          resultKey: "",
          reason: current.reason,
        };
      }

      if (field === "eventKey") {
        return {
          ...current,
          eventKey: value,
          resultKey: "",
        };
      }

      return {
        ...current,
        [field]: value,
      };
    });
    setDqErrorMessage("");
    setSaveMessage("");
  };

  const addDisqualificationCorrection = async () => {
    if (!preview) return;

    const reason = String(dqForm.reason || "").trim();
    const classEntry = classSummaries.find((item) => item.id === dqForm.classId);
    const event = classEntry?.events.find((item) => item.eventKey === dqForm.eventKey);
    const result = event?.results.find(
      (item) =>
        buildChampionshipDisqualificationKey({
          ...item,
          eventKey: event.eventKey,
          championshipClassId: classEntry.id,
        }) === dqForm.resultKey
    );

    if (!classEntry || !event || !result) {
      setDqErrorMessage(t("championship.admin.dqSelectResultRequired"));
      return;
    }

    if (!reason) {
      setDqErrorMessage(t("championship.admin.dqReasonRequired"));
      return;
    }

    const key = buildChampionshipDisqualificationKey({
      ...result,
      eventKey: event.eventKey,
      championshipClassId: classEntry.id,
    });
    const nextCorrection = {
      id: `dq-${Date.now()}`,
      key,
      championshipClassId: classEntry.id,
      championshipClassName: classEntry.name,
      eventKey: event.eventKey,
      eventLabel: event.label,
      showNum: event.showNum,
      showName: event.showName,
      teamKey: result.teamKey,
      sourceImportId: result.sourceImportId,
      sourceFileName: result.sourceFileName,
      sourceRowNumber: result.sourceRowNumber,
      rider: result.rider,
      horse: result.horse,
      backNumber: result.backNumber,
      horseNrha: result.horseNrha,
      memberNrha: result.memberNrha,
      reason,
      createdAt: new Date().toISOString(),
      active: true,
    };
    const nextCorrections = upsertDisqualificationCorrection(
      championshipCorrections,
      nextCorrection
    );
    const nextPreview = rebuildPreviewFromImports(
      getPreviewImports(preview),
      eventLabels,
      eventOrder,
      seasonStatus,
      nextCorrections
    );

    setPreview(nextPreview);
    setEventOrder(nextPreview.publicEventOrder || {});
    setDqForm({
      classId: classEntry.id,
      eventKey: event.eventKey,
      resultKey: "",
      reason: "",
    });
    setDqErrorMessage("");
    await savePreviewSeason({
      previewToSave: nextPreview,
      nextStatus: seasonStatus,
      order: nextPreview.publicEventOrder || eventOrder,
      successMessage: t("championship.admin.dqSaved"),
      errorSetter: setDqErrorMessage,
    });
  };

  const removeDisqualificationCorrection = async (disqualificationId) => {
    if (!preview) return;

    const nextCorrections = {
      ...championshipCorrections,
      disqualifications: championshipCorrections.disqualifications.filter(
        (disqualification) => disqualification.id !== disqualificationId
      ),
    };
    const nextPreview = rebuildPreviewFromImports(
      getPreviewImports(preview),
      eventLabels,
      eventOrder,
      seasonStatus,
      nextCorrections
    );

    setPreview(nextPreview);
    setEventOrder(nextPreview.publicEventOrder || {});
    await savePreviewSeason({
      previewToSave: nextPreview,
      nextStatus: seasonStatus,
      order: nextPreview.publicEventOrder || eventOrder,
      successMessage: t("championship.admin.dqRemoved"),
      errorSetter: setDqErrorMessage,
    });
  };

  const handleEventLabelChange = (eventKey, value) => {
    const nextLabels = {
      ...eventLabels,
      [eventKey]: value,
    };

    if (!String(value || "").trim()) {
      delete nextLabels[eventKey];
    }

    setEventLabels(nextLabels);
    setSaveMessage("");
    setPreview((current) =>
      applyChampionshipEventLabels(current, nextLabels, eventOrder)
    );
  };

  const handleEventOrderChange = (eventKey, value) => {
    const nextEventOrder = reorderEventSettings(
      technicalShows,
      eventOrder,
      eventKey,
      value
    );

    setEventOrder(nextEventOrder);
    setSaveMessage("");
    setPreview((current) =>
      applyChampionshipEventLabels(current, eventLabels, nextEventOrder)
    );
  };

  const savePreviewSeason = async ({
    previewToSave = preview,
    nextStatus = seasonStatus,
    labels = eventLabels,
    order = eventOrder,
    successMessage = t("championship.admin.saved"),
    errorSetter = setErrorMessage,
  } = {}) => {
    if (!previewToSave) return null;

    setIsSaving(true);
    setErrorMessage("");
    setDqErrorMessage("");
    setSaveMessage("");

    try {
      const saveTechnicalShows = getChampionshipIncludedShows(previewToSave);
      const allowedKeys = new Set(saveTechnicalShows.map((event) => event.key));
      const nextEventLabels = sanitizeEventLabels(labels, allowedKeys);
      const nextEventOrder = buildEventOrderSettings(saveTechnicalShows, order);
      const labeledPreview = applyChampionshipEventLabels(
        previewToSave,
        nextEventLabels,
        nextEventOrder
      );
      const saved = await saveChampionshipSeasonRepository({
        ...labeledPreview,
        id: season?.id || previewToSave.id,
        associationId,
        title: seasonTitle,
        year: seasonYear,
        status: nextStatus,
        publicEventLabels: nextEventLabels,
        publicEventOrder: nextEventOrder,
        ...normalizeChampionshipRules({
          rulesStatement,
          pointsExplanation,
        }),
      });
      setSeason(saved);
      setPreview(saved);
      setEventLabels(nextEventLabels);
      setEventOrder(nextEventOrder);
      setSeasonStatus(saved.status || nextStatus);
      setSaveMessage(
        getLocalFirstSyncNoticeTone(saved) === "synced"
          ? successMessage
          : formatLocalFirstSyncNotice(saved, t)
      );
      return saved;
    } catch (error) {
      errorSetter(error?.message || t("common.saveFailed", { message: "" }));
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const saveSeason = async (nextStatus = seasonStatus) => {
    await savePreviewSeason({ nextStatus });
  };

  const refreshSubscriberSummary = async () => {
    setIsLoadingSubscriberSummary(true);
    const nextSummary =
      await getChampionshipUpdateSubscriberSummaryRepository(associationId);
    setSubscriberSummary(nextSummary);
    setIsLoadingSubscriberSummary(false);
  };

  const updateCampaignField = (field, value) => {
    setCampaignForm((current) => ({
      ...current,
      [field]: value,
    }));
    setCampaignErrors((current) => {
      if (!current[field]) return current;
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
    setCampaignStatus({ tone: "", message: "" });
  };

  const resetCampaignDefaults = () => {
    setCampaignForm(
      buildDefaultChampionshipUpdateCampaignForm({
        seasonTitle,
        seasonYear,
        t,
        language,
      })
    );
    setCampaignErrors({});
    setCampaignStatus({ tone: "", message: "" });
  };

  const sendChampionshipUpdate = async (mode) => {
    const nextForm = {
      ...campaignForm,
      mode,
    };
    const errors = validateChampionshipUpdateCampaignForm(nextForm);

    if (Object.keys(errors).length > 0) {
      setCampaignErrors(errors);
      setCampaignStatus({
        tone: "error",
        message: t("championship.updates.adminRequiredFields"),
      });
      return;
    }

    if (mode === "campaign") {
      if (subscriberSummary.activeCount <= 0) {
        setCampaignStatus({
          tone: "error",
          message: t("championship.updates.noSubscribers"),
        });
        return;
      }

      if (seasonStatus === "draft") {
        setCampaignStatus({
          tone: "error",
          message: t("championship.updates.publishBeforeSend"),
        });
        return;
      }

      const confirmed = window.confirm(
        t("championship.updates.confirmSend", {
          count: subscriberSummary.activeCount,
        })
      );
      if (!confirmed) return;
    }

    setIsSendingCampaign(true);
    setCampaignStatus({
      tone: "info",
      message:
        mode === "test"
          ? t("championship.updates.testSending")
          : t("championship.updates.campaignSending"),
    });

    const result = await sendChampionshipUpdateCampaignRepository({
      associationId,
      association,
      season: {
        ...(season || preview || {}),
        title: seasonTitle,
        year: seasonYear,
        status: seasonStatus,
      },
      publicUrl: getPublicChampionshipUrl(associationId),
      form: nextForm,
      mode,
    });

    setIsSendingCampaign(false);

    if (!result.ok) {
      setCampaignStatus({
        tone: "error",
        message:
          result.reason === "supabase_unavailable"
            ? t("championship.updates.supabaseUnavailable")
            : t("championship.updates.campaignFailed"),
      });
      return;
    }

    setCampaignStatus({
      tone: "success",
      message:
        mode === "test"
          ? t("championship.updates.testSent")
          : t("championship.updates.campaignSent", {
              count: result.data?.successCount ?? 0,
            }),
    });
    await refreshSubscriberSummary();
  };

  const exportChampionshipPdf = () => {
    if (!preview) return;

    try {
      const pdfSeason = {
        ...preview,
        title: seasonTitle,
        year: seasonYear,
        status: seasonStatus,
      };
      const generatedAt = new Date();
      const pdf = generateChampionshipPdf({
        associationName: association?.name || association?.shortName || "",
        associationAbbreviation: association?.shortName || "ASSOC",
        associationLogoDataUrl: association?.logoDataUrl || null,
        season: pdfSeason,
        generatedAt,
      });
      const fileName = buildChampionshipPdfFileName({
        associationAbbreviation: association?.shortName || "ASSOC",
        seasonTitle,
        year: seasonYear,
        generatedAt,
      });

      pdf.save(fileName);
    } catch (error) {
      setErrorMessage(error?.message || t("championship.admin.exportPdfFailed"));
    }
  };

  if (isLoading) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>{t("championship.admin.loading")}</div>
      </div>
    );
  }

  if (!association) {
    return (
      <div style={styles.app}>
        <Link to="/associations">{t("management.shows.backAssociations")}</Link>
        <div style={emptyStateStyle}>{t("management.shows.associationNotFound")}</div>
      </div>
    );
  }

  if (!access.isLoadingAccess && !canManage) {
    return (
      <div style={styles.app}>
        <Link to={`/associations/${associationId}/shows`}>
          {t("nav.backAssociation")}
        </Link>
        <div style={emptyStateStyle}>{t("championship.admin.accessDenied")}</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={topLinksStyle}>
        <Link to={`/associations/${associationId}/shows`}>
          {t("nav.backAssociation")}
        </Link>
        <Link to={`/public/associations/${associationId}/championnat`}>
          {t("championship.admin.publicLink")}
        </Link>
      </div>

      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>{association.name}</div>
          <h1 style={titleStyle}>{t("championship.admin.title")}</h1>
          <div style={mutedTextStyle}>{t("championship.admin.subtitle")}</div>
        </div>
      </div>

      <section style={panelStyle}>
        <div style={sectionTitleStyle}>{t("championship.admin.seasonSettings")}</div>
        <div style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>{t("championship.admin.seasonTitle")}</span>
            <input
              value={seasonTitle}
              onChange={(event) => updateSeasonTitle(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>{t("championship.admin.year")}</span>
            <input
              value={seasonYear}
              onChange={(event) => updateSeasonYear(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>{t("championship.admin.status")}</span>
            <select
              value={seasonStatus}
              onChange={(event) => updateSeasonStatus(event.target.value)}
              style={inputStyle}
            >
              <option value="draft">{t("championship.status.draft")}</option>
              <option value="published">{t("championship.status.published")}</option>
              <option value="final">{t("championship.status.final")}</option>
            </select>
          </label>
        </div>
        <div style={championshipRulesGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>
              {t("championship.admin.rulesStatement")}
            </span>
            <textarea
              value={rulesStatement}
              onChange={(event) => updateRulesStatement(event.target.value)}
              maxLength={CHAMPIONSHIP_RULE_TEXT_MAX_LENGTH}
              placeholder={t("championship.admin.rulesStatementPlaceholder")}
              style={championshipRuleTextareaStyle}
            />
            <span style={fieldHelpStyle}>
              {t("championship.admin.rulesStatementHelp")}
            </span>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>
              {t("championship.admin.pointsExplanation")}
            </span>
            <textarea
              value={pointsExplanation}
              onChange={(event) => updatePointsExplanation(event.target.value)}
              maxLength={CHAMPIONSHIP_RULE_TEXT_MAX_LENGTH}
              placeholder={t(
                "championship.admin.pointsExplanationPlaceholder"
              )}
              style={championshipRuleTextareaStyle}
            />
            <span style={fieldHelpStyle}>
              {t("championship.admin.pointsExplanationHelp")}
            </span>
          </label>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={sectionTitleStyle}>{t("championship.admin.importCsv")}</div>
        <div style={fileRowStyle}>
          <input
            key={fileInputKey}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={addCsvToSeason}
            style={primaryButtonStyle}
            disabled={!csvText}
          >
            {t("championship.admin.addCsv")}
          </button>
        </div>
        <textarea
          value={csvText}
          onChange={(event) => {
            setCsvText(event.target.value);
            setSaveMessage("");
          }}
          placeholder={t("championship.admin.csvPlaceholder")}
          style={textareaStyle}
        />
        <div style={resetImportStyle}>
          <div>
            <div style={reportTitleStyle}>{t("championship.admin.resetImport")}</div>
            <div style={mutedTextStyle}>
              {t("championship.admin.resetImportHelp")}
            </div>
          </div>
          <div style={fileRowStyle}>
            <input
              key={resetInputKey}
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={handleResetFilesChange}
            />
            <button
              type="button"
              onClick={reimportAllCsvFiles}
              style={secondaryButtonStyle}
              disabled={!resetFiles.length || isReadingReset}
            >
              {isReadingReset
                ? t("championship.admin.resetImportLoading")
                : t("championship.admin.resetImportAction")}
            </button>
          </div>
          {resetFiles.length > 0 && (
            <div style={mutedTextStyle}>
              {t("championship.admin.resetImportSelected", {
                count: resetFiles.length,
              })}
            </div>
          )}
        </div>
        {errorMessage && <div style={errorStyle}>{errorMessage}</div>}
      </section>

      <section style={panelStyle}>
        <div style={sectionTitleStyle}>
          {t("championship.admin.showScoreImportTitle")}
        </div>
        <div style={mutedTextStyle}>
          {t("championship.admin.showScoreImportHelp")}
        </div>
        <div style={fileRowStyle}>
          <button
            type="button"
            onClick={analyzeShowScoreResults}
            style={secondaryButtonStyle}
            disabled={isLoadingShowScoreImport}
          >
            {isLoadingShowScoreImport
              ? t("championship.admin.showScoreImportLoading")
              : t("championship.admin.showScoreImportAction")}
          </button>
          {showScoreImportPreview && (
            <button
              type="button"
              onClick={addShowScoreResultsToSeason}
              style={primaryButtonStyle}
              disabled={showScoreSelection.selectedRowCount <= 0}
            >
              {t("championship.admin.showScoreImportAdd")}
            </button>
          )}
        </div>

        {showScoreImportPreview && (
          <div style={showScoreImportPreviewStyle}>
            <div style={showScoreImportSummaryStyle}>
              {t("championship.admin.showScoreImportSummary", {
                classes: showScoreSelection.selectedClassCount,
                rows: showScoreSelection.selectedRowCount,
                ignored: showScoreSelection.ignoredRowCount,
              })}
            </div>
            {showScoreImportPreview.classes.length > 0 ? (
              <div style={showScoreImportClassListStyle}>
                {showScoreImportPreview.classes.map((classEntry) => {
                  const isExcluded = showScoreExcludedClassKeys.includes(
                    classEntry.key
                  );
                  const isSelected = classEntry.canInclude && !isExcluded;

                  return (
                    <label
                      key={classEntry.key}
                      style={{
                        ...showScoreImportClassRowStyle,
                        ...(classEntry.canInclude
                          ? {}
                          : showScoreImportClassRowDisabledStyle),
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!classEntry.canInclude}
                        onChange={(event) =>
                          toggleShowScoreClassInclusion(
                            classEntry.key,
                            event.target.checked
                          )
                        }
                      />
                      <div style={showScoreImportClassContentStyle}>
                        <div style={classTitleStyle}>
                          {classEntry.importedClassName ||
                            classEntry.importedClassCode}
                        </div>
                        <div style={mutedTextStyle}>
                          {formatShowScoreClassMapping(classEntry, t)}
                        </div>
                        <div style={showScoreImportClassMetaStyle}>
                          {t("championship.admin.showScoreImportClassMeta", {
                            entries: classEntry.entryCount,
                            scored: classEntry.scoredCount,
                          })}
                          {" · "}
                          {getShowScoreClassStatusLabel(classEntry, t)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div style={mutedTextStyle}>
                {t("championship.admin.showScoreImportEmpty")}
              </div>
            )}
          </div>
        )}
      </section>

      <ChampionshipUpdateCampaignPanel
        subscriberSummary={subscriberSummary}
        isLoadingSubscriberSummary={isLoadingSubscriberSummary}
        form={campaignForm}
        errors={campaignErrors}
        status={campaignStatus}
        isSending={isSendingCampaign}
        seasonStatus={seasonStatus}
        onChange={updateCampaignField}
        onRefreshSubscribers={refreshSubscriberSummary}
        onResetDefaults={resetCampaignDefaults}
        onSendTest={() => sendChampionshipUpdate("test")}
        onSendCampaign={() => sendChampionshipUpdate("campaign")}
        t={t}
      />

      {preview && (
        <>
          <section style={summaryGridStyle}>
            <SummaryCard
              label={t("championship.admin.importedFiles")}
              value={preview.importCount || 0}
            />
            <SummaryCard
              label={t("championship.admin.uniqueRows")}
              value={preview.uniqueRowCount ?? preview.rowCount ?? 0}
            />
            <SummaryCard
              label={t("championship.admin.duplicateRows")}
              value={preview.duplicateRowCount || 0}
            />
            <SummaryCard
              label={t("championship.admin.classes")}
              value={preview.classCount || 0}
            />
            <SummaryCard
              label={t("championship.admin.events")}
              value={preview.eventCount || 0}
            />
            <SummaryCard
              label={t("championship.admin.shows")}
              value={preview.showCount ?? technicalShows.length}
            />
            <SummaryCard
              label={t("championship.admin.teams")}
              value={preview.teamCount || 0}
            />
            <SummaryShowsCard
              label={t("championship.admin.includedShows")}
              shows={technicalShows}
              emptyText={t("championship.admin.noIncludedShows")}
              t={t}
            />
          </section>

          {validation && <ValidationReport validation={validation} t={t} />}

          {getPreviewImports(preview).length > 0 && (
            <section style={panelStyle}>
              <div style={sectionTitleStyle}>{t("championship.admin.importHistory")}</div>
              <div style={importListStyle}>
                {getPreviewImports(preview).map((importBatch) => (
                  <div key={importBatch.id} style={importRowStyle}>
                    <div>
                      <div style={classTitleStyle}>{importBatch.fileName}</div>
                      <div style={mutedTextStyle}>
                        {t("championship.admin.importMeta", {
                          rows: importBatch.rowCount || 0,
                          date: formatShortDateTime(importBatch.importedAt),
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImportBatch(importBatch.id)}
                      style={dangerButtonStyle}
                    >
                      {t("championship.admin.removeImport")}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <ChampionshipDisqualificationPanel
            classes={classSummaries}
            corrections={championshipCorrections}
            form={dqForm}
            errorMessage={dqErrorMessage}
            isSaving={isSaving}
            onChange={updateDqForm}
            onAdd={addDisqualificationCorrection}
            onRemove={removeDisqualificationCorrection}
            t={t}
          />

          {technicalShows.length > 0 && (
            <section style={panelStyle}>
              <div style={sectionTitleStyle}>{t("championship.admin.publicLabels")}</div>
              <div style={mutedTextStyle}>
                {t("championship.admin.publicLabelsHelp")}
              </div>
              <div style={labelGridStyle}>
                {technicalShows.map((event, index) => (
                  <div key={event.key} style={showSettingsStyle}>
                    <div style={labelStyle}>
                      {event.showName || event.key}{" "}
                      <span style={mutedInlineStyle}>
                        ({t("championship.admin.eventCount", {
                          count: event.occurrenceCount,
                        })})
                      </span>
                    </div>
                    <div style={showSettingsFieldsStyle}>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>
                          {t("championship.admin.publicOrder")}
                        </span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={getEventOrderValue(event, index, eventOrder)}
                          onChange={(changeEvent) =>
                            handleEventOrderChange(event.key, changeEvent.target.value)
                          }
                          style={orderInputStyle}
                        />
                      </label>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>
                          {t("championship.admin.publicLabel")}
                        </span>
                        <input
                          value={eventLabels[event.key] || ""}
                          onChange={(changeEvent) =>
                            handleEventLabelChange(event.key, changeEvent.target.value)
                          }
                          placeholder={event.showName || event.key}
                          style={inputStyle}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section style={panelStyle}>
            <div style={sectionTitleStyle}>{t("championship.admin.preview")}</div>
            <div style={classListStyle}>
              {classSummaries.map((classEntry) => (
                <div key={classEntry.id} style={classPreviewStyle}>
                  <div>
                    <div style={classTitleStyle}>{classEntry.name}</div>
                    <div style={mutedTextStyle}>
                      {t("championship.admin.eventCount", {
                        count: classEntry.events.length,
                      })}{" "}
                      ·{" "}
                      {t("championship.admin.teamCount", {
                        count: classEntry.teams.length,
                      })}
                    </div>
                  </div>
                  {classEntry.teams[0] && (
                    <div style={leaderStyle}>
                      #{classEntry.teams[0].rank} {classEntry.teams[0].rider} ·{" "}
                      {formatChampionshipPoints(classEntry.teams[0].totalPoints)} pts
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div style={actionRowStyle}>
            <button
              type="button"
              onClick={exportChampionshipPdf}
              style={secondaryButtonStyle}
              disabled={!classSummaries.length}
            >
              {t("championship.admin.exportPdf")}
            </button>
            <button
              type="button"
              onClick={() => saveSeason(seasonStatus)}
              style={primaryButtonStyle}
              disabled={isSaving}
            >
              {t("championship.admin.save")}
            </button>
            <button
              type="button"
              onClick={() => saveSeason("published")}
              style={secondaryButtonStyle}
              disabled={isSaving}
            >
              {t("championship.admin.publish")}
            </button>
            <button
              type="button"
              onClick={() => saveSeason("final")}
              style={secondaryButtonStyle}
              disabled={isSaving}
            >
              {t("championship.admin.markFinal")}
            </button>
          </div>
          {saveMessage && <div style={savedStyle}>{saveMessage}</div>}
        </>
      )}

      {pendingDuplicateImport && (
        <DuplicateImportModal
          duplicateImport={pendingDuplicateImport}
          onResolve={resolvePendingDuplicateImport}
          t={t}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryValueStyle}>{value}</div>
      <div style={mutedTextStyle}>{label}</div>
    </div>
  );
}

function ChampionshipDisqualificationPanel({
  classes,
  corrections,
  form,
  errorMessage,
  isSaving,
  onChange,
  onAdd,
  onRemove,
  t,
}) {
  const classOptions = Array.isArray(classes) ? classes : [];
  const selectedClass =
    classOptions.find((classEntry) => classEntry.id === form.classId) || null;
  const eventOptions = Array.isArray(selectedClass?.events)
    ? selectedClass.events
    : [];
  const selectedEvent =
    eventOptions.find((event) => event.eventKey === form.eventKey) || null;
  const resultOptions = Array.isArray(selectedEvent?.results)
    ? selectedEvent.results.map((result) => {
        const key = buildChampionshipDisqualificationKey({
          ...result,
          eventKey: selectedEvent.eventKey,
          championshipClassId: selectedClass.id,
        });

        return {
          key,
          result,
        };
      })
    : [];
  const activeKeys = new Set(
    (corrections.disqualifications || []).map((disqualification) => disqualification.key)
  );
  const activeDisqualifications = corrections.disqualifications || [];

  return (
    <section style={panelStyle}>
      <div style={sectionTitleStyle}>{t("championship.admin.dqTitle")}</div>
      <div style={mutedTextStyle}>{t("championship.admin.dqHelp")}</div>

      <div style={dqFormGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>{t("championship.admin.dqClass")}</span>
          <select
            value={form.classId}
            onChange={(event) => onChange("classId", event.target.value)}
            style={inputStyle}
          >
            <option value="">{t("championship.admin.dqChooseClass")}</option>
            {classOptions.map((classEntry) => (
              <option key={classEntry.id} value={classEntry.id}>
                {classEntry.name}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>{t("championship.admin.dqOccurrence")}</span>
          <select
            value={form.eventKey}
            onChange={(event) => onChange("eventKey", event.target.value)}
            style={inputStyle}
            disabled={!selectedClass}
          >
            <option value="">{t("championship.admin.dqChooseOccurrence")}</option>
            {eventOptions.map((event) => (
              <option key={event.eventKey} value={event.eventKey}>
                {event.label || event.showName || event.showNum || event.eventKey}
              </option>
            ))}
          </select>
        </label>

        <label style={dqWideFieldStyle}>
          <span style={labelStyle}>{t("championship.admin.dqTeam")}</span>
          <select
            value={form.resultKey}
            onChange={(event) => onChange("resultKey", event.target.value)}
            style={inputStyle}
            disabled={!selectedEvent}
          >
            <option value="">{t("championship.admin.dqChooseTeam")}</option>
            {resultOptions.map(({ key, result }) => (
              <option
                key={key}
                value={key}
                disabled={result.disqualified || activeKeys.has(key)}
              >
                {formatDisqualificationResultOption(result, t)}
              </option>
            ))}
          </select>
        </label>

        <label style={dqWideFieldStyle}>
          <span style={labelStyle}>{t("championship.admin.dqReason")}</span>
          <input
            value={form.reason}
            onChange={(event) => onChange("reason", event.target.value)}
            style={inputStyle}
            placeholder={t("championship.admin.dqReasonPlaceholder")}
          />
        </label>
      </div>

      {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

      <div style={actionRowStyle}>
        <button
          type="button"
          onClick={onAdd}
          style={primaryButtonStyle}
          disabled={isSaving}
        >
          {isSaving
            ? t("championship.admin.dqSaving")
            : t("championship.admin.dqAdd")}
        </button>
      </div>

      {activeDisqualifications.length > 0 ? (
        <div style={dqListStyle}>
          {activeDisqualifications.map((disqualification) => (
            <div key={disqualification.id} style={dqRowStyle}>
              <div>
                <div style={classTitleStyle}>
                  {disqualification.rider || "-"} · {disqualification.horse || "-"}
                </div>
                <div style={mutedTextStyle}>
                  {[
                    disqualification.championshipClassName,
                    disqualification.eventLabel ||
                      disqualification.showName ||
                      disqualification.showNum,
                    disqualification.backNumber
                      ? `${t("public.results.backNumber")} ${disqualification.backNumber}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div style={dqReasonStyle}>{disqualification.reason}</div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(disqualification.id)}
                style={dangerButtonStyle}
                disabled={isSaving}
              >
                {t("championship.admin.dqRemove")}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={mutedTextStyle}>{t("championship.admin.dqEmpty")}</div>
      )}
    </section>
  );
}

function ChampionshipUpdateCampaignPanel({
  subscriberSummary,
  isLoadingSubscriberSummary,
  form,
  errors,
  status,
  isSending,
  seasonStatus,
  onChange,
  onRefreshSubscribers,
  onResetDefaults,
  onSendTest,
  onSendCampaign,
  t,
}) {
  const activeCount = subscriberSummary?.activeCount || 0;
  const isDraft = seasonStatus === "draft";

  return (
    <section style={panelStyle}>
      <div style={campaignHeaderStyle}>
        <div>
          <div style={sectionTitleStyle}>
            {t("championship.updates.adminTitle")}
          </div>
          <div style={mutedTextStyle}>
            {t("championship.updates.adminHelp")}
          </div>
        </div>
        <button
          type="button"
          onClick={onRefreshSubscribers}
          style={secondaryButtonStyle}
          disabled={isLoadingSubscriberSummary || isSending}
        >
          {isLoadingSubscriberSummary
            ? t("championship.updates.refreshing")
            : t("championship.updates.refreshSubscribers")}
        </button>
      </div>

      <div style={campaignSummaryStyle}>
        <div>
          <div style={summaryValueStyle}>{activeCount}</div>
          <div style={mutedTextStyle}>
            {t("championship.updates.activeSubscribers")}
          </div>
        </div>
        <div>
          <div style={summaryValueStyle}>{subscriberSummary?.totalCount || 0}</div>
          <div style={mutedTextStyle}>
            {t("championship.updates.totalSubscribers")}
          </div>
        </div>
        {!subscriberSummary?.ok && (
          <div style={campaignUnavailableStyle}>
            {t("championship.updates.summaryUnavailable")}
          </div>
        )}
      </div>

      <div style={campaignFormStyle}>
        <label style={campaignWideFieldStyle}>
          <span style={labelStyle}>{t("championship.updates.subject")}</span>
          <input
            value={form.subject}
            onChange={(event) => onChange("subject", event.target.value)}
            style={errors.subject ? inputErrorStyle : inputStyle}
          />
        </label>
        <label style={campaignWideFieldStyle}>
          <span style={labelStyle}>{t("championship.updates.message")}</span>
          <textarea
            value={form.message}
            onChange={(event) => onChange("message", event.target.value)}
            style={errors.message ? campaignTextareaErrorStyle : campaignTextareaStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>{t("championship.updates.testEmail")}</span>
          <input
            type="email"
            value={form.testEmail}
            onChange={(event) => onChange("testEmail", event.target.value)}
            style={errors.testEmail ? inputErrorStyle : inputStyle}
            placeholder="admin@example.com"
          />
        </label>
      </div>

      {isDraft && (
        <div style={campaignDraftNoticeStyle}>
          {t("championship.updates.draftNotice")}
        </div>
      )}

      {status.message && (
        <div style={campaignStatusStyle(status.tone)}>{status.message}</div>
      )}

      <div style={actionRowStyle}>
        <button
          type="button"
          onClick={onResetDefaults}
          style={secondaryButtonStyle}
          disabled={isSending}
        >
          {t("championship.updates.resetDefault")}
        </button>
        <button
          type="button"
          onClick={onSendTest}
          style={secondaryButtonStyle}
          disabled={isSending}
        >
          {t("championship.updates.sendTest")}
        </button>
        <button
          type="button"
          onClick={onSendCampaign}
          style={primaryButtonStyle}
          disabled={isSending || activeCount <= 0 || isDraft}
        >
          {isSending
            ? t("championship.updates.campaignSending")
            : t("championship.updates.sendCampaign")}
        </button>
      </div>
    </section>
  );
}

function SummaryShowsCard({ label, shows, emptyText, t }) {
  return (
    <div style={summaryShowsCardStyle}>
      <div style={summaryShowsHeaderStyle}>
        <div style={classTitleStyle}>{label}</div>
        <div style={mutedTextStyle}>
          {t("championship.admin.showCount", { count: shows.length })}
        </div>
      </div>
      {shows.length > 0 ? (
        <div style={showChipListStyle}>
          {shows.map((show) => (
            <span key={show.key} style={showChipStyle}>
              {formatIncludedShowLabel(show)}
              {show.occurrenceCount ? (
                <span style={showChipMetaStyle}>
                  {t("championship.admin.eventCount", {
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

function ValidationReport({ validation, t }) {
  const hasIssues =
    validation.unmappedClasses.length ||
    validation.excludedClasses.length ||
    validation.anomalies.length ||
    validation.duplicateRows?.length;

  if (!hasIssues) {
    return (
      <section style={okPanelStyle}>
        {t("championship.admin.noImportIssues")}
      </section>
    );
  }

  return (
    <section style={panelStyle}>
      <div style={sectionTitleStyle}>{t("championship.admin.importReport")}</div>
      <div style={reportGridStyle}>
        {validation.unmappedClasses.length > 0 && (
          <ReportBlock
            title={t("championship.admin.unmappedClasses")}
            items={validation.unmappedClasses.map((item) =>
              `${item.classCode} · ${item.className} (${item.rows})`
            )}
          />
        )}
        {validation.excludedClasses.length > 0 && (
          <ReportBlock
            title={t("championship.admin.excludedClasses")}
            items={validation.excludedClasses.map((item) =>
              `${item.classCode} · ${item.className} (${item.rows})`
            )}
          />
        )}
        {validation.anomalies.length > 0 && (
          <ReportBlock
            title={t("championship.admin.anomalies")}
            items={validation.anomalies.slice(0, 12).map((item) => item.message)}
          />
        )}
        {validation.duplicateRows?.length > 0 && (
          <ReportBlock
            title={t("championship.admin.duplicateRows")}
            items={validation.duplicateRows.slice(0, 12).map((item) => item.message)}
          />
        )}
      </div>
    </section>
  );
}

function ReportBlock({ title, items }) {
  return (
    <div style={reportBlockStyle}>
      <div style={reportTitleStyle}>{title}</div>
      <ul style={reportListStyle}>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DuplicateImportModal({ duplicateImport, onResolve, t }) {
  const isReset = duplicateImport.mode === "reset";

  return (
    <div style={modalBackdropStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        <div style={sectionTitleStyle}>
          {t("championship.admin.duplicateModalTitle")}
        </div>
        <div style={mutedTextStyle}>
          {isReset
            ? t("championship.admin.duplicateModalResetHelp")
            : t("championship.admin.duplicateModalAppendHelp")}
        </div>
        <div style={duplicateListStyle}>
          {duplicateImport.duplicates.slice(0, 8).map((duplicate) => (
            <div key={`${duplicate.importId}-${duplicate.rowIndex}`} style={duplicateItemStyle}>
              <div style={duplicateHeaderStyle}>
                {duplicate.newRow.classCode} · {duplicate.newRow.className}
              </div>
              <div style={duplicateGridStyle}>
                <DuplicateResult
                  title={t("championship.admin.duplicateExisting")}
                  row={duplicate.previousRow}
                />
                <DuplicateResult
                  title={t("championship.admin.duplicateNew")}
                  row={duplicate.newRow}
                />
              </div>
            </div>
          ))}
        </div>
        {duplicateImport.duplicates.length > 8 && (
          <div style={mutedTextStyle}>
            {t("championship.admin.duplicateMore", {
              count: duplicateImport.duplicates.length - 8,
            })}
          </div>
        )}
        <div style={modalActionRowStyle}>
          <button
            type="button"
            onClick={() => onResolve("replace")}
            style={primaryButtonStyle}
          >
            {isReset
              ? t("championship.admin.duplicateUseLast")
              : t("championship.admin.duplicateUseNew")}
          </button>
          <button
            type="button"
            onClick={() => onResolve("keep-existing")}
            style={secondaryButtonStyle}
          >
            {isReset
              ? t("championship.admin.duplicateKeepFirst")
              : t("championship.admin.duplicateKeepExisting")}
          </button>
          <button
            type="button"
            onClick={() => onResolve("cancel")}
            style={secondaryButtonStyle}
          >
            {t("championship.admin.duplicateCancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

function DuplicateResult({ title, row }) {
  return (
    <div style={duplicateResultStyle}>
      <div style={reportTitleStyle}>{title}</div>
      <div style={duplicateLineStyle}>{row.sourceFileName || "CSV"}</div>
      <div style={duplicateLineStyle}>{row.showName || row.showNum}</div>
      <div style={duplicateLineStyle}>
        {row.rider} · {row.horse}
      </div>
      <div style={duplicateLineStyle}>
        Pl. {row.placeNum || "-"} · Score {row.totalScore || "-"}
      </div>
    </div>
  );
}

function findDuplicateRowsForImports(existingImports, newImports) {
  const rowsByKey = new Map();
  const duplicates = [];

  flattenImportRows(existingImports).forEach((row) => {
    const key = buildChampionshipResultDuplicateKey(row);
    if (!key || isChampionshipRowIgnored(row)) return;
    rowsByKey.set(key, row);
  });

  flattenImportRows(newImports).forEach((row) => {
    const key = buildChampionshipResultDuplicateKey(row);
    if (!key || isChampionshipRowIgnored(row)) return;

    const previousRow = rowsByKey.get(key);
    if (previousRow) {
      duplicates.push({
        key,
        importId: row.sourceImportId,
        rowIndex: row.sourceRowIndex,
        previousRow,
        newRow: row,
      });
    }

    rowsByKey.set(key, row);
  });

  return duplicates;
}

function flattenImportRows(imports) {
  return getPreviewImports({ imports }).flatMap((importBatch, importIndex) =>
    importBatch.rows.map((row, rowIndex) => ({
      ...row,
      sourceImportId: row.sourceImportId || importBatch.id,
      sourceFileName: row.sourceFileName || importBatch.fileName,
      sourceImportedAt: row.sourceImportedAt || importBatch.importedAt,
      sourceImportOrder: importIndex,
      sourceRowIndex: rowIndex,
    }))
  );
}

function formatIncludedShowLabel(show) {
  return show.label || show.showName || show.showNum || show.key || "Show";
}

function getPreviewImports(preview) {
  return Array.isArray(preview?.imports) ? preview.imports : [];
}

function upsertDisqualificationCorrection(corrections, disqualification) {
  const normalized = normalizeChampionshipCorrections(corrections);
  const nextDisqualifications = normalized.disqualifications.filter(
    (item) => item.key !== disqualification.key && item.id !== disqualification.id
  );

  return normalizeChampionshipCorrections({
    ...normalized,
    disqualifications: [...nextDisqualifications, disqualification],
  });
}

function formatDisqualificationResultOption(result, t) {
  const parts = [
    result.backNumber ? `${t("public.results.backNumber")} ${result.backNumber}` : "",
    result.rider || "-",
    result.horse || "-",
    result.disqualified ? "DQ" : "",
  ].filter(Boolean);

  return parts.join(" · ");
}

function sanitizeEventLabels(labelsByShow, allowedKeys = null) {
  return Object.fromEntries(
    Object.entries(labelsByShow || {})
      .map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
      .filter(([key, value]) => key && value && (!allowedKeys || allowedKeys.has(key)))
  );
}

function buildEventOrderSettings(shows, orderByShow = {}) {
  const entries = (Array.isArray(shows) ? shows : [])
    .map((show, index) => {
      const key = String(show?.key || "").trim();
      if (!key) return null;

      return {
        key,
        index,
        order: normalizeOrderValue(
          orderByShow[key] ?? show.publicOrder ?? show.order,
          index + 1
        ),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.index - b.index);

  return Object.fromEntries(
    entries.map((entry, index) => [entry.key, index + 1])
  );
}

function reorderEventSettings(shows, orderByShow, eventKey, nextValue) {
  const entries = (Array.isArray(shows) ? shows : [])
    .map((show, index) => ({
      key: String(show?.key || "").trim(),
      index,
      order: normalizeOrderValue(
        orderByShow?.[show?.key] ?? show?.publicOrder ?? show?.order,
        index + 1
      ),
    }))
    .filter((entry) => entry.key)
    .sort((a, b) => a.order - b.order || a.index - b.index);
  const selected = entries.find((entry) => entry.key === eventKey);

  if (!selected) {
    return buildEventOrderSettings(shows, orderByShow);
  }

  const rest = entries.filter((entry) => entry.key !== eventKey);
  const targetOrder = normalizeOrderValue(nextValue, selected.order);
  const targetIndex = Math.min(Math.max(targetOrder - 1, 0), rest.length);
  rest.splice(targetIndex, 0, selected);

  return Object.fromEntries(rest.map((entry, index) => [entry.key, index + 1]));
}

function getEventOrderValue(event, index, eventOrder) {
  return eventOrder[event.key] ?? event.publicOrder ?? event.order ?? index + 1;
}

function normalizeOrderValue(value, fallback) {
  const order = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(order) && order > 0 ? order : fallback;
}

function formatShortDateTime(value) {
  if (!value) return "-";

  return String(value).slice(0, 16).replace("T", " ");
}

function getPublicChampionshipUrl(associationId) {
  const path = `/public/associations/${associationId}/championnat`;

  if (typeof window === "undefined" || !window.location?.origin) {
    return path;
  }

  return `${window.location.origin}${path}`;
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsText(file, "UTF-8");
  });
}

async function loadAssociationShowScoreClassData(associationId) {
  const shows = await getShowsByAssociationRepository(associationId);
  const dayGroups = await Promise.all(
    shows.map(async (show) => {
      const days = await getDaysByShowRepository(show.id);
      return { show, days };
    })
  );
  const classGroups = await Promise.all(
    dayGroups.flatMap(({ show, days }) =>
      days.map(async (day) => {
        const classes = await getClassesForDayRepository(day.id);
        return { show, day, classes };
      })
    )
  );

  return Promise.all(
    classGroups.flatMap(({ show, day, classes }) =>
      classes.map(async (classItem) => {
        const classData = await getClassFullDataRepository(classItem.id);
        return {
          ...classData,
          show,
          day,
          classItem: classData.classItem || classItem,
        };
      })
    )
  );
}

function formatShowScoreClassMapping(classEntry, t) {
  const importedCode = classEntry.importedClassCode || "-";
  const championshipCode = classEntry.championshipClassCode || "-";

  if (classEntry.championshipClassName) {
    return t("championship.admin.showScoreImportMapping", {
      importedCode,
      championshipCode,
      championshipClass: classEntry.championshipClassName,
    });
  }

  return t("championship.admin.showScoreImportUnmapped", {
    importedCode,
  });
}

function getShowScoreClassStatusLabel(classEntry, t) {
  if (classEntry.canInclude) {
    return t("championship.admin.showScoreImportMatched");
  }

  if (classEntry.reason === "no_scored_results") {
    return t("championship.admin.showScoreImportNoScores");
  }

  if (classEntry.matchStatus === "excluded") {
    return t("championship.admin.showScoreImportExcluded");
  }

  return t("championship.admin.showScoreImportUnknown");
}

const topLinksStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 16,
};

const eyebrowStyle = {
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 12,
};

const titleStyle = {
  margin: "4px 0",
  color: "#0f172a",
};

const mutedTextStyle = {
  color: "#64748b",
  lineHeight: 1.35,
};

const mutedInlineStyle = {
  color: "#64748b",
  fontWeight: 700,
};

const panelStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 16,
  marginBottom: 14,
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
};

const okPanelStyle = {
  ...panelStyle,
  borderColor: "#86efac",
  background: "#f0fdf4",
  color: "#166534",
  fontWeight: 800,
};

const sectionTitleStyle = {
  fontSize: 18,
  fontWeight: 850,
  color: "#0f172a",
  marginBottom: 12,
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const labelGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 12,
  marginTop: 12,
};

const showSettingsStyle = {
  display: "grid",
  gap: 8,
  alignContent: "start",
};

const showSettingsFieldsStyle = {
  display: "grid",
  gridTemplateColumns: "86px minmax(0, 1fr)",
  gap: 10,
  alignItems: "end",
};

const dqFormGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 12,
  marginTop: 12,
};

const dqListStyle = {
  display: "grid",
  gap: 10,
  marginTop: 12,
};

const dqRowStyle = {
  border: "1px solid #fecaca",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  background: "#fff7ed",
};

const dqReasonStyle = {
  marginTop: 6,
  color: "#9a3412",
  fontWeight: 850,
};

const campaignHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const campaignSummaryStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  marginTop: 12,
  marginBottom: 12,
};

const campaignUnavailableStyle = {
  border: "1px solid #fed7aa",
  borderRadius: 8,
  padding: 10,
  background: "#fff7ed",
  color: "#9a3412",
  fontWeight: 800,
};

const campaignFormStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: 12,
};

const campaignDraftNoticeStyle = {
  marginTop: 12,
  border: "1px solid #fde68a",
  borderRadius: 8,
  padding: 10,
  background: "#fffbeb",
  color: "#92400e",
  fontWeight: 800,
};

const campaignStatusStyle = (tone) => ({
  marginTop: 12,
  border: `1px solid ${
    tone === "success" ? "#86efac" : tone === "error" ? "#fecaca" : "#bfdbfe"
  }`,
  borderRadius: 8,
  padding: 10,
  background:
    tone === "success" ? "#f0fdf4" : tone === "error" ? "#fef2f2" : "#eff6ff",
  color:
    tone === "success" ? "#166534" : tone === "error" ? "#991b1b" : "#1d4ed8",
  fontWeight: 800,
});

const fieldStyle = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const dqWideFieldStyle = {
  ...fieldStyle,
  gridColumn: "1 / -1",
};

const labelStyle = {
  fontWeight: 800,
  color: "#334155",
  fontSize: 13,
};

const inputStyle = {
  width: "100%",
  minWidth: 0,
  minHeight: 42,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "9px 10px",
  fontSize: 14,
  boxSizing: "border-box",
};

const inputErrorStyle = {
  ...inputStyle,
  borderColor: "#ef4444",
};

const campaignWideFieldStyle = {
  ...fieldStyle,
  gridColumn: "1 / -1",
};

const campaignTextareaStyle = {
  ...inputStyle,
  minHeight: 116,
  resize: "vertical",
  lineHeight: 1.4,
};

const campaignTextareaErrorStyle = {
  ...campaignTextareaStyle,
  borderColor: "#ef4444",
};

const orderInputStyle = {
  ...inputStyle,
  width: "100%",
};

const fileRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 12,
};

const resetImportStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: 12,
  marginTop: 12,
  background: "#f8fafc",
};

const showScoreImportPreviewStyle = {
  display: "grid",
  gap: 12,
  marginTop: 12,
};

const showScoreImportSummaryStyle = {
  border: "1px solid #bbf7d0",
  borderRadius: 8,
  padding: 10,
  background: "#f0fdf4",
  color: "#166534",
  fontWeight: 850,
};

const showScoreImportClassListStyle = {
  display: "grid",
  gap: 8,
};

const showScoreImportClassRowStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: 10,
  alignItems: "flex-start",
  background: "#ffffff",
};

const showScoreImportClassRowDisabledStyle = {
  background: "#f8fafc",
  color: "#64748b",
};

const showScoreImportClassContentStyle = {
  display: "grid",
  gap: 4,
};

const showScoreImportClassMetaStyle = {
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
};

const textareaStyle = {
  width: "100%",
  minHeight: 180,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: 10,
  fontFamily: "monospace",
  fontSize: 13,
  boxSizing: "border-box",
};

const championshipRulesGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
  marginTop: 14,
};

const championshipRuleTextareaStyle = {
  ...textareaStyle,
  minHeight: 130,
  fontFamily: "inherit",
  lineHeight: 1.45,
};

const fieldHelpStyle = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.35,
};

const errorStyle = {
  marginTop: 10,
  padding: 10,
  border: "1px solid #fecaca",
  borderRadius: 8,
  background: "#fef2f2",
  color: "#991b1b",
  fontWeight: 800,
};

const savedStyle = {
  marginBottom: 20,
  padding: 10,
  border: "1px solid #86efac",
  borderRadius: 8,
  background: "#f0fdf4",
  color: "#166534",
  fontWeight: 850,
};

const primaryButtonStyle = {
  ...styles.primaryButton,
  minHeight: 42,
};

const secondaryButtonStyle = {
  ...styles.secondaryButton,
  minHeight: 42,
};

const dangerButtonStyle = {
  ...styles.secondaryButton,
  minHeight: 38,
  borderColor: "#fecaca",
  color: "#991b1b",
};

const actionRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 20,
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
  marginBottom: 14,
};

const summaryCardStyle = {
  ...panelStyle,
  marginBottom: 0,
};

const summaryShowsCardStyle = {
  ...summaryCardStyle,
  gridColumn: "1 / -1",
};

const summaryShowsHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 10,
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
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  background: "#f8fafc",
  color: "#0f172a",
  padding: "7px 10px",
  fontSize: 13,
  fontWeight: 850,
};

const showChipMetaStyle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 750,
};

const summaryValueStyle = {
  fontSize: 28,
  fontWeight: 900,
  color: "#0f172a",
};

const reportGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const reportBlockStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  background: "#f8fafc",
};

const reportTitleStyle = {
  fontWeight: 850,
  marginBottom: 8,
  color: "#0f172a",
};

const reportListStyle = {
  margin: 0,
  paddingLeft: 18,
  color: "#475569",
  lineHeight: 1.4,
};

const importListStyle = {
  display: "grid",
  gap: 10,
};

const importRowStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  background: "rgba(15, 23, 42, 0.58)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle = {
  width: "min(920px, 100%)",
  maxHeight: "88vh",
  overflow: "auto",
  background: "#ffffff",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  padding: 18,
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
};

const duplicateListStyle = {
  display: "grid",
  gap: 12,
  margin: "16px 0",
};

const duplicateItemStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  background: "#f8fafc",
};

const duplicateHeaderStyle = {
  fontWeight: 850,
  color: "#0f172a",
  marginBottom: 10,
};

const duplicateGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
};

const duplicateResultStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
};

const duplicateLineStyle = {
  color: "#334155",
  lineHeight: 1.35,
  fontSize: 14,
};

const modalActionRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const classListStyle = {
  display: "grid",
  gap: 10,
};

const classPreviewStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const classTitleStyle = {
  fontWeight: 850,
  color: "#0f172a",
};

const leaderStyle = {
  color: "#0f172a",
  fontWeight: 800,
};

const emptyStateStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 16,
  color: "#64748b",
};

export default AssociationChampionshipPage;
