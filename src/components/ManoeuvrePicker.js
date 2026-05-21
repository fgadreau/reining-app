import React from "react";

function ManoeuvrePicker({
  position,
  run,
  headers,
  activeManoeuvre,
  scoreOptions,
  penaltyOptions,
  updateScoreCell,
  clearScoreCell,
  addPenaltyToken,
  toggleSpecialPenalty,
  clearPenaltyCell,
  setActiveManoeuvre,
  getColSpan,
  styles,
}) {
  if (
    !activeManoeuvre ||
    typeof activeManoeuvre.manoeuvreIndex !== "number" ||
    activeManoeuvre.manoeuvreIndex < 0 ||
    activeManoeuvre.manoeuvreIndex >= headers.length
  ) {
    return null;
  }

  const manoeuvreIndex = activeManoeuvre.manoeuvreIndex;
  const manoeuvreName = headers[manoeuvreIndex];
  const activePenaltyValue = run.penalties[manoeuvreIndex] || "";
  const activeScoreValue = run.scores[manoeuvreIndex] || "";

  const hasNoScore = activePenaltyValue.includes("No score");
  const hasScratch = activePenaltyValue.includes("Scratch");
  const hasVideoReview = activePenaltyValue.includes("Révision vidéo");

  if (position === "top") {
    return (
      <tr>
        <td colSpan={getColSpan()} style={styles.inlinePickerCellTop}>
          <div style={styles.inlinePickerBox}>
            <div style={styles.inlineHeader}>
              <strong>
                Pénalités — Draw {run.draw} — {manoeuvreName}
              </strong>
            </div>

            <div style={styles.optionGrid}>
              {penaltyOptions.map((option) => (
                <button
                  key={`pen-${run.id || run.draw}-${manoeuvreIndex}-${option}`}
                  style={styles.optionButton}
                  onClick={() => addPenaltyToken(run.draw, manoeuvreIndex, option)}
                >
                  {option}
                </button>
              ))}

              <button
                style={styles.clearButton}
                onClick={() => clearPenaltyCell(run.draw, manoeuvreIndex)}
              >
                Effacer pénalité manoeuvre
              </button>
            </div>

            <div style={styles.statusToggleWrap}>
              <label style={styles.statusCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={hasNoScore}
                  onChange={() =>
                    toggleSpecialPenalty(run.draw, manoeuvreIndex, "No score")
                  }
                  style={styles.statusCheckboxInput}
                />
                No score
              </label>

              <label style={styles.statusCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={hasScratch}
                  onChange={() =>
                    toggleSpecialPenalty(run.draw, manoeuvreIndex, "Scratch")
                  }
                  style={styles.statusCheckboxInput}
                />
                Scratch
              </label>

              <label style={styles.statusCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={hasVideoReview}
                  onChange={() =>
                    toggleSpecialPenalty(
                      run.draw,
                      manoeuvreIndex,
                      "Révision vidéo"
                    )
                  }
                  style={styles.statusCheckboxInput}
                />
                Révision vidéo
              </label>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={getColSpan()} style={styles.inlinePickerCellBottom}>
        <div style={styles.inlinePickerBox}>
          <div style={styles.inlineHeader}>
            <strong>
              Score manoeuvre — Draw {run.draw} — {manoeuvreName}
            </strong>
          </div>

          <div style={styles.optionGrid}>
            {scoreOptions.map((option) => (
              <button
                key={`score-${run.id || run.draw}-${manoeuvreIndex}-${option}`}
                style={{
                  ...styles.optionButton,
                  ...(activeScoreValue === option ? styles.optionButtonSelected : {}),
                }}
                onClick={() => updateScoreCell(run.draw, manoeuvreIndex, option)}
              >
                {option}
              </button>
            ))}

            <button
              style={styles.clearButton}
              onClick={() => clearScoreCell(run.draw, manoeuvreIndex)}
            >
              Effacer score
            </button>

            <button
              style={styles.closeButton}
              onClick={() => setActiveManoeuvre(null)}
            >
              Fermer
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default ManoeuvrePicker;
