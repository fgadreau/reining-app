import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getPaidWarmupRepository,
  savePaidWarmupRepository,
} from "../../features/paidWarmups/paidWarmupRepository";
import {
  PAID_WARMUP_STATUSES,
  getPaidWarmupStats,
  insertPaidWarmupEntryAfter,
  movePaidWarmupEntry,
  normalizePaidWarmupEntries,
} from "../../features/paidWarmups/paidWarmupStorage";
import { parsePaidWarmupEntries } from "../../features/paidWarmups/paidWarmupImport";
import { DRAG_INTERVAL_OPTIONS } from "../../features/classes/classTiming";
import {
  CLASS_START_MODE_AFTER_PREVIOUS,
  CLASS_START_MODE_FIXED,
} from "../../features/classes/classSchedule";
import { getDayById } from "../../features/days/daySelectors";
import { getShowById } from "../../features/shows/showSelectors";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import {
  formatLocalFirstSyncNotice,
  getLocalFirstSyncNoticeTone,
} from "../../features/cloud/localFirstSyncMessages";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

function PaidWarmupSetupPage() {
  const { associationId, showId, dayId, paidWarmupId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const show = getShowById(showId);
  const day = getDayById(dayId);
  const access = useAssociationAccess(associationId);

  const [warmup, setWarmup] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("synced");
  const [positionDrafts, setPositionDrafts] = useState({});

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const item = await getPaidWarmupRepository(paidWarmupId);
      if (!isMounted) return;
      setWarmup(item);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [paidWarmupId]);

  const stats = useMemo(
    () => getPaidWarmupStats(warmup?.entries || []),
    [warmup]
  );

  const updateWarmup = (updates) => {
    setWarmup((current) => (current ? { ...current, ...updates } : current));
  };

  const updateEntry = (entryId, updates) => {
    setWarmup((current) => {
      if (!current) return current;

      return {
        ...current,
        entries: current.entries.map((entry) =>
          entry.id === entryId ? { ...entry, ...updates } : entry
        ),
      };
    });
  };

  const addEntry = () => {
    setWarmup((current) => {
      if (!current) return current;

      return {
        ...current,
        entries: insertPaidWarmupEntryAfter(current.entries, null, {
          rider: "",
        }),
      };
    });
  };

  const insertEntryAfter = (entryId) => {
    setWarmup((current) => {
      if (!current) return current;

      return {
        ...current,
        entries: insertPaidWarmupEntryAfter(current.entries, entryId, {
          rider: "",
        }),
      };
    });
  };

  const moveEntry = (entryId, targetIndex) => {
    setWarmup((current) => {
      if (!current) return current;

      return {
        ...current,
        entries: movePaidWarmupEntry(current.entries, entryId, targetIndex),
      };
    });
  };

  const moveEntryToPosition = (entryId, position) => {
    const nextPosition = Number.parseInt(position, 10);

    if (!Number.isFinite(nextPosition)) return;

    moveEntry(entryId, nextPosition - 1);
  };

  const updateEntryPositionDraft = (entryId, value) => {
    setPositionDrafts((current) => ({
      ...current,
      [entryId]: value,
    }));
  };

  const commitEntryPositionDraft = (entryId, fallbackPosition) => {
    const rawPosition =
      positionDrafts[entryId] == null
        ? String(fallbackPosition)
        : positionDrafts[entryId];
    const nextPosition = Number.parseInt(rawPosition, 10);

    setPositionDrafts((current) => {
      const next = { ...current };
      delete next[entryId];
      return next;
    });

    if (!Number.isFinite(nextPosition)) return;
    moveEntryToPosition(entryId, nextPosition);
  };

  const removeEntry = (entryId) => {
    setWarmup((current) => {
      if (!current) return current;

      return {
        ...current,
        entries: normalizePaidWarmupEntries(
          current.entries.filter((entry) => entry.id !== entryId)
        ),
      };
    });
  };

  const saveWarmup = async (
    nextWarmup = warmup,
    successMessage = t("management.paidWarmup.saved")
  ) => {
    if (!nextWarmup) return;

    setIsSaving(true);
    try {
      const saved = await savePaidWarmupRepository({
        ...nextWarmup,
        associationId,
        showId,
        dayId,
      });
      const tone = getLocalFirstSyncNoticeTone(saved);
      const syncNotice = formatLocalFirstSyncNotice(saved, t);

      setWarmup(saved);
      setMessageTone(tone);
      setMessage(
        tone === "synced" ? successMessage : `${successMessage} ${syncNotice}`
      );
      return saved;
    } catch (error) {
      console.error("Erreur sauvegarde paid warm up:", error);
      setMessageTone("warn");
      setMessage(
        t("common.localFirstSyncError", {
          message: error?.message || "",
        })
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const importEntries = async () => {
    if (!warmup) return;

    const entries = parsePaidWarmupEntries(pasteText);
    if (entries.length === 0) {
      setMessage(t("management.paidWarmup.noRiderDetected"));
      return;
    }

    if (
      warmup.entries.length > 0 &&
      !window.confirm(t("management.paidWarmup.replaceConfirm"))
    ) {
      return;
    }

    const nextWarmup = {
      ...warmup,
      entries,
    };

    setWarmup(nextWarmup);
    await saveWarmup(
      nextWarmup,
      t("management.paidWarmup.importedCount", {
        count: entries.length,
      })
    );
  };

  const shouldShowDragAfter = (index) => {
    if (!warmup?.dragInterval) return false;
    if (index >= warmup.entries.length - 1) return false;
    return (index + 1) % warmup.dragInterval === 0;
  };

  if (isLoading) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>{t("management.paidWarmup.loading")}</div>
      </div>
    );
  }

  if (!access.isLoadingAccess && !access.canManageAssociation) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={{ ...emptyStateStyle, marginTop: 16 }}>
          {t("management.paidWarmup.accessDenied")}
        </div>
      </div>
    );
  }

  if (!warmup) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={{ ...emptyStateStyle, marginTop: 16 }}>
          {t("management.paidWarmup.notFound")}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
      </div>

      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>{t("public.results.paidWarmup")}</div>
          <h1 style={{ margin: "4px 0" }}>
            {warmup.name || t("public.results.paidWarmup")}
          </h1>
          <div style={metaStyle}>
            {show?.name || t("common.show")} •{" "}
            {day?.label || t("management.days.dayFallback")}
            {day?.date ? ` • ${day.date}` : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={() => saveWarmup()}
          style={primaryButtonStyle}
          disabled={isSaving}
        >
          {isSaving
            ? t("management.paidWarmup.saving")
            : t("management.paidWarmup.save")}
        </button>
      </div>

      {message && <div style={noticeStyle(messageTone)}>{message}</div>}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>{t("management.paidWarmup.settings")}</h2>
        <div style={formGridStyle}>
          <div>
            <label style={labelStyle}>{t("management.classes.nameLabel")}</label>
            <input
              type="text"
              value={warmup.name}
              onChange={(event) => updateWarmup({ name: event.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>
              {t("management.paidWarmup.timePerRider")}
            </label>
            <input
              type="number"
              min="1"
              value={warmup.durationMinutesPerRider}
              onChange={(event) =>
                updateWarmup({
                  durationMinutesPerRider: event.target.value,
                })
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>
              {t("management.classes.scheduleStartLabel")}
            </label>
            <select
              value={warmup.scheduleStartMode}
              onChange={(event) =>
                updateWarmup({
                  scheduleStartMode: event.target.value,
                  scheduleStartTime:
                    event.target.value === CLASS_START_MODE_FIXED
                      ? warmup.scheduleStartTime
                      : "",
                })
              }
              style={inputStyle}
            >
              <option value={CLASS_START_MODE_AFTER_PREVIOUS}>
                {t("management.classes.startAfterPrevious")}
              </option>
              <option value={CLASS_START_MODE_FIXED}>
                {t("management.classes.startFixed")}
              </option>
            </select>
          </div>

          {warmup.scheduleStartMode === CLASS_START_MODE_FIXED && (
            <div>
              <label style={labelStyle}>
                {t("management.classes.startTimeLabel")}
              </label>
              <input
                type="time"
                value={warmup.scheduleStartTime}
                onChange={(event) =>
                  updateWarmup({ scheduleStartTime: event.target.value })
                }
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>{t("public.results.dragSurface")}</label>
            <select
              value={warmup.dragInterval || ""}
              onChange={(event) =>
                updateWarmup({
                  dragInterval: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              style={inputStyle}
            >
              <option value="">{t("management.classes.noDragPlanned")}</option>
              {DRAG_INTERVAL_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {t("management.paidWarmup.dragAfterEachRider", {
                    count: value,
                    ridersLabel: t(
                      value > 1
                        ? "management.classes.ridersPlural"
                        : "management.classes.riderSingular"
                    ),
                  })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>{t("management.time.dragDuration")}</label>
            <input
              type="number"
              min="0"
              value={warmup.dragDurationMinutes}
              onChange={(event) =>
                updateWarmup({
                  dragDurationMinutes: event.target.value,
                })
              }
              style={inputStyle}
            />
          </div>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={Boolean(warmup.isPublicLive)}
              onChange={(event) =>
                updateWarmup({ isPublicLive: event.target.checked })
              }
            />
            {t("management.paidWarmup.allowPublicLive")}
          </label>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>
              {t("management.paidWarmup.riders")}
            </h2>
            <div style={metaStyle}>
              {t("management.paidWarmup.stats", {
                total: stats.total,
                pending: stats.pending,
                done: stats.done,
                noShow: stats.noShow,
                scratch: stats.scratch,
              })}
            </div>
          </div>

          <button type="button" onClick={addEntry} style={secondaryButtonStyle}>
            {t("management.paidWarmup.addRider")}
          </button>
        </div>

        <div style={importBoxStyle}>
          <label style={labelStyle}>{t("management.paidWarmup.pasteLabel")}</label>
          <textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={"1\tMarie Tremblay\n2\tFélix Goudreau\n3\tAlex Martin"}
            style={textareaStyle}
          />
          <button
            type="button"
            onClick={importEntries}
            style={secondaryButtonStyle}
            disabled={isSaving}
          >
            {t("management.paidWarmup.importInOrder")}
          </button>
        </div>

        {warmup.entries.length === 0 ? (
          <div style={emptyStateStyle}>
            {t("management.paidWarmup.emptyEntries")}
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>{t("public.results.order")}</th>
                  <th style={thStyle}>{t("management.paidWarmup.rider")}</th>
                  <th style={thStyle}>{t("management.shows.statusLabel")}</th>
                  <th style={thStyle}>{t("management.access.action")}</th>
                </tr>
              </thead>
              <tbody>
                {warmup.entries.map((entry, index) => (
                  <React.Fragment key={entry.id}>
                    <tr>
                      <td style={tdStyle}>
                        <div style={orderControlStyle}>
                          <button
                            type="button"
                            onClick={() => moveEntry(entry.id, index - 1)}
                            style={iconButtonStyle(index === 0)}
                            disabled={index === 0}
                            aria-label={t("management.paidWarmup.moveUp")}
                            title={t("management.paidWarmup.moveUp")}
                          >
                            ↑
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={warmup.entries.length}
                            value={positionDrafts[entry.id] ?? index + 1}
                            onChange={(event) =>
                              updateEntryPositionDraft(entry.id, event.target.value)
                            }
                            onBlur={() =>
                              commitEntryPositionDraft(entry.id, index + 1)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                commitEntryPositionDraft(entry.id, index + 1);
                                event.currentTarget.blur();
                              }
                            }}
                            style={orderInputStyle}
                            aria-label={t("management.paidWarmup.position")}
                          />
                          <button
                            type="button"
                            onClick={() => moveEntry(entry.id, index + 1)}
                            style={iconButtonStyle(
                              index === warmup.entries.length - 1
                            )}
                            disabled={index === warmup.entries.length - 1}
                            aria-label={t("management.paidWarmup.moveDown")}
                            title={t("management.paidWarmup.moveDown")}
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="text"
                          value={entry.rider}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              rider: event.target.value,
                            })
                          }
                          style={inputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        <select
                          value={entry.status}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              status: event.target.value,
                            })
                          }
                          style={inputStyle}
                        >
                          {PAID_WARMUP_STATUSES.map((value) => (
                            <option key={value} value={value}>
                              {getPaidWarmupStatusLabel(value, t)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <div style={rowActionStyle}>
                          <button
                            type="button"
                            onClick={() => insertEntryAfter(entry.id)}
                            style={secondaryButtonStyle}
                          >
                            {t("management.paidWarmup.insertAfter")}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry.id)}
                            style={dangerButtonStyle}
                          >
                            {t("management.access.remove")}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {shouldShowDragAfter(index) && (
                      <tr>
                        <td colSpan="4" style={dragRowStyle}>
                          {t("management.paidWarmup.dragRow", {
                            minutes: warmup.dragDurationMinutes,
                          })}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function getPaidWarmupStatusLabel(status, t) {
  switch (status) {
    case "done":
      return t("public.results.paidWarmupStatusDone");
    case "no_show":
      return t("public.results.paidWarmupStatusNoShow");
    case "scratch":
      return t("public.results.paidWarmupStatusScratch");
    case "pending":
    default:
      return t("public.results.paidWarmupStatusPending");
  }
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const eyebrowStyle = {
  textTransform: "uppercase",
  letterSpacing: 0,
  fontSize: 12,
  color: "#64748b",
  fontWeight: 700,
};

const metaStyle = {
  color: "#64748b",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitleStyle = {
  fontSize: 20,
  margin: 0,
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 700,
  color: "#334155",
};

const importBoxStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
};

const labelStyle = {
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
};

const textareaStyle = {
  ...inputStyle,
  minHeight: 120,
  resize: "vertical",
  fontFamily: "inherit",
  marginBottom: 10,
};

const primaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

const dangerButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #ef4444",
  background: "#fff5f5",
  color: "#991b1b",
  cursor: "pointer",
};

const noticeStyle = (tone = "synced") => ({
  border: `1px solid ${tone === "warn" ? "#fdba74" : "#86efac"}`,
  color: tone === "warn" ? "#9a3412" : "#166534",
  background: tone === "warn" ? "#fff7ed" : "#f0fdf4",
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
});

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
};

const tableWrapStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  padding: 10,
  borderBottom: "1px solid #cbd5e1",
  color: "#475569",
  fontSize: 13,
};

const tdStyle = {
  padding: 10,
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "middle",
};

const orderControlStyle = {
  display: "grid",
  gridTemplateColumns: "34px minmax(54px, 72px) 34px",
  gap: 6,
  alignItems: "center",
};

const orderInputStyle = {
  ...inputStyle,
  padding: "8px 6px",
  textAlign: "center",
  fontWeight: 800,
};

const iconButtonStyle = (isDisabled) => ({
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: isDisabled ? "#f8fafc" : "#fff",
  color: isDisabled ? "#94a3b8" : "#111827",
  cursor: isDisabled ? "not-allowed" : "pointer",
  fontWeight: 900,
});

const rowActionStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const dragRowStyle = {
  padding: 12,
  borderBottom: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 700,
  textAlign: "center",
};

export default PaidWarmupSetupPage;
