import React, { useEffect, useMemo, useState } from "react";
import RunRows from "./RunRows";
import { useTranslation } from "../features/i18n/I18nProvider";
import { shouldFitScoringTableToViewport } from "../features/scoring/scoringTableViewport";

function getShouldFitTable() {
  if (typeof window === "undefined") return false;

  return shouldFitScoringTableToViewport({
    width: window.innerWidth,
    height: window.innerHeight,
  });
}

function buildTableStyles(styles, shouldFitTable) {
  if (!shouldFitTable) return styles;

  return {
    ...styles,
    tableWrap: {
      ...styles.tableWrap,
      width: "100%",
      maxWidth: "100%",
      padding: "6px",
      boxSizing: "border-box",
    },
    table: {
      ...styles.table,
      minWidth: "100%",
      tableLayout: "fixed",
    },
    th: {
      ...styles.th,
      minWidth: 0,
      padding: "10px 2px",
      fontSize: "11px",
      lineHeight: 1.15,
      overflowWrap: "anywhere",
    },
    td: {
      ...styles.td,
      minWidth: 0,
      padding: "10px 2px",
      fontSize: "13px",
    },
    typeCell: {
      ...styles.typeCell,
      minWidth: 0,
      padding: "10px 2px",
      fontSize: "12px",
    },
    mergedMainCell: {
      ...styles.mergedMainCell,
      minWidth: 0,
    },
    mergedCell: {
      ...styles.mergedCell,
      minWidth: 0,
    },
    backNumberInput: {
      ...styles.backNumberInput,
      fontSize: "13px",
    },
  };
}

function ScoreTable({
  headers,
  runs,
  dragInterval,
  dragDurationMinutes,
  activeManoeuvre,
  setActiveManoeuvre,
  activeDrag,
  scoreOptions,
  scoreOptionsByIndex,
  penaltyOptions,
  specialPenaltyTokens,
  penaltyDisabledIndexes,
  statusPenaltyOptions,
  updateScoreCell,
  clearScoreCell,
  addPenaltyToken,
  toggleSpecialPenalty,
  clearPenaltyCell,
  updateBackNumber,
  updateRunNote,
  onStartDrag,
  onStopDrag,
  canStartDragAfterRun,
  isLocked,
  isRunLocked,
  isBackNumberLocked,
  styles,
}) {
  const { t } = useTranslation();
  const [shouldFitTable, setShouldFitTable] = useState(getShouldFitTable);
  const tableStyles = useMemo(
    () => buildTableStyles(styles, shouldFitTable),
    [shouldFitTable, styles]
  );
  const normalizedDragInterval = Number.parseInt(dragInterval, 10);
  const hasDragRows =
    Number.isFinite(normalizedDragInterval) && normalizedDragInterval > 0;
  const colSpan = 3 + headers.length + 2;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateLayout = () => setShouldFitTable(getShouldFitTable());

    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.addEventListener("orientationchange", updateLayout);

    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("orientationchange", updateLayout);
    };
  }, []);

  const shouldShowDragAfterRun = (index) => {
    const completedCount = index + 1;
    return (
      hasDragRows &&
      completedCount < runs.length &&
      completedCount % normalizedDragInterval === 0
    );
  };

  const getDragLabel = (index) => {
    const completedCount = index + 1;
    const nextRun = runs[index + 1];
    const duration = Number.parseInt(dragDurationMinutes, 10);
    const durationLabel =
      Number.isFinite(duration) && duration > 0
        ? ` • ${t("management.scoring.estimatedMinutes", {
            minutes: duration,
          })}`
        : "";
    const nextRunLabel = nextRun?.draw
      ? ` • ${t("management.scoring.nextRun", { draw: nextRun.draw })}`
      : "";

    return `${t("management.scoring.dragBreakLabel", {
      count: completedCount,
    })}${durationLabel}${nextRunLabel}`;
  };

  return (
    <div style={tableStyles.tableWrap}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            <th style={tableStyles.th}>{t("management.announcer.draw")}</th>
            <th style={tableStyles.th}>{t("public.results.backNumber")}</th>
            <th style={tableStyles.th}>PEN</th>

            {headers.map((header) => (
              <th key={header} style={tableStyles.th}>
                {header}
              </th>
            ))}

            <th style={tableStyles.th}>{t("public.results.totalPenalties")}</th>
            <th style={tableStyles.th}>{t("public.results.score")}</th>
          </tr>
        </thead>

        <tbody>
          {runs.map((run, index) => (
            <React.Fragment key={run.id || run.draw}>
              <RunRows
                run={run}
                headers={headers}
                activeManoeuvre={activeManoeuvre}
                setActiveManoeuvre={setActiveManoeuvre}
                scoreOptions={scoreOptions}
                scoreOptionsByIndex={scoreOptionsByIndex}
                penaltyOptions={penaltyOptions}
                specialPenaltyTokens={specialPenaltyTokens}
                penaltyDisabledIndexes={penaltyDisabledIndexes}
                statusPenaltyOptions={statusPenaltyOptions}
                updateScoreCell={updateScoreCell}
                clearScoreCell={clearScoreCell}
                addPenaltyToken={addPenaltyToken}
                toggleSpecialPenalty={toggleSpecialPenalty}
                clearPenaltyCell={clearPenaltyCell}
                updateBackNumber={updateBackNumber}
                updateRunNote={updateRunNote}
                isLocked={isLocked || Boolean(isRunLocked?.(run, index))}
                isBackNumberLocked={isBackNumberLocked}
                styles={tableStyles}
              />

              {shouldShowDragAfterRun(index) && (
                <tr>
                  <td colSpan={colSpan} style={tableStyles.dragBreakRow}>
                    <div style={tableStyles.dragBreakRowContent}>
                      <span>{getDragLabel(index)}</span>
                      {!isLocked && (
                        activeDrag?.afterIndex === index ? (
                          <button
                            type="button"
                            style={tableStyles.dragBreakButton}
                            onClick={() => onStopDrag?.(index)}
                          >
                            {t("management.scoring.stopDrag")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              canStartDragAfterRun
                                ? !canStartDragAfterRun(index)
                                : false
                            }
                            style={{
                              ...tableStyles.dragBreakButton,
                              ...((canStartDragAfterRun &&
                                !canStartDragAfterRun(index)) ||
                              false
                                ? tableStyles.disabledButton || {}
                                : {}),
                            }}
                            onClick={() => onStartDrag?.(index)}
                          >
                            {t("management.scoring.startDrag")}
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ScoreTable;
