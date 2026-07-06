import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAssociationRepository } from "../../features/associations/associationRepository";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import {
  applyChampionshipEventLabels,
  buildChampionshipDatasetFromImports,
  buildChampionshipImportBatchFromCsv,
  getChampionshipIncludedShows,
  buildChampionshipResultDuplicateKey,
  isChampionshipRowIgnored,
} from "../../features/championship/championshipStandings";
import {
  getLatestChampionshipSeasonRepository,
  saveChampionshipSeasonRepository,
} from "../../features/championship/championshipRepository";
import {
  formatLocalFirstSyncNotice,
  getLocalFirstSyncNoticeTone,
} from "../../features/cloud/localFirstSyncMessages";
import { formatChampionshipPoints } from "../../features/championship/championshipPoints";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";
import {
  buildChampionshipPdfFileName,
  generateChampionshipPdf,
} from "../../utils/generateChampionshipPdf";

function AssociationChampionshipPage() {
  const { associationId } = useParams();
  const { t } = useTranslation();
  const access = useAssociationAccess(associationId);
  const [association, setAssociation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [season, setSeason] = useState(null);
  const [seasonTitle, setSeasonTitle] = useState("Championnat de saison");
  const [seasonYear, setSeasonYear] = useState(String(new Date().getFullYear()));
  const [seasonStatus, setSeasonStatus] = useState("draft");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [resetFiles, setResetFiles] = useState([]);
  const [resetInputKey, setResetInputKey] = useState(0);
  const [preview, setPreview] = useState(null);
  const [eventLabels, setEventLabels] = useState({});
  const [pendingDuplicateImport, setPendingDuplicateImport] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isReadingReset, setIsReadingReset] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [nextAssociation, nextSeason] = await Promise.all([
        getAssociationRepository(associationId),
        Promise.resolve(getLatestChampionshipSeasonRepository(associationId)),
      ]);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setSeason(nextSeason);
      if (nextSeason) {
        setSeasonTitle(nextSeason.title || "Championnat de saison");
        setSeasonYear(nextSeason.year || String(new Date().getFullYear()));
        setSeasonStatus(nextSeason.status || "draft");
        setEventLabels(nextSeason.publicEventLabels || {});
        setPreview(nextSeason);
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

  const rebuildPreviewFromImports = (
    imports,
    labels = eventLabels,
    nextStatus = seasonStatus
  ) => {
    const nextEventLabels = sanitizeEventLabels(labels);
    const dataset = buildChampionshipDatasetFromImports({
      imports,
      seasonTitle,
      year: seasonYear,
      status: nextStatus,
    });

    return applyChampionshipEventLabels(
      {
        ...dataset,
        id: season?.id || preview?.id || "",
        associationId,
      },
      nextEventLabels
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
    const nextPreview = rebuildPreviewFromImports(nextImports, nextEventLabels);
    setEventLabels(nextEventLabels);
    setPreview(nextPreview);
    setPendingDuplicateImport(null);
    setCsvText("");
    setFileName("");
    setFileInputKey((current) => current + 1);
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
    setSaveMessage("");
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
    setPreview((current) => applyChampionshipEventLabels(current, nextLabels));
  };

  const saveSeason = async (nextStatus = seasonStatus) => {
    if (!preview) return;

    setIsSaving(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const allowedKeys = new Set(technicalShows.map((event) => event.key));
      const nextEventLabels = sanitizeEventLabels(eventLabels, allowedKeys);
      const labeledPreview = applyChampionshipEventLabels(preview, nextEventLabels);
      const saved = await saveChampionshipSeasonRepository({
        ...labeledPreview,
        id: season?.id || preview.id,
        associationId,
        title: seasonTitle,
        year: seasonYear,
        status: nextStatus,
        publicEventLabels: nextEventLabels,
      });
      setSeason(saved);
      setPreview(saved);
      setEventLabels(nextEventLabels);
      setSeasonStatus(saved.status || nextStatus);
      setSaveMessage(
        getLocalFirstSyncNoticeTone(saved) === "synced"
          ? t("championship.admin.saved")
          : formatLocalFirstSyncNotice(saved, t)
      );
    } catch (error) {
      setErrorMessage(error?.message || t("common.saveFailed", { message: "" }));
    } finally {
      setIsSaving(false);
    }
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

          {technicalShows.length > 0 && (
            <section style={panelStyle}>
              <div style={sectionTitleStyle}>{t("championship.admin.publicLabels")}</div>
              <div style={mutedTextStyle}>
                {t("championship.admin.publicLabelsHelp")}
              </div>
              <div style={labelGridStyle}>
                {technicalShows.map((event) => (
                  <label key={event.key} style={fieldStyle}>
                    <span style={labelStyle}>
                      {event.showName || event.key}{" "}
                      <span style={mutedInlineStyle}>
                        ({t("championship.admin.eventCount", {
                          count: event.occurrenceCount,
                        })})
                      </span>
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

function sanitizeEventLabels(labelsByShow, allowedKeys = null) {
  return Object.fromEntries(
    Object.entries(labelsByShow || {})
      .map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
      .filter(([key, value]) => key && value && (!allowedKeys || allowedKeys.has(key)))
  );
}

function formatShortDateTime(value) {
  if (!value) return "-";

  return String(value).slice(0, 16).replace("T", " ");
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsText(file, "UTF-8");
  });
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
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
  marginTop: 12,
};

const fieldStyle = {
  display: "grid",
  gap: 6,
};

const labelStyle = {
  fontWeight: 800,
  color: "#334155",
  fontSize: 13,
};

const inputStyle = {
  minHeight: 42,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "9px 10px",
  fontSize: 14,
  boxSizing: "border-box",
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
