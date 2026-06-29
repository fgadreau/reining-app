import React, { useEffect, useState } from "react";
import { useTranslation } from "../features/i18n/I18nProvider";
import { formatScoreValue, parseScoreValue } from "../utils/scoring";

const MANUAL_PENALTY_DIGITS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
];

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
  openRunNote,
  setActiveManoeuvre,
  getColSpan,
  styles,
}) {
  const { t } = useTranslation();
  const [isManualPenaltyOpen, setIsManualPenaltyOpen] = useState(false);
  const [manualPenaltyValue, setManualPenaltyValue] = useState("");
  const manoeuvreIndex = activeManoeuvre?.manoeuvreIndex;

  useEffect(() => {
    setIsManualPenaltyOpen(false);
    setManualPenaltyValue("");
  }, [run.draw, manoeuvreIndex]);

  if (
    !activeManoeuvre ||
    typeof manoeuvreIndex !== "number" ||
    manoeuvreIndex < 0 ||
    manoeuvreIndex >= headers.length
  ) {
    return null;
  }

  const manoeuvreName = headers[manoeuvreIndex];
  const activePenaltyValue = run.penalties[manoeuvreIndex] || "";
  const activeScoreValue = run.scores[manoeuvreIndex] || "";
  const activeScoreDisplayValue = formatScoreValue(activeScoreValue);
  const hasActiveScore = String(activeScoreValue || "").trim() !== "";
  const activeScoreNumber = hasActiveScore
    ? parseScoreValue(activeScoreValue)
    : null;
  const activeScoreOptions =
    scoreOptionsByIndex?.[manoeuvreIndex] || scoreOptions || [];
  const normalizedManualPenaltyValue = manualPenaltyValue.replace(
    /^0+(?=\d)/,
    ""
  );
  const manualPenaltyNumber = Number.parseInt(normalizedManualPenaltyValue, 10);
  const canAddManualPenalty =
    Number.isFinite(manualPenaltyNumber) && manualPenaltyNumber > 0;
  const penaltyDisabled = (penaltyDisabledIndexes || []).includes(
    manoeuvreIndex
  );
  const statusOptions = Array.isArray(statusPenaltyOptions)
    ? statusPenaltyOptions
    : [];
  const runNoteButtonLabel = String(run.note || "").trim()
    ? t("management.scoring.editJudgeNote")
    : t("management.scoring.addJudgeNote");
  const isSelectedScoreOption = (option) => {
    if (activeScoreDisplayValue === option) return true;
    if (activeScoreNumber === null) return false;

    return Math.abs(activeScoreNumber - parseScoreValue(option)) < 0.001;
  };
  const appendManualPenaltyDigit = (digit) => {
    setManualPenaltyValue((current) =>
      `${current}${digit}`.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
    );
  };
  const deleteManualPenaltyDigit = () => {
    setManualPenaltyValue((current) => current.slice(0, -1));
  };
  const clearManualPenaltyValue = () => {
    setManualPenaltyValue("");
  };
  const addManualPenalty = () => {
    if (!canAddManualPenalty) return;

    addPenaltyToken(run.draw, manoeuvreIndex, String(manualPenaltyNumber));
    setManualPenaltyValue("");
  };

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
                  type="button"
                  key={`pen-${run.id || run.draw}-${manoeuvreIndex}-${option}`}
                  style={styles.optionButton}
                  onClick={() => addPenaltyToken(run.draw, manoeuvreIndex, option)}
                >
                  {option}
                </button>
              ))}

              <button
                type="button"
                style={{
                  ...styles.optionButton,
                  ...(isManualPenaltyOpen ? styles.optionButtonSelected : {}),
                }}
                onClick={() => setIsManualPenaltyOpen((current) => !current)}
              >
                {t("management.scoring.manualPenalty")}
              </button>

              <button
                type="button"
                style={styles.clearButton}
                onClick={() => clearPenaltyCell(run.draw, manoeuvreIndex)}
              >
                {t("management.scoring.clearManeuverPenalty")}
              </button>

              <button
                type="button"
                style={styles.runNotePickerButton}
                onClick={openRunNote}
              >
                {runNoteButtonLabel}
              </button>
            </div>

            {isManualPenaltyOpen && (
              <div style={styles.manualPenaltyPanel}>
                <div style={styles.manualPenaltyDisplay}>
                  {manualPenaltyValue || "0"}
                </div>
                <div style={styles.manualPenaltyKeypad}>
                  {MANUAL_PENALTY_DIGITS.map((digit) => (
                    <button
                      type="button"
                      key={`manual-penalty-${digit}`}
                      style={styles.manualPenaltyKeyButton}
                      onClick={() => appendManualPenaltyDigit(digit)}
                    >
                      {digit}
                    </button>
                  ))}
                </div>
                <div style={styles.manualPenaltyActions}>
                  <button
                    type="button"
                    style={styles.closeButton}
                    onClick={deleteManualPenaltyDigit}
                    disabled={!manualPenaltyValue}
                  >
                    {t("management.scoring.deleteLastDigit")}
                  </button>
                  <button
                    type="button"
                    style={styles.closeButton}
                    onClick={clearManualPenaltyValue}
                    disabled={!manualPenaltyValue}
                  >
                    {t("management.scoring.clearManualPenaltyInput")}
                  </button>
                  <button
                    type="button"
                    style={styles.optionButton}
                    onClick={addManualPenalty}
                    disabled={!canAddManualPenalty}
                  >
                    {t("management.scoring.addManualPenalty")}
                  </button>
                </div>
              </div>
            )}

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
                  ...(isSelectedScoreOption(option)
                    ? styles.optionButtonSelected
                    : {}),
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
              type="button"
              style={styles.runNotePickerButton}
              onClick={openRunNote}
            >
              {runNoteButtonLabel}
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
