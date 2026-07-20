import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../features/i18n/I18nProvider";
import {
  getSpecialPenaltyReasons,
  isSpecialPenaltyReasonRequired,
  SPECIAL_PENALTY_REASON_MANUAL_ID,
  SPECIAL_PENALTY_REASON_NONE_ID,
} from "../features/scoring/specialPenaltyReasons";
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
  const [reasonRequest, setReasonRequest] = useState(null);
  const [reasonSearch, setReasonSearch] = useState("");
  const [isManualReasonOpen, setIsManualReasonOpen] = useState(false);
  const [manualReasonComment, setManualReasonComment] = useState("");
  const manoeuvreIndex = activeManoeuvre?.manoeuvreIndex;

  useEffect(() => {
    setIsManualPenaltyOpen(false);
    setManualPenaltyValue("");
    setReasonRequest(null);
    setReasonSearch("");
    setIsManualReasonOpen(false);
    setManualReasonComment("");
  }, [run.draw, manoeuvreIndex]);

  useEffect(() => {
    if (!isManualPenaltyOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsManualPenaltyOpen(false);
        setManualPenaltyValue("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isManualPenaltyOpen]);

  useEffect(() => {
    if (!reasonRequest) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setReasonRequest(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [reasonRequest]);

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
  const reasonOptions = reasonRequest
    ? getSpecialPenaltyReasons(reasonRequest.token)
    : [];
  const normalizedReasonSearch = reasonSearch.trim().toLowerCase();
  const filteredReasonOptions = normalizedReasonSearch
    ? reasonOptions.filter((reason) =>
        [reason.en, reason.fr, reason.id]
          .join(" ")
          .toLowerCase()
          .includes(normalizedReasonSearch)
      )
    : reasonOptions;
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
  const openManualPenaltyModal = () => {
    setManualPenaltyValue("");
    setIsManualPenaltyOpen(true);
  };
  const closeManualPenaltyModal = () => {
    setIsManualPenaltyOpen(false);
    setManualPenaltyValue("");
  };
  const addManualPenalty = () => {
    if (!canAddManualPenalty) return;

    addPenaltyToken(run.draw, manoeuvreIndex, String(manualPenaltyNumber));
    closeManualPenaltyModal();
  };
  const closeReasonModal = () => {
    setReasonRequest(null);
    setReasonSearch("");
    setIsManualReasonOpen(false);
    setManualReasonComment("");
  };
  const openReasonModal = (token) => {
    setReasonRequest({ token });
    setReasonSearch("");
    setIsManualReasonOpen(false);
    setManualReasonComment("");
  };
  const selectSpecialPenaltyReason = (reasonId) => {
    if (!reasonRequest) return;

    toggleSpecialPenalty(
      run.draw,
      manoeuvreIndex,
      reasonRequest.token,
      reasonId
    );
    closeReasonModal();
  };
  const selectSpecialPenaltyWithoutComment = () => {
    if (!reasonRequest) return;

    toggleSpecialPenalty(
      run.draw,
      manoeuvreIndex,
      reasonRequest.token,
      SPECIAL_PENALTY_REASON_NONE_ID
    );
    closeReasonModal();
  };
  const selectSpecialPenaltyManualComment = () => {
    if (!reasonRequest || !manualReasonComment.trim()) return;

    toggleSpecialPenalty(
      run.draw,
      manoeuvreIndex,
      reasonRequest.token,
      SPECIAL_PENALTY_REASON_MANUAL_ID,
      manualReasonComment
    );
    closeReasonModal();
  };
  const handlePenaltyOptionClick = (option) => {
    if (!isSpecialPenaltyReasonRequired(option)) {
      addPenaltyToken(run.draw, manoeuvreIndex, option);
      return;
    }

    if (activePenaltyValue.includes(option)) {
      toggleSpecialPenalty(run.draw, manoeuvreIndex, option);
      return;
    }

    openReasonModal(option);
  };
  const handleStatusOptionToggle = (option) => {
    if (!isSpecialPenaltyReasonRequired(option)) {
      toggleSpecialPenalty(run.draw, manoeuvreIndex, option);
      return;
    }

    if (activePenaltyValue.includes(option)) {
      toggleSpecialPenalty(run.draw, manoeuvreIndex, option);
      return;
    }

    openReasonModal(option);
  };
  const manualPenaltyModal =
    isManualPenaltyOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            style={styles.manualPenaltyModalBackdrop}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeManualPenaltyModal();
              }
            }}
          >
            <div
              style={styles.manualPenaltyModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="manual-penalty-title"
            >
              <div style={styles.manualPenaltyModalHeader}>
                <div>
                  <h2
                    id="manual-penalty-title"
                    style={styles.manualPenaltyModalTitle}
                  >
                    {t("management.scoring.manualPenalty")}
                  </h2>
                  <div style={styles.manualPenaltyModalSubtitle}>
                    {t("management.announcer.draw")} {run.draw} —{" "}
                    {manoeuvreName}
                  </div>
                </div>
                <button
                  type="button"
                  style={styles.closeButton}
                  onClick={closeManualPenaltyModal}
                >
                  {t("management.announcer.close")}
                </button>
              </div>

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
            </div>
          </div>,
          document.body
        )
      : null;
  const specialPenaltyReasonModal =
    reasonRequest && typeof document !== "undefined"
      ? createPortal(
          <div
            style={styles.manualPenaltyModalBackdrop}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeReasonModal();
              }
            }}
          >
            <div
              style={styles.manualPenaltyModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="special-penalty-reason-title"
            >
              <div style={styles.manualPenaltyModalHeader}>
                <div>
                  <h2
                    id="special-penalty-reason-title"
                    style={styles.manualPenaltyModalTitle}
                  >
                    {t("management.scoring.specialPenaltyReasonTitle", {
                      status: reasonRequest.token,
                    })}
                  </h2>
                  <div style={styles.manualPenaltyModalSubtitle}>
                    {t("management.announcer.draw")} {run.draw} —{" "}
                    {manoeuvreName}
                  </div>
                </div>
                <button
                  type="button"
                  style={styles.closeButton}
                  onClick={closeReasonModal}
                >
                  {t("management.announcer.close")}
                </button>
              </div>

              <div style={styles.specialPenaltyReasonPanel}>
                <div style={styles.specialPenaltyReasonHelp}>
                  {t("management.scoring.specialPenaltyReasonHelp")}
                </div>
                <div style={styles.specialPenaltyReasonActions}>
                  <button
                    type="button"
                    style={styles.closeButton}
                    onClick={selectSpecialPenaltyWithoutComment}
                  >
                    {t("management.scoring.specialPenaltyReasonNoComment")}
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.optionButton,
                      ...(isManualReasonOpen
                        ? styles.optionButtonSelected
                        : {}),
                    }}
                    onClick={() =>
                      setIsManualReasonOpen((current) => !current)
                    }
                  >
                    {t("management.scoring.specialPenaltyReasonManual")}
                  </button>
                </div>
                {isManualReasonOpen && (
                  <div style={styles.specialPenaltyReasonManualPanel}>
                    <textarea
                      value={manualReasonComment}
                      onChange={(event) =>
                        setManualReasonComment(event.target.value)
                      }
                      placeholder={t(
                        "management.scoring.specialPenaltyReasonManualPlaceholder"
                      )}
                      style={styles.specialPenaltyReasonCommentInput}
                    />
                    <button
                      type="button"
                      style={styles.optionButton}
                      onClick={selectSpecialPenaltyManualComment}
                      disabled={!manualReasonComment.trim()}
                    >
                      {t("management.scoring.specialPenaltyReasonManualApply")}
                    </button>
                  </div>
                )}
                <input
                  value={reasonSearch}
                  onChange={(event) => setReasonSearch(event.target.value)}
                  placeholder={t("management.scoring.specialPenaltyReasonSearch")}
                  style={styles.specialPenaltyReasonSearchInput}
                />
                <div style={styles.specialPenaltyReasonList}>
                  {filteredReasonOptions.map((reason) => (
                    <button
                      type="button"
                      key={`${reasonRequest.token}-${reason.id}`}
                      style={styles.specialPenaltyReasonButton}
                      onClick={() => selectSpecialPenaltyReason(reason.id)}
                    >
                      {reason.en}
                    </button>
                  ))}
                </div>
                {!filteredReasonOptions.length && (
                  <div style={styles.specialPenaltyReasonEmpty}>
                    {t("management.scoring.specialPenaltyReasonEmpty")}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  if (position === "top" && penaltyDisabled) {
    return null;
  }

  if (position === "top") {
    return (
      <>
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
                    style={{
                      ...styles.optionButton,
                      ...(activePenaltyValue.includes(option)
                        ? styles.optionButtonSelected
                        : {}),
                    }}
                    onClick={() => handlePenaltyOptionClick(option)}
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
                  onClick={openManualPenaltyModal}
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

              <div style={styles.statusToggleWrap}>
                {statusOptions.map((option) => (
                  <label
                    key={`status-${run.id || run.draw}-${manoeuvreIndex}-${option}`}
                    style={styles.statusCheckboxLabel}
                  >
                    <input
                      type="checkbox"
                      checked={activePenaltyValue.includes(option)}
                      onChange={() => handleStatusOptionToggle(option)}
                      style={styles.statusCheckboxInput}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          </td>
        </tr>
        {manualPenaltyModal}
        {specialPenaltyReasonModal}
      </>
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
