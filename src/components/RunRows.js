import React, { useEffect, useMemo, useState } from "react";
import ManoeuvrePicker from "./ManoeuvrePicker";

function RunRows({
  run,
  headers,
  activeManoeuvre,
  setActiveManoeuvre,
  scoreOptions,
  penaltyOptions,
  updateScoreCell,
  clearScoreCell,
  addPenaltyToken,
  toggleSpecialPenalty,
  clearPenaltyCell,
  updateBackNumber,
  isLocked,
  styles,
}) {
  const [editingBackNumber, setEditingBackNumber] = useState(false);
  const [tempBackNumber, setTempBackNumber] = useState(run.backNumber || "");

  useEffect(() => {
    setTempBackNumber(run.backNumber || "");
  }, [run.backNumber]);

  useEffect(() => {
    if (isLocked && editingBackNumber) {
      setEditingBackNumber(false);
    }
  }, [isLocked, editingBackNumber]);

  const manoeuvreCount = useMemo(() => headers.length, [headers]);
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

  const openManoeuvre = (manoeuvreIndex) => {
    if (isLocked) return;

    setActiveManoeuvre({
      draw: run.draw,
      manoeuvreIndex,
    });
  };

  const saveBackNumber = () => {
    if (isLocked) {
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

  return (
    <>
      {isActiveRun && !isLocked && (
        <ManoeuvrePicker
          position="top"
          run={run}
          headers={headers}
          activeManoeuvre={activeManoeuvre}
          scoreOptions={scoreOptions}
          penaltyOptions={penaltyOptions}
          updateScoreCell={updateScoreCell}
          clearScoreCell={clearScoreCell}
          addPenaltyToken={addPenaltyToken}
          toggleSpecialPenalty={toggleSpecialPenalty}
          clearPenaltyCell={clearPenaltyCell}
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
            ...(isLocked ? {} : styles.clickableCell),
          }}
          onClick={() => {
            if (isLocked) return;

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

        {run.penalties.map((value, index) => (
          <td
            key={`p-${run.id || run.draw}-${index}`}
            onClick={() => openManoeuvre(index)}
            style={{
              ...styles.td,
              ...(isLocked ? {} : styles.clickableCell),
              ...(isSelectedManoeuvre(index) ? styles.activePenaltyCell : {}),
              ...(isActiveRun ? styles.activeRunCell : {}),
            }}
          >
            {renderCellValue(value)}
          </td>
        ))}

        <td
          rowSpan={2}
          style={{
            ...styles.td,
            ...styles.mergedCell,
            ...(isActiveRun ? styles.activeRunSummaryCell : {}),
          }}
        >
          {renderCellValue(run.penTotal)}
        </td>

        <td
          rowSpan={2}
          style={{
            ...styles.td,
            ...styles.mergedCell,
            ...(isActiveRun ? styles.activeRunSummaryCell : {}),
          }}
        >
          {renderCellValue(run.scoreTotal)}
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
            {renderCellValue(value)}
          </td>
        ))}
      </tr>

      {isActiveRun && !isLocked && (
        <ManoeuvrePicker
          position="bottom"
          run={run}
          headers={headers}
          activeManoeuvre={activeManoeuvre}
          scoreOptions={scoreOptions}
          penaltyOptions={penaltyOptions}
          updateScoreCell={updateScoreCell}
          clearScoreCell={clearScoreCell}
          addPenaltyToken={addPenaltyToken}
          toggleSpecialPenalty={toggleSpecialPenalty}
          clearPenaltyCell={clearPenaltyCell}
          setActiveManoeuvre={setActiveManoeuvre}
          getColSpan={() => colSpan}
          isLocked={isLocked}
          styles={styles}
        />
      )}
    </>
  );
}

export default RunRows;