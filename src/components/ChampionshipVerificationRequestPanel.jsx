import React, { useEffect, useMemo, useState } from "react";
import {
  buildChampionshipVerificationPayload,
  CHAMPIONSHIP_VERIFICATION_SCOPES,
  findChampionshipVerificationTeam,
  sendChampionshipVerificationRequestRepository,
  validateChampionshipVerificationForm,
} from "../features/championship/championshipVerificationRequestRepository";
import {
  formatChampionshipMoney,
  formatChampionshipPoints,
} from "../features/championship/championshipPoints";

const initialForm = {
  requesterName: "",
  requesterEmail: "",
  classId: "",
  scope: CHAMPIONSHIP_VERIFICATION_SCOPES.SELECTED_SHOWS,
  showKeys: [],
  rider: "",
  horse: "",
  explanation: "",
};

function ChampionshipVerificationRequestPanel({
  isOpen,
  onClose,
  associationId,
  association,
  season,
  classes,
  championshipUrl,
  t,
}) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState({ status: "idle", message: "" });
  const classOptions = Array.isArray(classes) ? classes : [];
  const selectedClass = useMemo(
    () => classOptions.find((classEntry) => classEntry.id === form.classId) || null,
    [classOptions, form.classId]
  );
  const availableEvents = useMemo(
    () => (Array.isArray(selectedClass?.events) ? selectedClass.events : []),
    [selectedClass]
  );
  const matchedTeam = useMemo(
    () => findChampionshipVerificationTeam(selectedClass, form.rider, form.horse),
    [selectedClass, form.rider, form.horse]
  );

  useEffect(() => {
    if (!selectedClass) {
      setForm((current) =>
        current.showKeys.length ? { ...current, showKeys: [] } : current
      );
      return;
    }

    const validEventKeys = new Set(availableEvents.map((event) => event.eventKey));
    setForm((current) => ({
      ...current,
      showKeys: current.showKeys.filter((eventKey) => validEventKeys.has(eventKey)),
    }));
  }, [availableEvents, selectedClass]);

  if (!isOpen) return null;

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitState({ status: "idle", message: "" });
  };

  const updateScope = (scope) => {
    setForm((current) => ({
      ...current,
      scope,
      showKeys:
        scope === CHAMPIONSHIP_VERIFICATION_SCOPES.SEASON
          ? []
          : current.showKeys,
    }));
    setErrors((current) => ({ ...current, showKeys: undefined }));
    setSubmitState({ status: "idle", message: "" });
  };

  const toggleShowKey = (eventKey) => {
    setForm((current) => {
      const nextKeys = new Set(current.showKeys);
      if (nextKeys.has(eventKey)) {
        nextKeys.delete(eventKey);
      } else {
        nextKeys.add(eventKey);
      }

      return {
        ...current,
        showKeys: Array.from(nextKeys),
      };
    });
    setErrors((current) => ({ ...current, showKeys: undefined }));
    setSubmitState({ status: "idle", message: "" });
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    const nextErrors = validateChampionshipVerificationForm(form, selectedClass);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSubmitState({
        status: "error",
        message: t("championship.verification.requiredFields"),
      });
      return;
    }

    setSubmitState({
      status: "sending",
      message: t("championship.verification.sending"),
    });

    const payload = buildChampionshipVerificationPayload({
      associationId,
      association,
      season,
      championshipUrl,
      form,
      classEntry: selectedClass,
    });
    const result = await sendChampionshipVerificationRequestRepository(payload);

    if (!result.ok) {
      setSubmitState({
        status: "error",
        message:
          result.reason === "supabase_unavailable"
            ? t("championship.verification.supabaseUnavailable")
            : t("championship.verification.sendFailed"),
      });
      return;
    }

    setSubmitState({
      status: "success",
      message: t("championship.verification.sent"),
    });
  };

  const showEventChecklist =
    selectedClass &&
    form.scope === CHAMPIONSHIP_VERIFICATION_SCOPES.SELECTED_SHOWS;

  return (
    <aside
      style={panelStyle}
      role="dialog"
      aria-modal="false"
      aria-labelledby="championship-verification-title"
    >
      <form style={formStyle} onSubmit={submitRequest}>
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>{t("championship.verification.eyebrow")}</div>
            <h2 id="championship-verification-title" style={titleStyle}>
              {t("championship.verification.title")}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle}>
            {t("championship.verification.close")}
          </button>
        </div>

        <div style={helpTextStyle}>{t("championship.verification.help")}</div>

        <div style={fieldGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>{t("championship.verification.requesterName")}</span>
            <input
              value={form.requesterName}
              onChange={(event) => updateField("requesterName", event.target.value)}
              style={inputStyle(errors.requesterName)}
              autoComplete="name"
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>{t("championship.verification.requesterEmail")}</span>
            <input
              type="email"
              value={form.requesterEmail}
              onChange={(event) => updateField("requesterEmail", event.target.value)}
              style={inputStyle(errors.requesterEmail)}
              autoComplete="email"
            />
          </label>
        </div>

        <label style={fieldStyle}>
          <span style={labelStyle}>{t("championship.verification.class")}</span>
          <select
            value={form.classId}
            onChange={(event) => updateField("classId", event.target.value)}
            style={inputStyle(errors.classId)}
          >
            <option value="">{t("championship.verification.chooseClass")}</option>
            {classOptions.map((classEntry) => (
              <option key={classEntry.id} value={classEntry.id}>
                {classEntry.name}
              </option>
            ))}
          </select>
        </label>

        <div style={fieldStyle}>
          <span style={labelStyle}>{t("championship.verification.scope")}</span>
          <div style={scopeRowStyle}>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                checked={form.scope === CHAMPIONSHIP_VERIFICATION_SCOPES.SELECTED_SHOWS}
                onChange={() =>
                  updateScope(CHAMPIONSHIP_VERIFICATION_SCOPES.SELECTED_SHOWS)
                }
              />
              <span>{t("championship.verification.selectedShows")}</span>
            </label>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                checked={form.scope === CHAMPIONSHIP_VERIFICATION_SCOPES.SEASON}
                onChange={() => updateScope(CHAMPIONSHIP_VERIFICATION_SCOPES.SEASON)}
              />
              <span>{t("championship.verification.fullSeason")}</span>
            </label>
          </div>
          {showEventChecklist && (
            <div style={showChecklistStyle(errors.showKeys)}>
              {availableEvents.length > 0 ? (
                availableEvents.map((event) => (
                  <label key={event.eventKey} style={showCheckStyle}>
                    <input
                      type="checkbox"
                      checked={form.showKeys.includes(event.eventKey)}
                      onChange={() => toggleShowKey(event.eventKey)}
                    />
                    <span>
                      {event.label || event.showName || event.showNum || "-"}
                    </span>
                  </label>
                ))
              ) : (
                <div style={mutedTextStyle}>
                  {t("championship.verification.noShows")}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={fieldGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>{t("championship.verification.rider")}</span>
            <input
              value={form.rider}
              onChange={(event) => updateField("rider", event.target.value)}
              style={inputStyle(errors.rider)}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>{t("championship.verification.horse")}</span>
            <input
              value={form.horse}
              onChange={(event) => updateField("horse", event.target.value)}
              style={inputStyle(errors.horse)}
            />
          </label>
        </div>

        {matchedTeam && (
          <div style={matchStyle}>
            <div style={matchTitleStyle}>
              {t("championship.verification.currentStanding")}
            </div>
            <div>
              #{matchedTeam.rank} ·{" "}
              {formatChampionshipPoints(matchedTeam.totalPoints)} pts ·{" "}
              {formatChampionshipMoney(matchedTeam.totalMoney)}
            </div>
          </div>
        )}

        <label style={fieldStyle}>
          <span style={labelStyle}>{t("championship.verification.explanation")}</span>
          <textarea
            value={form.explanation}
            onChange={(event) => updateField("explanation", event.target.value)}
            style={textareaStyle(errors.explanation)}
            rows={4}
            maxLength={1200}
          />
        </label>

        {submitState.message && (
          <div style={noticeStyle(submitState.status)}>{submitState.message}</div>
        )}

        <button
          type="submit"
          style={submitButtonStyle}
          disabled={submitState.status === "sending"}
        >
          {submitState.status === "sending"
            ? t("championship.verification.sending")
            : t("championship.verification.submit")}
        </button>
      </form>
    </aside>
  );
}

const panelStyle = {
  position: "fixed",
  zIndex: 920,
  right: 14,
  bottom: 14,
  width: "min(430px, calc(100vw - 28px))",
  maxHeight: "calc(100dvh - 28px)",
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxShadow: "0 22px 70px rgba(15, 23, 42, 0.25)",
  overflow: "auto",
};

const formStyle = {
  display: "grid",
  gap: 12,
  padding: 14,
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const eyebrowStyle = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const titleStyle = {
  margin: "2px 0 0",
  color: "#0f172a",
  fontSize: 20,
  lineHeight: 1.15,
};

const closeButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#0f172a",
  padding: "7px 10px",
  font: "inherit",
  fontWeight: 900,
  cursor: "pointer",
  flex: "0 0 auto",
};

const helpTextStyle = {
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.35,
};

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

const fieldStyle = {
  display: "grid",
  gap: 6,
};

const labelStyle = {
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 900,
};

const inputStyle = (hasError) => ({
  width: "100%",
  minHeight: 40,
  border: `1px solid ${hasError ? "#dc2626" : "#cbd5e1"}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: "#0f172a",
  background: "#ffffff",
  font: "inherit",
  boxSizing: "border-box",
});

const textareaStyle = (hasError) => ({
  ...inputStyle(hasError),
  minHeight: 86,
  resize: "vertical",
});

const scopeRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const radioLabelStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 800,
};

const showChecklistStyle = (hasError) => ({
  display: "grid",
  gap: 6,
  maxHeight: 126,
  overflow: "auto",
  border: `1px solid ${hasError ? "#dc2626" : "#e2e8f0"}`,
  borderRadius: 8,
  padding: 8,
  background: "#f8fafc",
});

const showCheckStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 6,
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.25,
};

const mutedTextStyle = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 750,
};

const matchStyle = {
  border: "1px solid #bae6fd",
  borderRadius: 8,
  background: "#ecfeff",
  color: "#0f172a",
  padding: 10,
  fontSize: 13,
  fontWeight: 850,
};

const matchTitleStyle = {
  color: "#0369a1",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: 0,
  marginBottom: 3,
};

const noticeStyle = (status) => ({
  border: `1px solid ${status === "success" ? "#86efac" : "#fecaca"}`,
  borderRadius: 8,
  background: status === "success" ? "#f0fdf4" : "#fef2f2",
  color: status === "success" ? "#166534" : "#991b1b",
  padding: 10,
  fontSize: 13,
  fontWeight: 850,
});

const submitButtonStyle = {
  border: "1px solid #0f172a",
  borderRadius: 8,
  background: "#0f172a",
  color: "#ffffff",
  padding: "10px 12px",
  font: "inherit",
  fontWeight: 950,
  cursor: "pointer",
};

export default ChampionshipVerificationRequestPanel;
