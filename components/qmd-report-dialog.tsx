"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Btn, Modal, Select } from "@/components/ui";
import { activeSets, fmtDate, planRepresentativeIssue } from "@/lib/capa-logic";
import type { AppData, CapaPlan } from "@/lib/capa-types";

type Enriched = CapaPlan & {
  _status: string;
  _pct: number;
  _sets: number;
  _monthLabel: string;
};

const STATUSES = [
  "Open",
  "In Progress",
  "Overdue",
  "Awaiting Observation",
  "Under Observation",
  "For QMD Verification",
  "Effective",
  "Partially Effective",
  "Not Effective",
];

type CellVal = string | number | null;
type XCell =
  | {
      value: string | number;
      type?: unknown;
      fontWeight?: "bold";
      backgroundColor?: string;
    }
  | null;

const HEAD = (s: string): XCell => ({
  value: s,
  fontWeight: "bold",
  backgroundColor: "#EEF2F6",
});
const CELL = (v: CellVal): XCell =>
  v === null || v === ""
    ? null
    : typeof v === "number"
      ? { value: v, type: Number }
      : { value: String(v), type: String };
const sheetOf = (headers: string[], rows: CellVal[][]): XCell[][] => [
  headers.map(HEAD),
  ...rows.map((r) => r.map(CELL)),
];

// write-excel-file's published types mistype the low-level `data` format
// (`type: Number` etc. is valid at runtime but the .d.ts resolves it to `never`).
type WriteXlsx = (data: unknown, options: unknown) => Promise<void>;

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--ink-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 6,
  display: "block",
};

export function QmdReportDialog({
  plans,
  locales,
  departments,
}: {
  plans: Enriched[];
  locales: AppData["locales"];
  departments: string[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"detailed" | "summary">("detailed");
  const [locale, setLocale] = useState("All");
  const [dept, setDept] = useState("All");
  const [statuses, setStatuses] = useState<string[]>([...STATUSES]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const allStatuses = statuses.length === STATUSES.length;
  const toggle = (s: string) =>
    setStatuses((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );

  const generate = async () => {
    setErr("");
    if (statuses.length === 0) {
      setErr("Pick at least one status.");
      return;
    }
    setBusy(true);
    try {
      const rows = plans.filter(
        (p) =>
          (locale === "All" || p.localeId === locale) &&
          (dept === "All" || p.department === dept) &&
          statuses.includes(p._status),
      );

      const writeXlsxFile = (await import("write-excel-file"))
        .default as unknown as WriteXlsx;
      const today = new Date().toISOString().slice(0, 10);
      const scope = locale === "All" ? "ALL" : locale;
      const fileName = `CAPA_Report_${scope}_${mode}_${today}.xlsx`;

      const count = (arr: Enriched[], s: string) =>
        arr.filter((p) => p._status === s).length;

      if (mode === "summary") {
        const shownStatuses = STATUSES.filter((s) => statuses.includes(s));
        const overview = sheetOf(
          ["Status", "Count"],
          [
            ...shownStatuses.map((s) => [s, count(rows, s)] as CellVal[]),
            ["TOTAL", rows.length],
          ],
        );
        const localeIds = locale === "All" ? locales.map((l) => l.id) : [locale];
        const byLocale = sheetOf(
          ["Locale", "Total", ...shownStatuses],
          localeIds.map((id) => {
            const lp = rows.filter((p) => p.localeId === id);
            return [id, lp.length, ...shownStatuses.map((s) => count(lp, s))];
          }),
        );
        const deptIds = dept === "All" ? departments : [dept];
        const byDept = sheetOf(
          ["Department", "Total", ...shownStatuses],
          deptIds.map((d) => {
            const dp = rows.filter((p) => p.department === d);
            return [d, dp.length, ...shownStatuses.map((s) => count(dp, s))];
          }),
        );
        await writeXlsxFile([overview, byLocale, byDept], {
          sheets: ["Overview", "By Locale", "By Department"],
          fileName,
        });
      } else {
        const capaSheet = sheetOf(
          [
            "CAPA ID",
            "Locale",
            "Month",
            "Department",
            "Prepared By",
            "Status",
            "Completion %",
            "Issue / Finding",
            "Date Created",
            "Source",
            "Submitted",
            "Verification Date",
            "Verified By",
            "Result",
          ],
          rows.map((p) => [
            p.capaId,
            p.localeId,
            p._monthLabel,
            p.department,
            p.preparedBy,
            p._status,
            p._pct,
            planRepresentativeIssue(p),
            fmtDate(p.dateCreated),
            p.source,
            fmtDate(p.submittedDate),
            fmtDate(p.verification.date),
            p.verification.verifiedBy,
            p.verification.result,
          ]),
        );
        const aiRows: CellVal[][] = [];
        for (const p of rows) {
          for (const s of activeSets(p)) {
            for (const a of s.actionItems) {
              aiRows.push([
                p.capaId,
                p.localeId,
                s.setNumber,
                a.correctiveAction,
                a.preventiveAction,
                a.responsiblePerson,
                fmtDate(a.startedDate),
                fmtDate(a.targetDate),
                a.verification,
                a.remarks,
              ]);
            }
          }
        }
        const aiSheet = sheetOf(
          [
            "CAPA ID",
            "Locale",
            "Set",
            "Corrective Action",
            "Preventive Action",
            "Responsible",
            "Started",
            "Expected Completion",
            "Verification",
            "Remarks",
          ],
          aiRows,
        );
        await writeXlsxFile([capaSheet, aiSheet], {
          sheets: ["CAPAs", "Action Items"],
          fileName,
        });
      }
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate the report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Btn variant="outline" onClick={() => setOpen(true)} style={{ whiteSpace: "nowrap" }}>
        <FileSpreadsheet size={15} /> Export Excel
      </Btn>

      {open && (
        <Modal title="Generate CAPA Report" onClose={() => setOpen(false)} width={560}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <span style={label}>Report type</span>
              <div style={{ display: "flex", gap: 8 }}>
                {(
                  [
                    ["detailed", "Detailed", "One row per CAPA + an Action Items sheet"],
                    ["summary", "Summary", "Counts by status, locale and department"],
                  ] as const
                ).map(([key, title, hint]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMode(key)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      cursor: "pointer",
                      border: `1px solid ${mode === key ? "var(--navy)" : "var(--border)"}`,
                      background: mode === key ? "var(--steel-soft)" : "#fff",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 2 }}>
                      {hint}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <span style={label}>Branch / Locale</span>
                <Select value={locale} onChange={(e) => setLocale(e.target.value)}>
                  <option value="All">All locales</option>
                  {locales.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.id}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <span style={label}>Department</span>
                <Select value={dept} onChange={(e) => setDept(e.target.value)}>
                  <option value="All">All departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span style={label}>Status</span>
                <button
                  type="button"
                  onClick={() => setStatuses(allStatuses ? [] : [...STATUSES])}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--steel)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {allStatuses ? "Clear all" : "Select all"}
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px 14px",
                }}
              >
                {STATUSES.map((s) => (
                  <label
                    key={s}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={statuses.includes(s)}
                      onChange={() => toggle(s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            {err && (
              <div style={{ color: "var(--red)", fontSize: 12.5 }}>{err}</div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Btn>
              <Btn onClick={generate} disabled={busy}>
                <FileSpreadsheet size={15} />
                {busy ? "Generating…" : "Generate .xlsx"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
