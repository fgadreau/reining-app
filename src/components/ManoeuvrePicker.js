import React from "react";
import { useTranslation } from "../features/i18n/I18nProvider";

function ManoeuvrePicker({
  position,
  run,
  headers,
  activeManoeuvre,
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
  setActiveManoeuvre,
  getColSpan,
  styles,
}) {
  const { t } = useTranslation();

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
  const activeScoreOptions =
    scoreOptionsByIndex?.[manoeuvreIndex] || scoreOptions || [];
  const penaltyDisabled = (penaltyDisabledIndexes || []).includes(
    manoeuvreIndex
  );
  const statusOptions = Array.isArray(statusPenaltyOptions)
    ? statusPenaltyOptions
    : [];

  if (position === "top" && penaltyDisabled) {
    return null;
  }

  if (position === "top") {
    return (
      <tr>
        <td colSpan={getColSpan()} style={styles.inlinePickerCellTop}>
          <div style={styles.inlinePickerBox}>
            <div style={styles.inlineHeader}>
              <strong>
                {t("management.scoring.penalties")} —{" "}
                {t("management.announcer.draw")} {run.draw} — {manoeuvreName}
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
                {t("management.scoring.clearManeuverPenalty")}
              </button>
            </div>

            <div style={styles.statusToggleWrap}>
              {statusOptions.map((option) => (
                <label
                  key={`status-${run.id || run.draw}-${manoeuvreIndex}-${option}`}
                  style={styles.statusCheckboxLabel}
                >
                  <input
                    type="checkbox"
                    checked={activePenaltyValue.includes(option)}
                    onChange={() =>
                      toggleSpecialPenalty(run.draw, manoeuvreIndex, option)
                    }
                    style={styles.statusCheckboxInput}
                  />
                  {option}
                </label>
              ))}
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
              {t("management.scoring.maneuverScore")} —{" "}
              {t("management.announcer.draw")} {run.draw} — {manoeuvreName}
            </strong>
          </div>

          <div style={styles.optionGrid}>
            {activeScoreOptions.map((option) => (
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
              {t("management.scoring.clearScore")}
            </button>

            <button
              style={styles.closeButton}
              onClick={() => setActiveManoeuvre(null)}
            >
              {t("management.announcer.close")}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default ManoeuvrePicker;
