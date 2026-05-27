import React from "react";
import RunRows from "./RunRows";

function ScoreTable({
  headers,
  runs,
  dragInterval,
  dragDurationMinutes,
  activeManoeuvre,
  setActiveManoeuvre,
  scoreOptions,
  scoreOptionsByIndex,
  penaltyOptions,
  penaltyDisabledIndexes,
  statusPenaltyOptions,
  updateScoreCell,
  clearScoreCell,
  addPenaltyToken,
  toggleSpecialPenalty,
  clearPenaltyCell,
  updateBackNumber,
  updateRunNote,
  isLocked,
  isBackNumberLocked,
  styles,
}) {
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
        ? ` • ${duration} min estimées`
        : "";
    const nextRunLabel = nextRun?.draw ? ` • Prochain run #${nextRun.draw}` : "";

    return `Drag de surface après ${completedCount} participant(s)${durationLabel}${nextRunLabel}`;
  };

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Draw</th>
            <th style={styles.th}>Back #</th>
            <th style={styles.th}>PEN</th>

            {headers.map((header) => (
              <th key={header} style={styles.th}>
                {header}
              </th>
            ))}

            <th style={styles.th}>PEN TOTAL</th>
            <th style={styles.th}>SCORE</th>
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
                    {getDragLabel(index)}
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
