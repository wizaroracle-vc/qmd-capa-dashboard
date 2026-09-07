"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { countByStatus, planProgressPct, planStatus } from "@/lib/capa-logic";
import { StatusBadge, statusCardStyle } from "@/components/status-badge";
import type { CapaPlan } from "@/lib/capa-types";

const STATUS_CARDS: { label: string; key: string; tone: string }[] = [
  { label: "Total", key: "total", tone: "var(--navy)" },
  { label: "Open", key: "Open", tone: "var(--ink-muted)" },
  { label: "In Progress", key: "In Progress", tone: "#B45309" },
  { label: "For QMD Verification", key: "For QMD Verification", tone: "#1D4ED8" },
  { label: "Overdue", key: "Overdue", tone: "var(--red)" },
  { label: "Effective", key: "Effective", tone: "var(--green)" },
  { label: "Partially Effective", key: "Partially Effective", tone: "var(--purple)" },
  { label: "Not Effective", key: "Not Effective", tone: "var(--red)" },
];

// List ordering: For QMD Verification and In Progress always come first.
const RANK: Record<string, number> = {
  "For QMD Verification": 0,
  "In Progress": 1,
  Overdue: 2,
  Open: 3,
  "Partially Effective": 4,
  "Not Effective": 5,
  Effective: 6,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "var(--ink-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  margin: "22px 0 10px",
};

const PAGE_SIZE = 10;

export function BranchCapaOverview({
  plans,
  monthLabels,
}: {
  plans: CapaPlan[];
  monthLabels: Record<string, string>;
}) {
  // "total" = show every CAPA; otherwise a specific status.
  const [filter, setFilter] = useState<string>("total");
  const [page, setPage] = useState(1);
  const counts = countByStatus(plans);

  const selectFilter = (key: string) => {
    setFilter(key);
    setPage(1);
  };

  const rows = plans
    .map((p) => ({ p, status: planStatus(p) }))
    .filter(({ status }) => filter === "total" || status === filter)
    .sort(
      (a, b) =>
        (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) ||
        b.p.dateCreated.localeCompare(a.p.dateCreated),
    );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const activeLabel =
    filter === "total"
      ? null
      : STATUS_CARDS.find((c) => c.key === filter)?.label ?? filter;

  return (
    <div>
      <div style={{ ...sectionTitle, marginTop: 0 }}>CAPA Summary</div>

      <div
        style={{
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 14,
          marginBottom: 20,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {STATUS_CARDS.map(({ label, key, tone }) => {
          const selected = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectFilter(key)}
              style={{
                font: "inherit",
                textAlign: "left",
                background: "var(--surface)",
                border: `1px solid ${selected ? tone : "var(--border)"}`,
                boxShadow: selected
                  ? `inset 0 0 0 1px ${tone}, 0 1px 3px rgba(16,24,40,0.10)`
                  : "0 1px 2px rgba(16,24,40,0.04)",
                borderRadius: 12,
                padding: "14px 16px",
                minHeight: 84,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "border-color .12s, box-shadow .12s",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  lineHeight: 1.3,
                }}
              >
                {label}
              </span>
              <span
                className="disp"
                style={{ fontSize: 26, fontWeight: 700, color: tone, marginTop: 6 }}
              >
                {counts[key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          ...sectionTitle,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span>{activeLabel ? `CAPAs - ${activeLabel}` : "All CAPAs"}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--ink-faint)",
            textTransform: "none",
            letterSpacing: 0,
          }}
        >
          {rows.length}
        </span>
        {activeLabel && (
          <button
            type="button"
            onClick={() => selectFilter("total")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ink-muted)",
              cursor: "pointer",
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            Clear <X size={11} />
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            padding: 22,
            textAlign: "center",
            color: "var(--ink-faint)",
            fontSize: 13,
            border: "1px dashed var(--border)",
            borderRadius: 12,
          }}
        >
          {activeLabel
            ? `No CAPAs with status "${activeLabel}".`
            : "No CAPAs yet."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pageRows.map(({ p, status }) => {
            const cs = statusCardStyle(status);
            return (
              <Link
                key={p.id}
                href={`/capa/${p.capaId}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  background: cs.background,
                  border: `1px solid ${cs.borderColor}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {p.preparedBy || p.capaId}
                  </div>
                  {p.preparedBy && (
                    <div
                      className="mono"
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-muted)",
                        marginTop: 1,
                      }}
                    >
                      {p.capaId}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-muted)",
                      marginTop: 2,
                    }}
                  >
                    {monthLabels[p.monthId] ?? "—"} · {p.department} ·{" "}
                    {planProgressPct(p)}% complete
                  </div>
                </div>
                <StatusBadge status={status} size="sm" />
              </Link>
            );
          })}

          {pageCount > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                marginTop: 6,
              }}
            >
              <button
                type="button"
                onClick={() => setPage((n) => Math.max(1, n - 1))}
                disabled={current <= 1}
                style={pagerBtn(current <= 1)}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
                Page {current} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((n) => Math.min(pageCount, n + 1))}
                disabled={current >= pageCount}
                style={pagerBtn(current >= pageCount)}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const pagerBtn = (disabled: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12.5,
  fontWeight: 600,
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: disabled ? "var(--ink-faint)" : "var(--navy)",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.6 : 1,
});
