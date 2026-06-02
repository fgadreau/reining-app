import React, { useEffect, useMemo, useState } from "react";
import ManoeuvrePicker from "./ManoeuvrePicker";
import { useTranslation } from "../features/i18n/I18nProvider";
import { formatScoreValue, formatTotalValue } from "../utils/scoring";

function RunRows({
  run,
  headers,
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
  const { t } = useTranslation();
  const [editingBackNumber, setEditingBackNumber] = useState(false);
  const [tempBackNumber, setTempBackNumber] = useState(run.backNumber || "");
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const canEditBackNumber = !isLocked && !isBackNumberLocked;

  useEffect(() => {
    setTempBackNumber(run.backNumber || "");
  }, [run.backNumber]);

  useEffect(() => {
    if (!canEditBackNumber && editingBackNumber) {
      setEditingBackNumber(false);
    }
  }, [canEditBackNumber, editingBackNumber]);

  const manoeuvreCount = useMemo(() => headers.length, [headers]);
  const penaltyDisabledIndexSet = useMemo(
    () => new Set(penaltyDisabledIndexes || []),
    [penaltyDisabledIndexes]
  );
  const colSpan = 3 + manoeuvreCount + 2;

  const isSelectedManoeuvre = (manoeuvreIndex) => {
    return (
      activeManoeuvre &&
      activeManoeuvre.draw === run.draw &&
      activeManoeuvre.manoeuvreIndex === manoeuvreIndex
    );
  };

  const isActiveRun =
    activeManoeuvre !== null && activeManoeuvre.draw === run.draw;
  const hasRunNote = Boolean(String(run.note || "").trim());

  useEffect(() => {
    if (!isActiveRun) {
      setIsNoteEditorOpen(false);
    }
  }, [isActiveRun]);

  const openManoeuvre = (manoeuvreIndex) => {
    if (isLocked) return;

    setActiveManoeuvre({
      draw: run.draw,
      manoeuvreIndex,
    });
  };

  const saveBackNumber = () => {
    if (!canEditBackNumber) {
      setEditingBackNumber(false);
      setTempBackNumber(run.backNumber || "");
      return;
    }

    updateBackNumber(run.draw, tempBackNumber.trim());
    setEditingBackNumber(false);
  };

  const cancelBackNumberEdit = () => {
    setTempBackNumber(run.backNumber || "");
    setEditingBackNumber(false);
  };

  const renderCellValue = (value) => {
    return value ? value : <span style={styles.placeholder}>—</span>;
  };
  const renderScoreCellValue = (value) => {
    const formattedValue = formatScoreValue(value);
    return formattedValue ? (
      formattedValue
    ) : (
      <span style={styles.placeholder}>—</span>
    );
  };
  const renderTotalCellValue = (value) => {
    const formattedValue = formatTotalValue(value);
    return formattedValue ? (
      formattedValue
    ) : (
      <span style={styles.placeholder}>—</span>
    );
  };
  const shouldShowNoteRow = isNoteEditorOpen || hasRunNote;
  const openRunNote = () => setIsNoteEditorOpen(true);

  return (
    <>
      {isActiveRun &&
        !isLocked &&
        !penaltyDisabledIndexSet.has(activeManoeuvre?.manoeuvreIndex) && (
        <ManoeuvrePicker
          position="top"
          run={run}
          headers={headers}
          activeManoeuvre={activeManoeuvre}
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
          openRunNote={openRunNote}
          setActiveManoeuvre={setActiveManoeuvre}
          getColSpan={() => colSpan}
          isLocked={isLocked}
          styles={styles}
        />
      )}

      <tr style={isActiveRun ? styles.activeRunRow : undefined}>
        <td
          rowSpan={2}
          style={{
            ...styles.td,
            ...styles.mergedMainCell,
            ...(isActiveRun ? styles.activeRunMainCell : {}),
          }}
        >
          {run.draw}
        </td>

        <td
          rowSpan={2}
          style={{
            ...styles.td,
            ...styles.mergedMainCell,
            ...styles.backNumberCell,
            ...(isActiveRun ? styles.activeRunMainCell : {}),
            ...(canEditBackNumber ? styles.clickableCell : {}),
          }}
          onClick={() => {
            if (!canEditBackNumber) return;

            if (!editingBackNumber) {
              setEditingBackNumber(true);
              setTempBackNumber(run.backNumber || "");
            }
          }}
        >
          {editingBackNumber ? (
            <input
              autoFocus
              value={tempBackNumber}
              onChange={(e) => setTempBackNumber(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={saveBackNumber}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  saveBackNumber();
                } else if (e.key === "Escape") {
                  cancelBackNumberEdit();
                }
              }}
              style={styles.backNumberInput}
            />
          ) : run.backNumber ? (
            run.backNumber
          ) : (
            <span style={styles.placeholder}>—</span>
          )}
        </td>

        <td
          style={{
            ...styles.typeCell,
            ...(isActiveRun ? styles.activeRunTypeCell : {}),
          }}
        >
          P
        </td>

        {run.penalties.map((value, index) => {
          const isPenaltyDisabled = penaltyDisabledIndexSet.has(index);

          return (
            <td
              key={`p-${run.id || run.draw}-${index}`}
              onClick={() => {
                if (!isPenaltyDisabled) openManoeuvre(index);
              }}
              style={{
                ...styles.td,
                ...(isLocked || isPenaltyDisabled ? {} : styles.clickableCell),
                ...(isSelectedManoeuvre(index) && !isPenaltyDisabled
                  ? styles.activePenaltyCell
                  : {}),
                ...(isActiveRun ? styles.activeRunCell : {}),
                ...(isPenaltyDisabled ? disabledPenaltyCellStyle : {}),
              }}
            >
              {isPenaltyDisabled ? (
                <span style={styles.placeholder}>—</span>
              ) : (
                renderCellValue(value)
              )}
            </td>
          );
        })}

        <td
          rowSpan={2}
          style={{
            ...styles.td,
            ...styles.mergedCell,
            ...(isActiveRun ? styles.activeRunSummaryCell : {}),
          }}
        >
          {renderTotalCellValue(run.penTotal)}
        </td>

        <td
          rowSpan={2}
          style={{
            ...styles.td,
            ...styles.mergedCell,
            ...(isActiveRun ? styles.activeRunSummaryCell : {}),
          }}
        >
          {renderTotalCellValue(run.scoreTotal)}
        </td>
      </tr>

      <tr style={isActiveRun ? styles.activeRunRow : undefined}>
        <td
          style={{
            ...styles.typeCell,
            ...(isActiveRun ? styles.activeRunTypeCell : {}),
          }}
        >
          S
        </td>

        {run.scores.map((value, index) => (
          <td
            key={`s-${run.id || run.draw}-${index}`}
            onClick={() => openManoeuvre(index)}
            style={{
              ...styles.td,
              ...(isLocked ? {} : styles.clickableCell),
              ...(isSelectedManoeuvre(index) ? styles.activeScoreCell : {}),
              ...(isActiveRun ? styles.activeRunCell : {}),
            }}
          >
            {renderScoreCellValue(value)}
          </td>
        ))}
      </tr>

      {shouldShowNoteRow && (
        <tr>
          <td colSpan={colSpan} style={styles.runNoteCell}>
            <div style={styles.runNoteHeader}>
              <div style={styles.runNoteLabel}>{t("public.results.judgeNote")}</div>
              {!isLocked && isNoteEditorOpen && (
                <button
                  type="button"
                  style={styles.runNoteHideButton}
                  onClick={() => setIsNoteEditorOpen(false)}
                >
                  {t("management.scoring.hideJudgeNote")}
                </button>
              )}
            </div>
            {isLocked || !isNoteEditorOpen ? (
              <div style={styles.runNoteText}>
                {String(run.note || "").trim() || "—"}
              </div>
            ) : (
              <textarea
                value={run.note || ""}
                onChange={(event) => updateRunNote(run.draw, event.target.value)}
                placeholder={t("management.scoring.participantNotePlaceholder")}
                style={styles.runNoteInput}
              />
            )}
          </td>
        </tr>
      )}

      {isActiveRun && !isLocked && (
        <ManoeuvrePicker
          position="bottom"
          run={run}
          headers={headers}
          activeManoeuvre={activeManoeuvre}
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
          openRunNote={openRunNote}
          setActiveManoeuvre={setActiveManoeuvre}
          getColSpan={() => colSpan}
          isLocked={isLocked}
          styles={styles}
        />
      )}
    </>
  );
}

const disabledPenaltyCellStyle = {
  background: "#f8fafc",
  color: "#94a3b8",
};

export default RunRows;
