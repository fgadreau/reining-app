export const appStyles = {
  app: {
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f3f4f6",
    minHeight: "100vh",
    padding: "16px",
    boxSizing: "border-box",
  },

  topbarWrap: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginBottom: "18px",
    flexWrap: "wrap",
  },

  topbar: {
    backgroundColor: "#1e293b",
    color: "white",
    padding: "14px 18px",
    borderRadius: "12px",
    fontWeight: "bold",
    fontSize: "18px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },

  resetButton: {
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid #dc2626",
    backgroundColor: "#fff1f2",
    color: "#991b1b",
    fontWeight: "700",
    cursor: "pointer",
  },

  secondaryButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontWeight: "700",
    cursor: "pointer",
  },

  primaryButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #2563eb",
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: "700",
    cursor: "pointer",
  },

  panel: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    padding: "16px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    marginBottom: "16px",
  },

  panelTitle: {
    fontWeight: "700",
    fontSize: "16px",
    color: "#0f172a",
    marginBottom: "14px",
  },

  panelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },

  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  fieldLabel: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#334155",
  },

  textInput: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    fontSize: "14px",
    boxSizing: "border-box",
  },

  compactInputRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },

  panelActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },

  textareaInput: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    fontSize: "14px",
    resize: "vertical",
    boxSizing: "border-box",
    marginBottom: "8px",
  },

  helperText: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "6px",
  },

  tableWrap: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    padding: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    maxHeight: "calc(100vh - 96px)",
    overflow: "auto",
    position: "relative",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1200px",
  },

  th: {
    border: "1px solid #d1d5db",
    padding: "12px 10px",
    backgroundColor: "#e5e7eb",
    textAlign: "center",
    fontWeight: "700",
    position: "sticky",
    top: 0,
    zIndex: 3,
    boxShadow: "0 2px 0 rgba(148, 163, 184, 0.35)",
  },

  td: {
    border: "1px solid #d1d5db",
    padding: "10px",
    textAlign: "center",
    backgroundColor: "white",
    minWidth: "64px",
  },

  typeCell: {
    border: "1px solid #d1d5db",
    padding: "10px",
    textAlign: "center",
    backgroundColor: "#f3f4f6",
    fontWeight: "700",
    minWidth: "40px",
  },

  clickableCell: {
    cursor: "pointer",
    userSelect: "none",
  },

  mergedMainCell: {
    backgroundColor: "#f8fafc",
    fontWeight: "700",
    verticalAlign: "middle",
    minWidth: "70px",
  },

  backNumberCell: {
    cursor: "pointer",
  },

  backNumberInput: {
    width: "100%",
    border: "none",
    outline: "none",
    textAlign: "center",
    fontWeight: "700",
    background: "transparent",
    fontSize: "16px",
    padding: 0,
    margin: 0,
  },

  activeRunRow: {
    backgroundColor: "#eef6ff",
  },

  activeRunCell: {
    backgroundColor: "#f8fbff",
  },

  activeRunMainCell: {
    backgroundColor: "#dbeafe",
    fontWeight: "800",
  },

  activeRunTypeCell: {
    backgroundColor: "#dbeafe",
    fontWeight: "800",
  },

  activeRunSummaryCell: {
    backgroundColor: "#dbeafe",
    fontWeight: "800",
  },

  activePenaltyCell: {
    backgroundColor: "#fef3c7",
    outline: "2px solid #d97706",
    outlineOffset: "-2px",
    fontWeight: "700",
  },

  activeScoreCell: {
    backgroundColor: "#bfdbfe",
    outline: "2px solid #2563eb",
    outlineOffset: "-2px",
    fontWeight: "700",
  },

  mergedCell: {
    backgroundColor: "#f9fafb",
    fontWeight: "700",
    verticalAlign: "middle",
    minWidth: "110px",
  },

  dragBreakRow: {
    border: "1px solid #f59e0b",
    padding: "12px 16px",
    textAlign: "center",
    backgroundColor: "#fffbeb",
    color: "#92400e",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0,
  },

  activeRow: {
    backgroundColor: "#fcfcfc",
  },

  placeholder: {
    color: "#94a3b8",
  },

  inlinePickerCellTop: {
    padding: 0,
    borderLeft: "1px solid #d1d5db",
    borderRight: "1px solid #d1d5db",
    borderTop: "1px solid #d1d5db",
    backgroundColor: "#fffbeb",
  },

  inlinePickerCellBottom: {
    padding: 0,
    borderLeft: "1px solid #d1d5db",
    borderRight: "1px solid #d1d5db",
    borderBottom: "1px solid #d1d5db",
    backgroundColor: "#eff6ff",
  },

  inlinePickerBox: {
    padding: "14px",
  },

  inlineHeader: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "12px",
  },

  optionGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },

  optionButton: {
    padding: "10px 14px",
    minWidth: "78px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    fontWeight: "700",
    cursor: "pointer",
  },

  optionButtonSelected: {
    backgroundColor: "#bfdbfe",
    border: "1px solid #2563eb",
  },

  clearButton: {
    padding: "10px 14px",
    minWidth: "170px",
    borderRadius: "10px",
    border: "1px solid #f59e0b",
    backgroundColor: "#fff7ed",
    fontWeight: "700",
    cursor: "pointer",
  },

  closeButton: {
    padding: "10px 14px",
    minWidth: "88px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#f8fafc",
    fontWeight: "700",
    cursor: "pointer",
  },

  statusToggleWrap: {
    display: "flex",
    gap: "18px",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: "14px",
    paddingTop: "12px",
    borderTop: "1px solid #e2e8f0",
  },

  statusCheckboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: "700",
    cursor: "pointer",
  },

  statusCheckboxInput: {
    width: "18px",
    height: "18px",
    cursor: "pointer",
  },
};
