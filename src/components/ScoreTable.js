import React from "react";
import RunRows from "./RunRows";

function ScoreTable({
  headers,
  runs,
  activeManoeuvre,
  setActiveManoeuvre,
  scoreOptions,
  penaltyOptions,
  statusPenaltyOptions,
  updateScoreCell,
  clearScoreCell,
  addPenaltyToken,
  toggleSpecialPenalty,
  clearPenaltyCell,
  updateBackNumber,
  isLocked,
  styles,
}) {
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
          {runs.map((run) => (
            <RunRows
              key={run.id || run.draw}
              run={run}
              headers={headers}
              activeManoeuvre={activeManoeuvre}
              setActiveManoeuvre={setActiveManoeuvre}
              scoreOptions={scoreOptions}
              penaltyOptions={penaltyOptions}
              statusPenaltyOptions={statusPenaltyOptions}
              updateScoreCell={updateScoreCell}
              clearScoreCell={clearScoreCell}
              addPenaltyToken={addPenaltyToken}
              toggleSpecialPenalty={toggleSpecialPenalty}
              clearPenaltyCell={clearPenaltyCell}
              updateBackNumber={updateBackNumber}
              isLocked={isLocked}
              styles={styles}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ScoreTable;
