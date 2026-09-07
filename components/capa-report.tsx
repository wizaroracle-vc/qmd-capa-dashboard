/* Printable CAPA report — ported from _legacy/app.js CapaReportPage (720-729). */
import type { ReactNode } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  activeSets,
  fmtDate,
  planStatus,
} from "@/lib/capa-logic";
import type { CapaPlan, CapaSet, Category } from "@/lib/capa-types";
import { FishboneStage } from "@/components/workflow/fishbone-stage";
import { Linkify } from "@/components/linkify";
import { StatusBadge } from "./status-badge";

/** One 6M category box — label + its causes. */
function sixMCard(set: CapaSet, c: Category) {
  const items = set.sixM[c].filter((x) => x.text);
  return (
    <div
      key={c}
      style={{
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 9,
        fontSize: 13.5,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.04em",
          color: "var(--ink-muted)",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {CATEGORY_LABELS[c]}
      </div>
      {items.length === 0 ? (
        <div style={{ color: "var(--ink-faint)" }}>—</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((x, i) => (
            <div
              key={x.id}
              style={{ display: "flex", gap: 5, lineHeight: 1.4 }}
            >
              <span style={{ color: "var(--ink-faint)", flexShrink: 0 }}>
                {i + 1}.
              </span>
              <span>{x.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** One numbered step block inside a CAPA set — consistent header + indent. */
function Step({
  n,
  title,
  children,
  flush,
}: {
  n: number;
  title: string;
  children: ReactNode;
  /** Drop the 30px body indent — for wide content like the fishbone. */
  flush?: boolean;
}) {
  return (
    <div style={{ marginBottom: 14, breakInside: "avoid" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 5,
        }}
      >
        <span
          className="mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "var(--navy)",
            color: "#fff",
            fontSize: 11.5,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {String(n).padStart(2, "0")}
        </span>
        <span
          className="disp"
          style={{ fontWeight: 700, fontSize: 14, color: "var(--navy-deep)" }}
        >
          {title}
        </span>
      </div>
      <div style={{ paddingLeft: flush ? 0 : 30 }}>{children}</div>
    </div>
  );
}

export function CapaReport({
  plan,
  monthLabel,
}: {
  plan: CapaPlan;
  monthLabel: string;
}) {
  const sets = activeSets(plan);
  const status = planStatus(plan);

  return (
    <div
      className="print-page"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 32,
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: 24,
          borderBottom: "2px solid var(--navy)",
          paddingBottom: 18,
        }}
      >
        <div className="capa-tag">CAPA REPORT — QMD RECORD</div>
        <div className="disp" style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>
          {plan.capaId}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--ink-muted)" }}>
          {plan.localeId} · {monthLabel} · {plan.department}
        </div>
        <div style={{ marginTop: 8 }}>
          <StatusBadge status={status} />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
          marginBottom: 24,
          fontSize: 13.5,
        }}
      >
        {[
          ["Locale", plan.localeId],
          ["Month", monthLabel],
          ["Department", plan.department],
          ["Date Created", fmtDate(plan.dateCreated)],
          ["Source of Finding", plan.source || "—"],
          ["Prepared By", plan.preparedBy || "—"],
          ["Submitted Date", fmtDate(plan.submittedDate)],
          ["Status", status],
          ["No. of CAPA Sets", String(sets.length)],
        ].map(([k, v]) => (
          <div key={k}>
            <div
              style={{
                color: "var(--ink-faint)",
                fontSize: 11.5,
                textTransform: "uppercase",
              }}
            >
              {k}
            </div>
            <div style={{ fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>

      {sets.map((s) => (
        <div
          key={s.id}
          style={{
            marginBottom: 28,
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "var(--navy)",
              color: "#fff",
              padding: "9px 16px",
              display: "flex",
              alignItems: "baseline",
              gap: 10,
            }}
          >
            <span className="disp" style={{ fontWeight: 700, fontSize: 16 }}>
              CAPA Set {s.setNumber}
            </span>
            <span className="mono" style={{ fontSize: 11.5, opacity: 0.7 }}>
              {s.setCode}
            </span>
          </div>

          <div style={{ padding: 16 }}>
            <Step n={1} title="Issue / Finding">
              <div
                style={{
                  background: "var(--surface-alt)",
                  borderLeft: "3px solid var(--navy)",
                  borderRadius: 6,
                  padding: "9px 13px",
                  fontSize: 14.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {s.issue || "—"}
              </div>
            </Step>

            <Step n={2} title="6M Root Cause Analysis">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                }}
              >
                {CATEGORIES.map((c) => sixMCard(s, c))}
              </div>
            </Step>

            <Step n={3} title="Vital / Affinitized Causes">
              <div
                style={{
                  background: "var(--gold-soft)",
                  border: "1px solid var(--gold)",
                  borderRadius: 6,
                  padding: "9px 13px",
                  fontSize: 14,
                }}
              >
                {s.vitalCauses.filter((v) => v.text).length === 0 ? (
                  "—"
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {s.vitalCauses
                      .filter((v) => v.text)
                      .map((v, i) => (
                        <div
                          key={v.id}
                          style={{ display: "flex", gap: 6, lineHeight: 1.4 }}
                        >
                          <span style={{ fontWeight: 700, flexShrink: 0 }}>
                            {i + 1}.
                          </span>
                          <span>{v.text}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </Step>

            <Step n={4} title="Fishbone Diagram" flush>
              <FishboneStage set={s} hideHeader fit />
            </Step>

            <Step n={5} title="5 Whys Analysis">
              <div style={{ fontSize: 14 }}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const key = `why${n}` as keyof typeof s.fiveWhys;
                  return (
                    <div key={n} style={{ marginBottom: 2 }}>
                      <span
                        className="mono"
                        style={{ color: "var(--ink-faint)", marginRight: 6 }}
                      >
                        Why {n}
                      </span>
                      {s.fiveWhys[key] || "—"}
                    </div>
                  );
                })}
                <div
                  style={{
                    marginTop: 8,
                    background: "var(--gold-soft)",
                    border: "1px solid var(--gold)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontWeight: 700,
                  }}
                >
                  Root Cause: {s.fiveWhys.rootCause || "—"}
                </div>
              </div>
            </Step>

            <Step n={6} title="Improvement Action Plan">
              {s.actionItems.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
                  No action items.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12.5,
                      minWidth: 680,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "var(--surface-alt)" }}>
                        {[
                          "Corrective",
                          "Preventive",
                          "Responsible",
                          "Started",
                          "Expected",
                          "Verification",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "7px 9px",
                              textAlign: "left",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.actionItems.map((a, i) => (
                        <tr
                          key={a.id}
                          style={{
                            borderTop: "1px solid var(--border)",
                            background: i % 2 ? "var(--surface-alt)" : "#fff",
                          }}
                        >
                          <td style={{ padding: "7px 9px" }}>{a.correctiveAction}</td>
                          <td style={{ padding: "7px 9px" }}>{a.preventiveAction}</td>
                          <td style={{ padding: "7px 9px" }}>{a.responsiblePerson}</td>
                          <td style={{ padding: "7px 9px" }}>{fmtDate(a.startedDate)}</td>
                          <td style={{ padding: "7px 9px" }}>{fmtDate(a.targetDate)}</td>
                          <td style={{ padding: "7px 9px" }}>
                            <Linkify text={a.verification} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Step>
          </div>
        </div>
      ))}

      <div style={{ borderTop: "2px solid var(--navy)", paddingTop: 18, marginTop: 10 }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          QMD Verification
        </div>
        {plan.verification.result ? (
          <div
            style={{
              fontSize: 14.5,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <div>
              <strong>Verification Date:</strong> {fmtDate(plan.verification.date)}
            </div>
            <div>
              <strong>Verified By:</strong> {plan.verification.verifiedBy || "—"}
            </div>
            <div>
              <strong>Result:</strong> {plan.verification.result}
            </div>
            <div>
              <strong>Final CAPA Status:</strong> {status}
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <strong>Evidence / Reference:</strong>{" "}
              {plan.verification.evidence ? (
                <Linkify text={plan.verification.evidence} />
              ) : (
                "—"
              )}
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <strong>Remarks:</strong>{" "}
              {plan.verification.remarks ? (
                <Linkify text={plan.verification.remarks} />
              ) : (
                "—"
              )}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 14.5, color: "var(--ink-faint)" }}>
            Not yet reviewed by QMD.
          </div>
        )}
      </div>
    </div>
  );
}
