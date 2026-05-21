import React, { useEffect, useState } from "react";

function parseBackNumbers(text) {
  return text
    .split(/[\n,;\t ]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function ClassSetupPanel({
  activeClass,
  runCount,
  onUpdateClassField,
  onResizeRuns,
  onRenumberDraws,
  onApplyBackNumbers,
  onClearBackNumbers,
  onAddRun,
  styles,
}) {
  const [localRunCount, setLocalRunCount] = useState(String(runCount || 0));
  const [backNumbersText, setBackNumbersText] = useState("");

  useEffect(() => {
    setLocalRunCount(String(runCount || 0));
  }, [runCount]);

  const applyRunCount = () => {
    const parsed = Number(localRunCount);
    if (!Number.isInteger(parsed) || parsed < 1) return;
    onResizeRuns(parsed);
  };

  const applyBackNumbers = () => {
    const parsed = parseBackNumbers(backNumbersText);
    onApplyBackNumbers(parsed);
  };

  return (
    <div
      style={{
        border: "1px solid #d7d7d7",
        borderRadius: 10,
        padding: 16,
        marginBottom: 16,
        background: "#fff",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 16,
          marginBottom: 12,
        }}
      >
        Entrée de classe
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Nom de classe</div>
          <input
            value={activeClass?.name || ""}
            onChange={(e) => onUpdateClassField("name", e.target.value)}
            placeholder="Ex. Non Pro"
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Pattern</div>
          <input
            value={activeClass?.pattern || ""}
            onChange={(e) => onUpdateClassField("pattern", e.target.value)}
            placeholder="Ex. 5"
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Juge</div>
          <input
            value={activeClass?.judge || ""}
            onChange={(e) => onUpdateClassField("judge", e.target.value)}
            placeholder="Ex. Tremblay"
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Nombre de runs</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={localRunCount}
              onChange={(e) => setLocalRunCount(e.target.value)}
              onBlur={applyRunCount}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyRunCount();
              }}
              inputMode="numeric"
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #ccc",
                borderRadius: 6,
              }}
            />
            <button style={styles.resetButton} onClick={applyRunCount}>
              Appliquer
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <button style={styles.resetButton} onClick={onAddRun}>
          Ajouter une run
        </button>

        <button style={styles.resetButton} onClick={onRenumberDraws}>
          Renuméroter draws 1 → n
        </button>

        <button style={styles.resetButton} onClick={onClearBackNumbers}>
          Effacer tous les back numbers
        </button>
      </div>

      <div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>
          Préremplir les back numbers
        </div>

        <textarea
          value={backNumbersText}
          onChange={(e) => setBackNumbersText(e.target.value)}
          placeholder={"Un numéro par ligne\n245\n318\n502"}
          rows={5}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #ccc",
            borderRadius: 6,
            resize: "vertical",
            marginBottom: 8,
          }}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={styles.resetButton} onClick={applyBackNumbers}>
            Appliquer aux runs existantes
          </button>

          <button
            style={styles.resetButton}
            onClick={() => setBackNumbersText("")}
          >
            Vider le champ
          </button>
        </div>

        <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
          Tu peux coller un numéro par ligne, ou séparés par virgules / espaces.
        </div>
      </div>
    </div>
  );
}

export default ClassSetupPanel;