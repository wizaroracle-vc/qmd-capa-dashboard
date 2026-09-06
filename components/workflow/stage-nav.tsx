"use client";

import { Fragment } from "react";
import { Check } from "lucide-react";

export type Stage = { key: string; label: string; num: string };
export type StepState = "done" | "current" | "available" | "locked";

export function StageNav({
  stages,
  activeStage,
  onSelect,
  stepStateOf,
}: {
  stages: Stage[];
  activeStage: string;
  onSelect: (key: string) => void;
  stepStateOf: (key: string) => StepState;
}) {
  return (
    <div className="no-print" style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          maxWidth: 940,
          margin: "0 auto",
          padding: "8px 12px 4px",
        }}
      >
        {stages.map((s, i) => {
          const state = stepStateOf(s.key);
          const active = s.key === activeStage || state === "current";
          const done = state === "done";
          const locked = state === "locked";
          // blue only for an incomplete step you're currently on
          const inProgress = state === "current" && !done;

          const circle: React.CSSProperties = done
            ? { background: "var(--green)", color: "#fff", border: "2px solid var(--green)" }
            : inProgress
              ? { background: "#2563EB", color: "#fff", border: "2px solid #2563EB" }
              : locked
                ? { background: "#F1F5F9", color: "#94A3B8", border: "2px solid #E2E8F0" }
                : { background: "#fff", color: "#64748B", border: "2px solid #CBD5E1" };

          const labelColor = done
            ? "var(--green)"
            : active
              ? "var(--navy-deep)"
              : locked
                ? "var(--ink-faint)"
                : "var(--ink-muted)";

          const prevDone = i > 0 && stepStateOf(stages[i - 1].key) === "done";

          return (
            <Fragment key={s.key}>
              {i > 0 && (
                <div
                  aria-hidden
                  style={{
                    flex: "1 1 48px",
                    minWidth: 28,
                    height: 4,
                    borderRadius: 999,
                    marginTop: 19,
                    background: prevDone ? "var(--green)" : "#CBD5E1",
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => !locked && onSelect(s.key)}
                disabled={locked}
                aria-current={active ? "step" : undefined}
                title={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 9,
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: locked ? "not-allowed" : "pointer",
                  flex: "0 0 auto",
                }}
              >
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 17,
                    fontWeight: 700,
                    boxShadow: active
                      ? done
                        ? "0 0 0 6px rgba(30,142,82,0.18)"
                        : "0 0 0 6px rgba(37,99,235,0.15)"
                      : "none",
                    ...circle,
                  }}
                >
                  {done ? <Check size={20} /> : String(Number(s.num))}
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: active ? 700 : 500,
                    color: labelColor,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.label}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
