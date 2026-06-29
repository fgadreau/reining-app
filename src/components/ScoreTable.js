import React from "react";
import RunRows from "./RunRows";
import { useTranslation } from "../features/i18n/I18nProvider";

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
  isBackNumberLocked,
  styles,
}) {
  const { t } = useTranslation();
  const normalizedDragInterval = Number.parseInt(dragInterval, 10);
  const hasDragRows =
    Number.isFinite(normalizedDragInterval) && normalizedDragInterval > 0;
  const colSpan = 3 + headers.length + 2;

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
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>{t("management.announcer.draw")}</th>
            <th style={styles.th}>{t("public.results.backNumber")}</th>
            <th style={styles.th}>PEN</th>

            {headers.map((header) => (
              <th key={header} style={styles.th}>
                {header}
              </th>
            ))}

            <th style={styles.th}>{t("public.results.totalPenalties")}</th>
            <th style={styles.th}>{t("public.results.score")}</th>
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
                isLocked={isLocked}
                isBackNumberLocked={isBackNumberLocked}
                styles={styles}
              />

              {shouldShowDragAfterRun(index) && (
                <tr>
                  <td colSpan={colSpan} style={styles.dragBreakRow}>
                    <div style={styles.dragBreakRowContent}>
                      <span>{getDragLabel(index)}</span>
                      {!isLocked && (
                        activeDrag?.afterIndex === index ? (
                          <button
                            type="button"
                            style={styles.dragBreakButton}
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
                              ...styles.dragBreakButton,
                              ...((canStartDragAfterRun &&
                                !canStartDragAfterRun(index)) ||
                              false
                                ? styles.disabledButton || {}
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
