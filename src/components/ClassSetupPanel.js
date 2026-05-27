import React, { useEffect, useState } from "react";
import { useTranslation } from "../features/i18n/I18nProvider";

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
  const { t } = useTranslation();
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
        {t("management.classPanel.title")}
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
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            {t("management.classes.nameLabel")}
          </div>
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
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            {t("public.results.pattern")}
          </div>
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
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            {t("public.results.judge")}
          </div>
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
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            {t("management.classSetup.runCount")}
          </div>
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
              {t("management.classSetup.apply")}
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
          {t("management.classSetup.addRunPlain")}
        </button>

        <button style={styles.resetButton} onClick={onRenumberDraws}>
          {t("management.classPanel.renumberDraws")}
        </button>

        <button style={styles.resetButton} onClick={onClearBackNumbers}>
          {t("management.classPanel.clearBackNumbers")}
        </button>
      </div>

      <div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>
          {t("management.classPanel.prefillBackNumbers")}
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
            {t("management.classPanel.applyToExistingRuns")}
          </button>

          <button
            style={styles.resetButton}
            onClick={() => setBackNumbersText("")}
          >
            {t("management.classPanel.clearField")}
          </button>
        </div>

        <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
          {t("management.classPanel.backNumbersHelp")}
        </div>
      </div>
    </div>
  );
}

export default ClassSetupPanel;
