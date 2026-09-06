import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  activeSets,
  fmtDate,
  planProgressPct,
  planRepresentativeIssue,
  planStatus,
} from "@/lib/capa-logic";
import type { CapaPlan } from "@/lib/capa-types";
import { StatusBadge, statusCardStyle } from "./status-badge";

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "9px 12px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--ink-muted)",
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  borderTop: "1px solid var(--border)",
  verticalAlign: "top",
};

export function PlansTable({
  plans,
  showLocale = false,
}: {
  plans: CapaPlan[];
  showLocale?: boolean;
}) {
  if (plans.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--ink-faint)",
          fontSize: 13,
          border: "1px dashed var(--border)",
          borderRadius: 12,
        }}
      >
        No CAPA plans yet.
      </div>
    );
  }

  return (
    <div
      style={{
        overflowX: "auto",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
        <thead>
          <tr>
            <th style={th}>CAPA ID</th>
            {showLocale && <th style={th}>Branch</th>}
            <th style={th}>Dept</th>
            <th style={th}>Representative issue</th>
            <th style={th}>Sets</th>
            <th style={th}>Progress</th>
            <th style={th}>Status</th>
            <th style={th}>Created</th>
            <th style={th} aria-label="open" />
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id}>
              <td
                style={{
                  ...td,
                  whiteSpace: "nowrap",
                  borderLeft: `3px solid ${statusCardStyle(planStatus(p)).borderColor}`,
                }}
              >
                <Link
                  href={`/capa/${p.capaId}`}
                  className="mono"
                  style={{ color: "var(--navy)", fontWeight: 600, textDecoration: "none" }}
                >
                  {p.capaId}
                </Link>
              </td>
              {showLocale && (
                <td style={{ ...td, whiteSpace: "nowrap" }} className="mono">
                  {p.localeId}
                </td>
              )}
              <td style={{ ...td, whiteSpace: "nowrap" }}>{p.department}</td>
              <td style={{ ...td, maxWidth: 320 }}>
                {planRepresentativeIssue(p)}
              </td>
              <td style={td}>{activeSets(p).length}</td>
              <td style={td}>{planProgressPct(p)}%</td>
              <td style={td}>
                <StatusBadge status={planStatus(p)} size="sm" />
              </td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>
                {fmtDate(p.dateCreated)}
              </td>
              <td style={td}>
                <Link href={`/capa/${p.capaId}`} aria-label={`Open ${p.capaId}`}>
                  <ChevronRight size={16} color="var(--ink-faint)" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
