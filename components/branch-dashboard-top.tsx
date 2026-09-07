"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, ChevronDown, Plus } from "lucide-react";

export type MonthCard = {
  id: string;
  year: number;
  monthNum: number;
  label: string;
  count: number;
};

/**
 * Branch dashboard header: title + an "Add CAPA" button where "Create Month"
 * used to be. The button reveals the month grid (full width, below the header) —
 * open a month, then add a CAPA for a department inside it.
 */
export function BranchDashboardTop({
  localeId,
  months,
}: {
  localeId: string;
  months: MonthCard[];
}) {
  const [open, setOpen] = useState(false);
  const years = [...new Set(months.map((m) => m.year))].sort((a, b) => b - a);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <div>
          <div className="capa-tag">BRANCH DASHBOARD</div>
          <div
            className="disp"
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: "var(--navy-deep)",
              marginTop: 10,
            }}
          >
            {localeId}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-inter, Inter, sans-serif)",
            fontWeight: 600,
            fontSize: 14,
            borderRadius: 8,
            border: "1px solid transparent",
            padding: "10px 16px",
            background: "var(--navy)",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <Plus size={15} /> Add CAPA
          <ChevronDown
            size={15}
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform .15s",
            }}
          />
        </button>
      </div>

      {open && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 12 }}
          >
            Open a month to add a CAPA for a department.
          </div>
          {months.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--ink-faint)",
                border: "1px dashed var(--border)",
                borderRadius: 12,
              }}
            >
              This month is being set up — refresh in a moment.
            </div>
          ) : (
            years.map((year) => (
              <div key={year} style={{ marginBottom: 18 }}>
                {years.length > 1 && (
                  <div
                    className="disp"
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--navy-deep)",
                      marginBottom: 8,
                    }}
                  >
                    {year}
                  </div>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  {months
                    .filter((m) => m.year === year)
                    .map((m) => (
                      <Link
                        key={m.id}
                        href={`/locale/${localeId}/${m.year}/${m.monthNum}`}
                        style={{
                          background: "#fff",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          padding: 18,
                          textDecoration: "none",
                          color: "inherit",
                          display: "block",
                        }}
                      >
                        <Calendar size={16} color="var(--steel)" />
                        <div
                          className="disp"
                          style={{ fontWeight: 700, fontSize: 17, marginTop: 10 }}
                        >
                          {m.label}
                        </div>
                        <div
                          style={{
                            fontSize: 12.5,
                            color: "var(--ink-muted)",
                            marginTop: 4,
                          }}
                        >
                          {m.count} CAPA plan{m.count === 1 ? "" : "s"}
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
