import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { loadAssociations } from "../../features/associations/associationsData";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import {
  getClassFullDataRepository,
  getClassesForDayRepository,
} from "../../features/classes/classRepository";
import { compareScheduleItemsByStart } from "../../features/classes/classSchedule";
import {
  getJudgeDisplayName,
  normalizeClassJudges,
} from "../../features/classes/classJudges";
import { getUniqueScoringClasses } from "../../features/classes/classScoringGroups";
import {
  buildClassTimingRow,
  buildPatternTimingStats,
  getClassPatternValue,
} from "../../features/classes/classTimeAnalytics";
import {
  downloadJudgeScorePdf,
  downloadOfficialScorePdf,
  downloadSetApprovalPdf,
  getOfficialPdfFileName,
} from "../../features/classes/officialPdfService";
import {
  buildClassResultsPdfFileName,
  generateClassResultsPdf,
} from "../../utils/generateResultsPdf";
import {
  validateAnnouncerResultsRepository,
  validateOfficialResultRepository,
} from "../../features/classes/officialResultRepository";
import { getDaysByShowId } from "../../features/days/daySelectors";
import {
  publishClassRepository,
  unpublishClassRepository,
} from "../../features/publication/publicationCloudRepository";
import { PUBLICATION_STATUSES } from "../../features/publication/publicationRepository";
import {
  RESULT_PUBLICATION_STATUSES,
  getClassResultPublicationRepository,
  publishClassResultsRepository,
  unpublishClassResultsRepository,
} from "../../features/results/resultPublicationRepository";
import {
  deleteScannedScoresheetRepository,
  formatScannedScoresheetSize,
  getScannedScoresheetPublicUrl,
  getScannedScoresheetsForShowRepository,
  uploadScannedScoresheetRepository,
} from "../../features/results/scannedScoresheetRepository";
import {
  buildAnnouncerResultGroups,
  hasCompletedAnnouncerResults,
  isAnnouncerResultsApproval,
  isClassResultsSecretariatApproved,
} from "../../features/results/classResults";
import {
  formatLocalFirstSyncNotice,
  getLocalFirstSyncNoticeTone,
} from "../../features/cloud/localFirstSyncMessages";
import {
  loadJudgeScoringSessionsForClassRepository,
  releaseJudgeScoringSessionRepository,
} from "../../features/scoring/judgeScoringSessionRepository";
import {
  buildMultiJudgeOfficialRuns,
  getJudgeSheetSummary,
  getLatestTimestamp,
  runHasScoringData,
} from "../../features/scoring/multiJudgeOfficialData";
import { getShowById } from "../../features/shows/showSelectors";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";
import ClassPaceSummary from "../../components/ClassPaceSummary";

const CURRENT_SECRETARIAT_PUBLICATION_STATUSES = [
  PUBLICATION_STATUSES.LIVE,
  PUBLICATION_STATUSES.LIVE_NO_SCORE,
  PUBLICATION_STATUSES.LIVE_SCORING,
];

function SecretariatDashboardPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const [version, setVersion] = useState(0);
  const [daySections, setDaySections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [announcerResultsPreview, setAnnouncerResultsPreview] = useState(null);
  const [scoresheetBusyClassIds, setScoresheetBusyClassIds] = useState(
    () => new Set()
  );
  const access = useAssociationAccess(associationId);

  const association = useMemo(() => {
    return (
      loadAssociations().find((item) => item.id === associationId) || null
    );
  }, [associationId]);

  const show = getShowById(showId);

  useEffect(() => {
    let isMounted = true;

    async function loadDaySections() {
      setIsLoading(true);
      const days = getDaysByShowId(showId);
      const scoresheetDocumentsByClassId =
        await getScannedScoresheetsForShowRepository(showId);
      const nextSections = await Promise.all(
        days.map(async (day) => {
          const classes = await getClassesForDayRepository(day.id);
          const scoringClasses = getUniqueScoringClasses(classes);
          const classRows = await Promise.all(
            scoringClasses.map(async (classItem) => {
              const classData = await getClassFullDataRepository(classItem.id);
              const judges = normalizeClassJudges({
                judges: classData?.setup?.judges,
                judgeName:
                  classData?.setup?.judgeName || classData?.classItem?.judgeName,
              });
              const judgeSessions =
                judges.length > 1
                  ? await loadJudgeScoringSessionsForClassRepository(
                      classItem.id,
                      judges
                    )
                  : [];

              return {
                ...classData,
                judges,
                judgeSessions,
                resultPublication:
                  await getClassResultPublicationRepository(classItem.id),
                scoresheetDocument:
                  scoresheetDocumentsByClassId[classItem.id] || null,
              };
            })
          );

          return {
            day,
            classRows: classRows.sort(compareScheduleItemsByStart),
          };
        })
      );

      if (!isMounted) return;
      setDaySections(nextSections);
      setIsLoading(false);
    }

    loadDaySections();

    return () => {
      isMounted = false;
    };
  }, [showId, version]);

  const allClassRows = daySections.flatMap((section) => section.classRows);
  const summary = buildSummary(allClassRows);
  const currentClassRows = buildCurrentClassRows(daySections);

  const refresh = () => setVersion((value) => value + 1);

  const setScoresheetBusy = (classId, isBusy) => {
    setScoresheetBusyClassIds((current) => {
      const next = new Set(current);
      if (isBusy) {
        next.add(classId);
      } else {
        next.delete(classId);
      }
      return next;
    });
  };

  const handleUploadScannedScoresheet = async (classData, file) => {
    const classId = classData?.classItem?.id;
    if (!classId || !file) return;

    setScoresheetBusy(classId, true);
    try {
      await uploadScannedScoresheetRepository({
        associationId,
        showId,
        classId,
        file,
      });
      refresh();
    } catch (error) {
      alert(
        t("management.secretariat.scannedScoresheetUploadFailed", {
          message: error.message || "",
        })
      );
    } finally {
      setScoresheetBusy(classId, false);
    }
  };

  const handleDeleteScannedScoresheet = async (classData) => {
    const classId = classData?.classItem?.id;
    const document = classData?.scoresheetDocument;
    if (!classId || !document) return;

    if (!window.confirm(t("management.secretariat.scannedScoresheetDeleteConfirm"))) {
      return;
    }

    setScoresheetBusy(classId, true);
    try {
      await deleteScannedScoresheetRepository(document);
      refresh();
    } catch (error) {
      alert(
        t("management.secretariat.scannedScoresheetDeleteFailed", {
          message: error.message || "",
        })
      );
    } finally {
      setScoresheetBusy(classId, false);
    }
  };

  const handlePublish = async (classId) => {
    await publishClassRepository(classId, "secretariat");
    refresh();
  };

  const handleUnpublish = async (classId) => {
    await unpublishClassRepository(classId);
    refresh();
  };

  const handlePublishResults = async (classData) => {
    try {
      const publication = await publishClassResultsRepository({
        classData: prepareClassDataForValidation(classData, t),
        publishedBy: "secretariat",
      });
      if (getLocalFirstSyncNoticeTone(publication) !== "synced") {
        alert(formatLocalFirstSyncNotice(publication, t));
      }
      refresh();
    } catch (error) {
      alert(error.message || t("management.secretariat.resultsPublishFailed"));
    }
  };

  const handleUnpublishResults = async (classId) => {
    const publication = await unpublishClassResultsRepository(classId);
    if (getLocalFirstSyncNoticeTone(publication) !== "synced") {
      alert(formatLocalFirstSyncNotice(publication, t));
    }
    refresh();
  };

  const handleDownloadResultsPdf = (classData) => {
    const resultGroups = classData?.resultPublication?.resultGroups || [];
    const publishedAt = classData?.resultPublication?.publishedAt || null;

    if (!resultGroups.length) {
      alert(t("management.secretariat.resultsPdfFailed"));
      return;
    }

    const classItem = classData?.classItem || {};
    const pdf = generateClassResultsPdf({
      associationName: association?.name || t("common.association"),
      associationLogoDataUrl: association?.logoDataUrl || null,
      eventName: show?.name || "",
      eventDate: classData?.official?.eventDate || show?.startDate || "",
      blockName: classItem.name || t("management.classes.unnamedClass"),
      pattern:
        classData?.official?.pattern ||
        classData?.setup?.pattern ||
        classItem.pattern ||
        "",
      publishedAt,
      resultGroups,
    });
    const fileName = buildClassResultsPdfFileName({
      associationAbbreviation: association?.shortName || "ASSOC",
      showName: show?.name || "show",
      blockName: classItem.name || "results",
      publishedAt,
    });

    pdf.save(fileName);
  };

  const handleDownloadAnnouncerResultsPdf = (classData) => {
    const resultGroups = buildAnnouncerResultGroups(classData);

    if (!resultGroups.length) {
      alert(t("management.secretariat.announcerResultsUnavailable"));
      return;
    }

    const classItem = classData?.classItem || {};
    const generatedAt = new Date();
    const pdf = generateClassResultsPdf({
      associationName: association?.name || t("common.association"),
      associationLogoDataUrl: association?.logoDataUrl || null,
      eventName: show?.name || "",
      eventDate: classData?.official?.eventDate || show?.startDate || "",
      blockName: classItem.name || t("management.classes.unnamedClass"),
      pattern:
        classData?.official?.pattern ||
        classData?.setup?.pattern ||
        classItem.pattern ||
        "",
      publishedAt:
        classData?.announcerSession?.updatedAt || generatedAt.toISOString(),
      documentTitle: t("management.secretariat.announcerResultsTitle"),
      resultGroups,
    });
    const fileName = buildClassResultsPdfFileName({
      associationAbbreviation: association?.shortName || "ASSOC",
      showName: show?.name || "show",
      blockName: `${classItem.name || "results"}-announcer`,
      publishedAt: generatedAt,
    });

    pdf.save(fileName);
  };

  const handleDownloadOfficialPdf = async (classData, options = {}) => {
    try {
      await downloadOfficialScorePdf({
        association,
        classData,
        regenerateFileName: Boolean(options.regenerateFileName),
      });
      refresh();
    } catch (error) {
      alert(error.message || t("management.secretariat.pdfGenerateFailed"));
    }
  };

  const handleDownloadJudgePdf = async (classData, judge) => {
    const judgeSummary = getJudgeSheetSummary(classData);
    const judgeRow = judgeSummary.rows.find((row) => row.judge.id === judge.id);

    try {
      await downloadJudgeScorePdf({
        association,
        classData,
        judge: judgeRow?.judge || judge,
        judgeSession: judgeRow?.session,
      });
    } catch (error) {
      alert(error.message || t("management.secretariat.judgePdfFailed"));
    }
  };

  const handleDownloadSetPdf = (classData, approval) => {
    try {
      downloadSetApprovalPdf({
        association,
        classData: {
          ...classData,
          official: {
            ...(classData?.official || {}),
            eventName: show?.name || classData?.official?.eventName || "",
            eventDate:
              classData?.official?.eventDate || show?.startDate || "",
          },
        },
        approval,
      });
    } catch (error) {
      alert(error.message || t("management.secretariat.setPdfFailed"));
    }
  };

  const handleValidateOfficial = async (classData) => {
    try {
      await validateOfficialResultRepository({
        classData: prepareClassDataForValidation(classData, t),
      });
      refresh();
    } catch (error) {
      alert(error.message || t("management.secretariat.validationFailed"));
    }
  };

  const handleValidateAnnouncerResults = async (classData) => {
    try {
      await validateAnnouncerResultsRepository({ classData });
      refresh();
    } catch (error) {
      alert(
        error.message ||
          t("management.secretariat.announcerResultsValidationFailed")
      );
    }
  };

  const handleReleaseJudgeSession = async (classData, judge) => {
    const judgeSummary = getJudgeSheetSummary(classData);
    const judgeRow = judgeSummary.rows.find((row) => row.judge.id === judge.id);
    const judgeName = judgeRow?.displayName || getJudgeDisplayName(judge);
    const confirmed = window.confirm(
      t("management.secretariat.releaseJudgeConfirm", { judgeName })
    );

    if (!confirmed) return;

    try {
      await releaseJudgeScoringSessionRepository({
        classId: classData?.classItem?.id,
        judge,
      });
      refresh();
    } catch (error) {
      alert(error.message || t("management.secretariat.releaseJudgeFailed"));
    }
  };

  if (!show) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={emptyStateStyle}>{t("public.results.showNotFound")}</div>
      </div>
    );
  }

  if (!access.isLoadingAccess && !access.canManageAssociation) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={emptyStateStyle}>
          {t("management.secretariat.accessDenied")}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
      </div>

      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>{t("nav.secretariat")}</div>
          <h1 style={titleStyle}>{show.name || t("common.show")}</h1>
          <div style={subtitleStyle}>
            {association?.shortName || association?.name || t("common.association")} ·{" "}
            {show.venue || show.location || t("public.results.venueTbd")}
          </div>
        </div>
        <div style={heroActionsStyle}>
          <button type="button" onClick={refresh} style={linkButtonStyle}>
            {t("management.secretariat.refresh")}
          </button>
          <Link
            to={`/associations/${associationId}/shows/${showId}/time`}
            style={linkButtonStyle}
          >
            {t("management.secretariat.timeManagement")}
          </Link>
          <Link
            to={`/associations/${associationId}/shows/${showId}`}
            style={linkButtonStyle}
          >
            {t("management.secretariat.manageDays")}
          </Link>
        </div>
      </section>

      <section style={summaryGridStyle}>
        <SummaryTile label={t("management.secretariat.classes")} value={summary.total} />
        <SummaryTile
          label={t("management.classes.statusInProgress")}
          value={summary.inProgress}
          tone={summary.inProgress > 0 ? "warn" : "default"}
        />
        <SummaryTile
          label={t("management.secretariat.signed")}
          value={summary.signed}
          tone={summary.signed > 0 ? "warn" : "default"}
        />
        <SummaryTile
          label={t("management.secretariat.validated")}
          value={summary.validated}
          tone={summary.validated > 0 ? "success" : "default"}
        />
        <SummaryTile
          label={t("management.secretariat.results")}
          value={summary.resultsPublished}
          tone={summary.resultsPublished > 0 ? "success" : "default"}
        />
      </section>

      {!isLoading && currentClassRows.length > 0 && (
        <CurrentClassesPanel
          currentClasses={currentClassRows}
        />
      )}

      {isLoading ? (
        <div style={emptyStateStyle}>{t("management.secretariat.loading")}</div>
      ) : daySections.length === 0 ? (
        <div style={emptyStateStyle}>{t("management.days.empty")}</div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {daySections.map(({ day, classRows }) => (
            <section key={day.id} style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>
                    {day.label || t("management.days.dayFallback")}
                  </h2>
                  <div style={metaStyle}>
                    {day.date || t("public.results.dateTbd")} ·{" "}
                    {t("management.secretariat.classCount", {
                      count: classRows.length,
                    })}
                  </div>
                </div>
                <Link
                  to={`/associations/${associationId}/shows/${showId}/days/${day.id}`}
                  style={linkButtonStyle}
                >
                  {t("management.days.openClasses")}
                </Link>
              </div>

              {classRows.length === 0 ? (
                <div style={softEmptyStyle}>
                  {t("management.secretariat.noClassesForDay")}
                </div>
              ) : (
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>{t("management.secretariat.class")}</th>
                        <th style={thStyle}>{t("management.secretariat.followUp")}</th>
                        <th style={thStyle}>{t("management.secretariat.official")}</th>
                        <th style={thStyle}>{t("management.secretariat.results")}</th>
                        <th style={thStyle}>{t("management.secretariat.documents")}</th>
                        <th style={thStyle}>{t("management.classSetup.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classRows.map((classData) => (
                        <ClassRow
                          key={classData.classItem?.id}
                          associationId={associationId}
                          classData={classData}
                          onDownloadOfficialPdf={handleDownloadOfficialPdf}
                          onDownloadJudgePdf={handleDownloadJudgePdf}
                          onDownloadSetPdf={handleDownloadSetPdf}
                          onValidateOfficial={handleValidateOfficial}
                          onValidateAnnouncerResults={
                            handleValidateAnnouncerResults
                          }
                          onReleaseJudgeSession={handleReleaseJudgeSession}
                          onPublish={handlePublish}
                          onUnpublish={handleUnpublish}
                          onPublishResults={handlePublishResults}
                          onUnpublishResults={handleUnpublishResults}
                          onDownloadResultsPdf={handleDownloadResultsPdf}
                          onOpenAnnouncerResults={setAnnouncerResultsPreview}
                          onUploadScannedScoresheet={
                            handleUploadScannedScoresheet
                          }
                          onDeleteScannedScoresheet={
                            handleDeleteScannedScoresheet
                          }
                          isScoresheetBusy={scoresheetBusyClassIds.has(
                            classData.classItem?.id
                          )}
                          canManage={access.canManageAssociation}
                          language={language}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {announcerResultsPreview && (
        <AnnouncerResultsPreview
          classData={announcerResultsPreview}
          onClose={() => setAnnouncerResultsPreview(null)}
          onDownload={() =>
            handleDownloadAnnouncerResultsPdf(announcerResultsPreview)
          }
        />
      )}
    </div>
  );
}

function CurrentClassesPanel({ currentClasses }) {
  const { t } = useTranslation();

  return (
    <section style={currentClassesPanelStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h2 style={sectionTitleStyle}>
            {t("management.livePace.currentClasses")}
          </h2>
          <div style={metaStyle}>
            {t("management.secretariat.classCount", {
              count: currentClasses.length,
            })}
          </div>
        </div>
      </div>

      {currentClasses.length === 0 ? (
        <div style={softEmptyStyle}>
          {t("management.livePace.noCurrentClasses")}
        </div>
      ) : (
        <div style={currentClassesGridStyle}>
          {currentClasses.map(({ classData, day, timing }) => {
            const classItem = classData.classItem || {};
            const setup = classData.setup || {};
            const classId = classItem.id;

            return (
              <div
                key={`${day?.id || "day"}-${classId || classItem.name}`}
                style={currentClassCardStyle}
              >
                <div style={currentClassHeaderStyle}>
                  <div>
                    <div style={classNameStyle}>
                      {classItem.name || t("management.classes.unnamedClass")}
                      {classItem.classCode ? ` (${classItem.classCode})` : ""}
                    </div>
                    <div style={metaStyle}>
                      {day?.label || t("management.days.dayFallback")} ·{" "}
                      {t("public.results.pattern")}{" "}
                      {setup.pattern || classItem.pattern || "—"}
                    </div>
                  </div>
                  <Badge tone="warn">
                    {getCurrentClassStatusLabel(classData, t)}
                  </Badge>
                </div>
                <ClassPaceSummary pace={timing} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ClassRow({
  associationId,
  classData,
  onDownloadOfficialPdf,
  onDownloadJudgePdf,
  onDownloadSetPdf,
  onValidateOfficial,
  onValidateAnnouncerResults,
  onReleaseJudgeSession,
  onPublish,
  onUnpublish,
  onPublishResults,
  onUnpublishResults,
  onDownloadResultsPdf,
  onOpenAnnouncerResults,
  onUploadScannedScoresheet,
  onDeleteScannedScoresheet,
  isScoresheetBusy,
  canManage,
  language,
}) {
  const { t } = useTranslation();
  const classItem = classData.classItem;
  const setup = classData.setup;
  const official = classData.official;
  const publication = classData.publication;
  const resultPublication = classData.resultPublication;
  const scoresheetDocument = classData.scoresheetDocument;
  const scoresheetPublicUrl =
    getScannedScoresheetPublicUrl(scoresheetDocument);
  const scoringRuns = classData.scoringRuns || [];
  const classId = classItem?.id;
  const judgeSummary = getJudgeSheetSummary(classData);
  const isMultiJudge = judgeSummary.isMultiJudge;
  const finalPdfFileName = getOfficialPdfFileName(classData);
  const hasOfficialPdf = Boolean(finalPdfFileName);
  const isSigned = isMultiJudge
    ? judgeSummary.allSigned
    : Boolean(official?.isFinalized);
  const announcerResultsCompleted = hasCompletedAnnouncerResults(classData);
  const hasAnnouncerResults = hasAnnouncerEnteredResults(classData);
  const announcerResultsApproved = isAnnouncerResultsApproval(classData);
  const isValidated = isClassResultsSecretariatApproved(classData);
  const hasOfficialScoresheet = isSigned && !announcerResultsApproved;
  const officialPdfReady = hasOfficialScoresheet && isValidated && hasOfficialPdf;
  const resultsPublished =
    resultPublication?.status === RESULT_PUBLICATION_STATUSES.PUBLISHED;
  const resultGroupCount = Array.isArray(resultPublication?.resultGroups)
    ? resultPublication.resultGroups.length
    : 0;

  const setupReady = Boolean((setup?.pattern || classItem?.pattern) && setup?.runs?.length);
  const scoringStarted = isMultiJudge
    ? judgeSummary.anyStarted
    : scoringRuns.some(runHasScoringData);
  const scoringComplete = isMultiJudge
    ? judgeSummary.allSigned || isValidated
    : classData.status === "completed" ||
      isSigned ||
      announcerResultsCompleted ||
      isValidated;
  const scoringBadge = scoringComplete
    ? { label: t("management.secretariat.scoringCompleted"), tone: "success" }
    : scoringStarted
      ? { label: t("management.secretariat.scoringInProgress"), tone: "warn" }
      : { label: t("management.secretariat.scoringNotStarted"), tone: "muted" };
  const setApprovalRows = getSetApprovalRows(classData, judgeSummary);

  return (
    <tr>
      <td style={tdStyle}>
        <div style={classNameStyle}>
          {classItem?.name || t("management.classes.unnamedClass")}
          {classItem?.classCode ? ` (${classItem.classCode})` : ""}
        </div>
        <div style={metaStyle}>
          {t("public.results.pattern")} {setup?.pattern || classItem?.pattern || "—"}
        </div>
        <div style={inlineStatusStyle}>
          <Badge tone={setupReady ? "success" : "muted"}>
            {setupReady
              ? t("management.secretariat.setupRunCount", {
                  count: setup.runs.length,
                })
              : t("management.secretariat.setupIncomplete")}
          </Badge>
        </div>
      </td>
      <td style={tdStyle}>
        <Badge tone={scoringBadge.tone}>{scoringBadge.label}</Badge>
        {(isMultiJudge || setApprovalRows.length > 0) && (
          <details style={compactDetailsStyle}>
            <summary style={compactSummaryStyle}>
              {t("management.secretariat.judgeSheetDetails", {
                count: judgeSummary.rows.length,
              })}
            </summary>
            {isMultiJudge && (
              <div style={judgeStatusListStyle}>
                <div style={judgeStatusTitleStyle}>
                  {t("management.secretariat.judgeSheets")}
                </div>
                {judgeSummary.rows.map((row) => (
                  <div key={row.judge.id} style={judgeStatusRowStyle}>
                    <div style={judgeStatusTextStyle}>
                      <span style={judgeStatusNameStyle}>{row.displayName}</span>
                      {row.session?.claimedByEmail && (
                        <span style={judgeStatusMetaStyle}>
                          {t("management.secretariat.judgeReservedBy", {
                            email: row.session.claimedByEmail,
                          })}
                        </span>
                      )}
                    </div>
                    <div style={judgeStatusActionsStyle}>
                      <Badge
                        tone={
                          row.signed ? "success" : row.started ? "warn" : "muted"
                        }
                      >
                        {row.signed
                          ? t("management.secretariat.judgeSigned")
                          : row.started
                            ? t("management.secretariat.judgeInProgress")
                            : t("management.secretariat.judgeNotStarted")}
                      </Badge>
                      {canManage && row.signed && (
                        <button
                          type="button"
                          onClick={() => onDownloadJudgePdf(classData, row.judge)}
                          style={tinyButtonStyle}
                        >
                          {t("management.secretariat.judgePdf")}
                        </button>
                      )}
                      {canManage &&
                        row.session?.claimedBy &&
                        !row.signed && (
                          <button
                            type="button"
                            onClick={() =>
                              onReleaseJudgeSession(classData, row.judge)
                            }
                            style={tinyButtonStyle}
                          >
                            {t("management.secretariat.releaseJudge")}
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {setApprovalRows.length > 0 && (
              <div style={judgeStatusListStyle}>
                <div style={judgeStatusTitleStyle}>
                  {t("management.secretariat.setSheets")}
                </div>
                {setApprovalRows.map(({ approval, judgeName }) => (
                  <div key={approval.id} style={judgeStatusRowStyle}>
                    <div style={judgeStatusTextStyle}>
                      <span style={judgeStatusNameStyle}>
                        {t("management.secretariat.setSheetLabel", {
                          set: approval.setNumber,
                          start: approval.startDraw,
                          end: approval.endDraw,
                        })}
                      </span>
                      <span style={judgeStatusMetaStyle}>
                        {judgeName} ·{" "}
                        {formatDateTime(approval.sentAt, language)}
                      </span>
                    </div>
                    <div style={judgeStatusActionsStyle}>
                      <Badge tone="success">
                        {t("management.secretariat.setReceived")}
                      </Badge>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => onDownloadSetPdf(classData, approval)}
                          style={tinyButtonStyle}
                        >
                          {t("management.secretariat.setPdf")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </details>
        )}
      </td>
      <td style={tdStyle}>
        <Badge tone={isValidated ? "success" : isSigned ? "warn" : "muted"}>
          {isValidated
            ? announcerResultsApproved
              ? t("management.secretariat.announcerResultsValidated")
              : t("management.secretariat.officialValidated")
            : isSigned
              ? t("management.secretariat.officialSignedToValidate")
              : announcerResultsCompleted
                ? t("management.secretariat.announcerResultsToValidate")
              : getClassStatusLabel(classData.status, t)}
        </Badge>
        {isValidated && official?.secretariatValidatedAt && (
          <div style={metaStyle}>
            {t("management.secretariat.validatedAt", {
              date: formatDateTime(official.secretariatValidatedAt, language),
            })}
          </div>
        )}
        {isMultiJudge && !isSigned && !isValidated && (
          <div style={metaStyle}>
            {t("management.secretariat.multiJudgeValidationBlocked")}
          </div>
        )}
      </td>
      <td style={tdStyle}>
        <div style={statusStackStyle}>
          <Badge tone={resultsPublished ? "success" : isValidated ? "warn" : "muted"}>
            {resultsPublished
              ? t("management.secretariat.resultsPublished", {
                  count: resultGroupCount,
                })
              : isValidated
                ? t("management.secretariat.resultsReady")
                : t("management.secretariat.resultsPending")}
          </Badge>
          {resultPublication?.publishedAt && (
            <div style={metaStyle}>
              {t("management.secretariat.publishedAt", {
                date: formatDateTime(resultPublication.publishedAt, language),
              })}
            </div>
          )}
        </div>
      </td>
      <td style={tdStyle}>
        <div style={statusStackStyle}>
          <Badge
            tone={
              scoresheetDocument
                ? "success"
                : officialPdfReady
                  ? "success"
                  : isSigned
                    ? "warn"
                    : "muted"
            }
          >
            {scoresheetDocument
              ? t("management.secretariat.scannedScoresheetAvailable")
              : announcerResultsApproved
              ? t("management.secretariat.noScoresheet")
              : isMultiJudge && officialPdfReady
              ? t("management.secretariat.combinedPdfGenerated")
              : isMultiJudge && isValidated
                ? t("management.secretariat.multiJudgePdfPending")
              : officialPdfReady
                ? t("management.secretariat.pdfGenerated")
                : isSigned && !isValidated
                  ? t("management.secretariat.pdfValidationRequired")
                  : t("management.secretariat.pdfToGenerate")}
          </Badge>
          {scoresheetDocument ? (
            <div style={fileNameStyle} title={scoresheetDocument.fileName}>
              {scoresheetDocument.fileName || "scoresheet.pdf"}
              {scoresheetDocument.fileSize
                ? ` · ${formatScannedScoresheetSize(
                    scoresheetDocument.fileSize
                  )}`
                : ""}
            </div>
          ) : officialPdfReady && finalPdfFileName ? (
            <div style={fileNameStyle} title={finalPdfFileName}>
              {finalPdfFileName}
            </div>
          ) : null}
          {scoresheetDocument && scoresheetPublicUrl ? (
            <a
              href={scoresheetPublicUrl}
              target="_blank"
              rel="noreferrer"
              style={tinyLinkButtonStyle}
            >
              {t("management.secretariat.scannedScoresheetOpen")}
            </a>
          ) : null}
          {canManage ? (
            <div style={judgeStatusActionsStyle}>
              <label
                style={
                  isScoresheetBusy
                    ? disabledUploadLabelStyle
                    : tinyUploadLabelStyle
                }
              >
                {isScoresheetBusy
                  ? t("management.secretariat.scannedScoresheetUploading")
                  : scoresheetDocument
                    ? t("management.secretariat.scannedScoresheetReplace")
                    : t("management.secretariat.scannedScoresheetUpload")}
                {!isScoresheetBusy ? (
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    style={hiddenFileInputStyle}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      event.target.value = "";
                      onUploadScannedScoresheet(classData, file);
                    }}
                  />
                ) : null}
              </label>
            </div>
          ) : null}
          <div style={documentPublicationStyle}>
            <span>{t("management.secretariat.publication")}:</span>
            <Badge
              tone={
                publication?.status === PUBLICATION_STATUSES.PUBLISHED
                  ? "success"
                  : "muted"
              }
            >
              {getPublicationStatusLabel(
                publication?.status || PUBLICATION_STATUSES.HIDDEN,
                t
              )}
            </Badge>
          </div>
        </div>
      </td>
      <td style={tdStyle}>
        <div style={rowActionStackStyle}>
          {canManage ? (
            <div>
              {isSigned && !isValidated ? (
                <button
                  type="button"
                  onClick={() => onValidateOfficial(classData)}
                  style={smallPrimaryButtonStyle}
                >
                  {t("management.secretariat.validateOfficial")}
                </button>
              ) : announcerResultsCompleted && !isValidated && !isSigned ? (
                <button
                  type="button"
                  onClick={() => onValidateAnnouncerResults(classData)}
                  style={smallPrimaryButtonStyle}
                >
                  {t("management.secretariat.validateAnnouncerResults")}
                </button>
              ) : isValidated && !resultsPublished ? (
                <button
                  type="button"
                  onClick={() => onPublishResults(classData)}
                  style={smallPrimaryButtonStyle}
                >
                  {t("management.secretariat.publishResults")}
                </button>
              ) : resultsPublished && announcerResultsApproved ? (
                <button
                  type="button"
                  onClick={() => onPublishResults(classData)}
                  style={smallPrimaryButtonStyle}
                >
                  {t("management.secretariat.updateAnnouncerResults")}
                </button>
              ) : (
                <Badge>
                  {t("management.secretariat.noActionRequired")}
                </Badge>
              )}
            </div>
          ) : null}

          <details style={actionDetailsStyle}>
            <summary style={actionSummaryStyle}>
              {t("management.secretariat.moreActions")}
            </summary>
            <div style={secondaryActionsPanelStyle}>
              <Link
                to={`/associations/${associationId}/classes/${classId}/setup`}
                style={smallLinkButtonStyle}
              >
                {t("management.secretariat.setup")}
              </Link>
              {hasAnnouncerResults && (
                <button
                  type="button"
                  onClick={() => onOpenAnnouncerResults(classData)}
                  style={smallButtonStyle}
                >
                  {t("management.secretariat.viewAnnouncerResults")}
                </button>
              )}
              {hasOfficialScoresheet && isValidated && (
                <button
                  type="button"
                  onClick={() => onDownloadOfficialPdf(classData)}
                  style={smallButtonStyle}
                >
                  {isMultiJudge
                    ? t("management.secretariat.combinedPdf")
                    : officialPdfReady
                      ? t("public.results.downloadPdf")
                      : t("management.secretariat.generatePdf")}
                </button>
              )}
              {officialPdfReady && (
                <button
                  type="button"
                  onClick={() =>
                    onDownloadOfficialPdf(classData, { regenerateFileName: true })
                  }
                  style={smallButtonStyle}
                >
                  {t("management.secretariat.regenerate")}
                </button>
              )}
              {resultsPublished && (
                <>
                  <button
                    type="button"
                    onClick={() => onDownloadResultsPdf(classData)}
                    style={smallButtonStyle}
                  >
                    {t("management.secretariat.downloadResultsPdf")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUnpublishResults(classId)}
                    style={smallButtonStyle}
                  >
                    {t("management.secretariat.hideResults")}
                  </button>
                </>
              )}
              {publication?.status === PUBLICATION_STATUSES.PUBLISHED ? (
                <button
                  type="button"
                  onClick={() => onUnpublish(classId)}
                  style={smallButtonStyle}
                >
                  {t("management.secretariat.hide")}
                </button>
              ) : hasOfficialScoresheet && isValidated && officialPdfReady ? (
                <button
                  type="button"
                  onClick={() => onPublish(classId)}
                  style={smallButtonStyle}
                >
                  {t("management.secretariat.publish")}
                </button>
              ) : null}
              {scoresheetDocument ? (
                <button
                  type="button"
                  onClick={() => onDeleteScannedScoresheet(classData)}
                  style={smallButtonStyle}
                  disabled={isScoresheetBusy}
                >
                  {t("management.secretariat.scannedScoresheetDelete")}
                </button>
              ) : null}
            </div>
          </details>
        </div>
      </td>
    </tr>
  );
}

function AnnouncerResultsPreview({ classData, onClose, onDownload }) {
  const { t } = useTranslation();
  const groups = buildAnnouncerResultGroups(classData);
  const className =
    classData?.classItem?.name || t("management.classes.unnamedClass");

  return (
    <div style={modalBackdropStyle} role="dialog" aria-modal="true">
      <section style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>
              {t("management.secretariat.announcerResultsSource")}
            </div>
            <h2 style={sectionTitleStyle}>
              {t("management.secretariat.announcerResultsTitle")}
            </h2>
            <div style={metaStyle}>{className}</div>
          </div>
          <div style={actionRowStyle}>
            <button type="button" onClick={onDownload} style={smallButtonStyle}>
              {t("management.secretariat.downloadAnnouncerResultsPdf")}
            </button>
            <button type="button" onClick={onClose} style={smallButtonStyle}>
              {t("management.secretariat.close")}
            </button>
          </div>
        </div>

        <div style={modalResultListStyle}>
          {groups.map((group) => (
            <section key={group.id} style={modalResultGroupStyle}>
              <h3 style={modalResultTitleStyle}>
                {group.className || group.classCode || group.code}
                {group.classCode ? ` (${group.classCode})` : ""}
              </h3>
              <div style={tableWrapStyle}>
                <table style={modalResultTableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>{t("public.results.rank")}</th>
                      <th style={thStyle}>{t("public.results.backNumber")}</th>
                      <th style={thStyle}>{t("public.results.rider")}</th>
                      <th style={thStyle}>{t("public.results.horse")}</th>
                      <th style={thStyle}>{t("public.results.score")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.entries.map((entry) => (
                      <tr key={`${group.id}-${entry.id}`}>
                        <td style={tdStyle}>{entry.rank || "—"}</td>
                        <td style={tdStyle}>{entry.backNumber || "—"}</td>
                        <td style={tdStyle}>{entry.rider || "—"}</td>
                        <td style={tdStyle}>{entry.horse || "—"}</td>
                        <td style={tdStyle}>
                          {entry.scoreTotal || entry.status || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function hasAnnouncerEnteredResults(classData) {
  return (classData?.announcerSession?.runs || []).some((run) => {
    const status = String(run?.status || "").trim().toLowerCase();
    return (
      Boolean(String(run?.scoreTotal || "").trim()) ||
      ["scored", "no_score", "scratch", "review"].includes(status)
    );
  });
}

function SummaryTile({ label, value, tone = "default" }) {
  return (
    <div style={summaryTileStyle(tone)}>
      <div style={summaryValueStyle}>{value}</div>
      <div style={summaryLabelStyle}>{label}</div>
    </div>
  );
}

function getSetApprovalRows(classData, judgeSummary) {
  if (judgeSummary.isMultiJudge) {
    return judgeSummary.rows.flatMap((row) =>
      (row.session?.setApprovals || []).map((approval) => ({
        approval,
        judgeName: approval.judgeName || row.displayName,
      }))
    );
  }

  return (classData?.setup?.setApprovals || []).map((approval) => ({
    approval,
    judgeName: approval.judgeName || classData?.setup?.judgeName || "—",
  }));
}

function Badge({ children, tone = "default" }) {
  return <span style={badgeStyle(tone)}>{children}</span>;
}

function buildCurrentClassRows(daySections) {
  const allClassRows = daySections.flatMap((section) => section.classRows || []);
  const patternAverageByValue = new Map(
    buildPatternTimingStats(allClassRows).map((stat) => [
      stat.pattern,
      stat.averageRunSeconds,
    ])
  );

  return daySections.flatMap((section) =>
    (section.classRows || [])
      .filter(isCurrentSecretariatClass)
      .map((classData) => ({
        day: section.day,
        classData,
        timing: buildClassTimingRow({
          classData,
          day: section.day,
          patternAverageRunSeconds:
            patternAverageByValue.get(getClassPatternValue(classData)) || null,
        }),
      }))
  );
}

function isCurrentSecretariatClass(classData) {
  if (classData?.status === "in_progress") return true;

  if (
    CURRENT_SECRETARIAT_PUBLICATION_STATUSES.includes(
      classData?.publication?.status
    )
  ) {
    return true;
  }

  const judgeSummary = getJudgeSheetSummary(classData);
  return Boolean(
    judgeSummary.isMultiJudge && judgeSummary.anyStarted && !judgeSummary.allSigned
  );
}

function getCurrentClassStatusLabel(classData, t) {
  if (
    CURRENT_SECRETARIAT_PUBLICATION_STATUSES.includes(
      classData?.publication?.status
    )
  ) {
    return getPublicationStatusLabel(classData.publication.status, t);
  }

  return getClassStatusLabel(classData?.status, t);
}

function buildSummary(classRows) {
  return classRows.reduce(
    (summary, classData) => {
      const status = classData.status;
      const publicationStatus = classData.publication?.status;
      const resultPublicationStatus = classData.resultPublication?.status;
      const judgeSummary = getJudgeSheetSummary(classData);
      const isSigned = judgeSummary.isMultiJudge
        ? judgeSummary.allSigned
        : Boolean(classData.official?.isFinalized);
      const isValidated = isClassResultsSecretariatApproved(classData);
      const isInProgress = judgeSummary.isMultiJudge
        ? judgeSummary.anyStarted && !judgeSummary.allSigned
        : status === "in_progress";

      summary.total += 1;
      if (status === "draft") summary.draft += 1;
      if (status === "ready") summary.ready += 1;
      if (isInProgress) summary.inProgress += 1;
      if (isSigned && !isValidated) summary.signed += 1;
      if (isValidated) summary.validated += 1;
      if (isValidated && getOfficialPdfFileName(classData)) {
        summary.pdfReady += 1;
      }
      if (resultPublicationStatus === RESULT_PUBLICATION_STATUSES.PUBLISHED) {
        summary.resultsPublished += 1;
      }
      if (publicationStatus === "published") summary.published += 1;
      return summary;
    },
    {
      total: 0,
      draft: 0,
      ready: 0,
      inProgress: 0,
      signed: 0,
      validated: 0,
      resultsPublished: 0,
      pdfReady: 0,
      published: 0,
    }
  );
}

function prepareClassDataForValidation(classData, t) {
  const judgeSummary = getJudgeSheetSummary(classData);

  if (!judgeSummary.isMultiJudge) {
    return classData;
  }

  const signedAt = getLatestTimestamp(
    judgeSummary.rows.map(
      (row) => row.session?.judgeSignedAt || row.session?.finalizedAt
    )
  );

  return {
    ...classData,
    official: {
      ...classData.official,
      judgeName: t("management.secretariat.multiJudgeOfficialName"),
      judgeSignature: null,
      isFinalized: judgeSummary.allSigned,
      finalizedAt: signedAt,
      judgeSignedAt: signedAt,
      judgeSessions: judgeSummary.rows.map((row) => row.session),
      multiJudgeFinalized: judgeSummary.allSigned,
    },
    scoringRuns: buildMultiJudgeOfficialRuns(classData, judgeSummary.rows),
  };
}

function getClassStatusLabel(status, t) {
  switch (status) {
    case "draft":
      return t("management.classes.statusDraft");
    case "ready":
      return t("management.classes.statusReady");
    case "in_progress":
      return t("management.classes.statusInProgress");
    case "completed":
      return t("management.classes.statusCompleted");
    default:
      return "—";
  }
}

function getPublicationStatusLabel(status, t) {
  switch (status) {
    case PUBLICATION_STATUSES.LIVE:
      return t("public.status.live");
    case PUBLICATION_STATUSES.LIVE_NO_SCORE:
      return t("public.status.liveNoScore");
    case PUBLICATION_STATUSES.LIVE_SCORING:
      return t("public.status.liveScoring");
    case PUBLICATION_STATUSES.LIVE_FINISHED:
      return t("public.status.liveFinished");
    case PUBLICATION_STATUSES.OFFICIAL:
      return t("public.status.official");
    case PUBLICATION_STATUSES.PUBLISHED:
      return t("public.status.published");
    case PUBLICATION_STATUSES.HIDDEN:
    default:
      return t("public.status.hidden");
  }
}

function formatDateTime(value, language = "fr") {
  if (!value) return "";

  return new Date(value).toLocaleString(language === "en" ? "en-CA" : "fr-CA", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const heroStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const eyebrowStyle = {
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 28,
};

const subtitleStyle = {
  color: "#64748b",
};

const heroActionsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const summaryTileStyle = (tone) => ({
  background: tone === "success" ? "#ecfdf5" : tone === "warn" ? "#fff7ed" : "#fff",
  border: `1px solid ${
    tone === "success" ? "#86efac" : tone === "warn" ? "#fdba74" : "#e2e8f0"
  }`,
  borderRadius: 8,
  padding: 14,
});

const summaryValueStyle = {
  fontSize: 28,
  fontWeight: 800,
  color: "#0f172a",
};

const summaryLabelStyle = {
  color: "#64748b",
  marginTop: 4,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const currentClassesPanelStyle = {
  ...cardStyle,
  marginBottom: 16,
};

const currentClassesGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 12,
};

const currentClassCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  background: "#fff",
};

const currentClassHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  flexWrap: "wrap",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 20,
};

const tableWrapStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  minWidth: 940,
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
  background: "#f8fafc",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};

const classNameStyle = {
  fontWeight: 700,
};

const metaStyle = {
  color: "#64748b",
  marginTop: 4,
  fontSize: 13,
};

const inlineStatusStyle = {
  marginTop: 8,
};

const compactDetailsStyle = {
  marginTop: 8,
};

const compactSummaryStyle = {
  width: "fit-content",
  color: "#475569",
  fontSize: 12,
  fontWeight: 750,
  cursor: "pointer",
};

const judgeStatusListStyle = {
  display: "grid",
  gap: 8,
  marginTop: 10,
  minWidth: 300,
};

const judgeStatusTitleStyle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const judgeStatusRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
  padding: "8px 0",
  borderTop: "1px solid #e2e8f0",
};

const judgeStatusTextStyle = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

const judgeStatusNameStyle = {
  fontWeight: 700,
  color: "#111827",
};

const judgeStatusMetaStyle = {
  color: "#64748b",
  fontSize: 12,
};

const judgeStatusActionsStyle = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const fileNameStyle = {
  color: "#64748b",
  fontSize: 12,
  maxWidth: 180,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const actionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const documentPublicationStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
  marginTop: 4,
  color: "#64748b",
  fontSize: 12,
};

const statusStackStyle = {
  display: "grid",
  justifyItems: "start",
  gap: 6,
};

const rowActionStackStyle = {
  display: "grid",
  gap: 10,
  minWidth: 170,
};

const actionDetailsStyle = {
  position: "relative",
};

const actionSummaryStyle = {
  width: "fit-content",
  color: "#334155",
  fontWeight: 750,
  fontSize: 13,
  cursor: "pointer",
};

const secondaryActionsPanelStyle = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
  marginTop: 9,
  padding: 10,
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#f8fafc",
};

const badgeStyle = (tone) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "4px 9px",
  borderRadius: 999,
  border: `1px solid ${
    tone === "success" ? "#86efac" : tone === "warn" ? "#fdba74" : "#cbd5e1"
  }`,
  background: tone === "success" ? "#ecfdf5" : tone === "warn" ? "#fff7ed" : "#f8fafc",
  color: tone === "success" ? "#166534" : tone === "warn" ? "#9a3412" : "#475569",
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: "nowrap",
});

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

const smallLinkButtonStyle = {
  ...linkButtonStyle,
  padding: "7px 10px",
};

const smallButtonStyle = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

const tinyButtonStyle = {
  ...smallButtonStyle,
  padding: "5px 8px",
  fontSize: 12,
};

const tinyLinkButtonStyle = {
  ...linkButtonStyle,
  width: "fit-content",
  padding: "5px 8px",
  fontSize: 12,
};

const tinyUploadLabelStyle = {
  ...tinyButtonStyle,
  display: "inline-flex",
  alignItems: "center",
};

const disabledUploadLabelStyle = {
  ...tinyUploadLabelStyle,
  opacity: 0.6,
  cursor: "wait",
};

const hiddenFileInputStyle = {
  display: "none",
};

const smallPrimaryButtonStyle = {
  ...smallButtonStyle,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
  marginTop: 16,
};

const softEmptyStyle = {
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  padding: 14,
  color: "#64748b",
};

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(15, 23, 42, 0.62)",
  display: "grid",
  placeItems: "center",
  padding: 16,
};

const modalStyle = {
  width: "min(100%, 980px)",
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 12,
  padding: 18,
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
};

const modalResultListStyle = {
  display: "grid",
  gap: 16,
};

const modalResultGroupStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  overflow: "hidden",
};

const modalResultTitleStyle = {
  margin: 0,
  padding: "12px 14px",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 17,
};

const modalResultTableStyle = {
  width: "100%",
  minWidth: 680,
  borderCollapse: "collapse",
};

export default SecretariatDashboardPage;
