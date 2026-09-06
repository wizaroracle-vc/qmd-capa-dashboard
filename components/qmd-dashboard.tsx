"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ClipboardCheck,
  ClipboardList,
  CircleCheck,
  FileText,
  KeyRound,
  RefreshCcw,
  RotateCcw,
  Search,
} from "lucide-react";
import { Btn, Card, Select, TextInput } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { QmdReportDialog } from "@/components/qmd-report-dialog";
import {
  DEPARTMENTS,
  activeSets,
  countByStatus,
  fmtDate,
  planProgressPct,
  planRepresentativeIssue,
  planStatus,
} from "@/lib/capa-logic";
import type { AppData, CapaPlan } from "@/lib/capa-types";

const PIE_COLORS = [
  "#93A1AF",
  "#3B7CB4",
  "#D9A02A",
  "#CC3B3B",
  "#7A5CC0",
  "#1E8E52",
];

const QMD_TABS = [
  { key: "overview", label: "Overview" },
  { key: "verification", label: "For Verification" },
  { key: "effective", label: "Effective" },
  { key: "partial", label: "Partially Effective" },
  { key: "noteffective", label: "Not Effective" },
] as const;

const th: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 12,
  color: "var(--ink-muted)",
  textTransform: "uppercase",
};
const td: React.CSSProperties = { padding: "10px 14px" };

type Enriched = CapaPlan & {
  _status: string;
  _pct: number;
  _sets: number;
  _monthLabel: string;
};

function Kpi({
  label,
  value,
  color,
  icon: Icon,
  onClick,
  active,
}: {
  label: string;
  value: number;
  color: string;
  icon: typeof ClipboardList;
  /** Click to jump to the matching tab / status filter. */
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        font: "inherit",
        textAlign: "left",
        width: "100%",
        background: "var(--surface)",
        border: `1px solid ${active ? color : "var(--border)"}`,
        boxShadow: active
          ? `inset 0 0 0 1px ${color}, 0 1px 3px rgba(16,24,40,0.10)`
          : "0 1px 2px rgba(16,24,40,0.04)",
        borderRadius: 12,
        padding: "16px 18px",
        minWidth: 0,
        cursor: onClick ? "pointer" : "default",
        transition: "border-color .12s, box-shadow .12s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--ink-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </div>
        <Icon size={16} color={color} />
      </div>
      <div
        className="disp"
        style={{ fontSize: 28, fontWeight: 700, color, marginTop: 6 }}
      >
        {value}
      </div>
    </button>
  );
}

function ChartCard({
  title,
  height,
  children,
}: {
  title: string;
  height: number;
  children: React.ReactElement;
}) {
  return (
    <Card style={{ padding: 16, height }}>
      <div
        className="disp"
        style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}
      >
        {title}
      </div>
      <ResponsiveContainer width="100%" height="86%">
        {children}
      </ResponsiveContainer>
    </Card>
  );
}

function ResultListTable({
  plans,
  locales,
  emptyLabel,
  actions,
}: {
  plans: Enriched[];
  locales: AppData["locales"];
  emptyLabel: string;
  actions: (p: Enriched) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [localeFilter, setLocaleFilter] = useState("All");
  const filtered = plans.filter((p) => {
    if (localeFilter !== "All" && p.localeId !== localeFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !(
          p.capaId.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q) ||
          planRepresentativeIssue(p).toLowerCase().includes(q)
        )
      )
        return false;
    }
    return true;
  });

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", width: 220 }}>
          <Search
            size={14}
            style={{ position: "absolute", left: 10, top: 11, color: "var(--ink-faint)" }}
          />
          <TextInput
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <Select
          value={localeFilter}
          onChange={(e) => setLocaleFilter(e.target.value)}
          style={{ width: 130 }}
        >
          <option>All</option>
          {locales.map((l) => (
            <option key={l.id}>{l.id}</option>
          ))}
        </Select>
        <span
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            marginLeft: "auto",
          }}
        >
          {filtered.length} CAPA(s)
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {[
                "CAPA ID",
                "Locale",
                "Month",
                "Department",
                "Prepared By",
                "Issue / Finding",
                "Verification Date",
                "Verified By",
                "Status",
              ].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>
                    {p.capaId}
                  </span>
                </td>
                <td style={{ ...td, fontWeight: 700 }}>{p.localeId}</td>
                <td style={td}>{p._monthLabel}</td>
                <td style={td}>{p.department}</td>
                <td style={td}>{p.preparedBy || "—"}</td>
                <td style={{ ...td, maxWidth: 260 }}>
                  {planRepresentativeIssue(p)}
                </td>
                <td style={td}>{fmtDate(p.verification.date)}</td>
                <td style={td}>{p.verification.verifiedBy || "—"}</td>
                <td style={td}>
                  <StatusBadge status={p._status} size="sm" />
                </td>
                <td style={td}>{actions(p)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  style={{ padding: 20, textAlign: "center", color: "var(--ink-faint)" }}
                >
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function QmdDashboard({ data }: { data: AppData }) {
  const [tab, setTab] = useState<(typeof QMD_TABS)[number]["key"]>("overview");
  const [query, setQuery] = useState("");
  const [localeFilter, setLocaleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [verifLocale, setVerifLocale] = useState("All");

  const monthById = useMemo(
    () => new Map(data.months.map((m) => [m.id, m.label])),
    [data.months],
  );

  const enriched: Enriched[] = useMemo(
    () =>
      data.plans
        .filter((p) => !p.archived)
        .map((p) => ({
          ...p,
          _status: planStatus(p),
          _pct: planProgressPct(p),
          _sets: activeSets(p).length,
          _monthLabel: monthById.get(p.monthId) ?? "—",
        })),
    [data.plans, monthById],
  );

  const departments = useMemo(() => {
    const set = new Set<string>(DEPARTMENTS);
    enriched.forEach((p) => p.department && set.add(p.department));
    return Array.from(set).sort();
  }, [enriched]);

  const totals = countByStatus(enriched);
  // Most recent on top, matching the branch dashboard: by date posted
  // (`dateCreated`), then `updatedAt` (the submit timestamp) to break same-day
  // ties — not the day-resolution `submittedDate` field.
  const forVerification = enriched
    .filter((p) => p._status === "For QMD Verification")
    .sort(
      (a, b) =>
        b.dateCreated.localeCompare(a.dateCreated) ||
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    );
  const forVerificationShown =
    verifLocale === "All"
      ? forVerification
      : forVerification.filter((p) => p.localeId === verifLocale);
  const effective = enriched.filter((p) => p._status === "Effective");
  const partial = enriched.filter((p) => p._status === "Partially Effective");
  const notEffective = enriched.filter((p) => p._status === "Not Effective");

  const byLocale = data.locales.map((l) => {
    const lp = enriched.filter((p) => p.localeId === l.id);
    const count = (s: string) => lp.filter((p) => p._status === s).length;
    return {
      locale: l.id,
      plans: lp.length,
      findings: lp.reduce((a, p) => a + p._sets, 0),
      open: count("Open"),
      inProgress: count("In Progress"),
      overdue: count("Overdue"),
      closed: count("Effective"),
    };
  });

  const statusPie = [
    "Open",
    "In Progress",
    "For QMD Verification",
    "Overdue",
    "Partially Effective",
    "Effective",
  ]
    .map((s) => ({
      name: s,
      value: enriched.filter((p) => p._status === s).length,
    }))
    .filter((d) => d.value > 0);

  const deptMap: Record<string, number> = {};
  enriched.forEach((p) => {
    deptMap[p.department] = (deptMap[p.department] || 0) + 1;
  });
  const byDept = Object.entries(deptMap).map(([name, value]) => ({ name, value }));

  const filtered = enriched.filter((p) => {
    if (localeFilter !== "All" && p.localeId !== localeFilter) return false;
    if (statusFilter !== "All" && p._status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !(
          p.capaId.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q) ||
          p.preparedBy.toLowerCase().includes(q)
        )
      )
        return false;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 24px 60px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div>
          <div className="capa-tag">MANAGEMENT MASTER DASHBOARD</div>
          <div
            className="disp"
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "var(--navy-deep)",
              marginTop: 10,
            }}
          >
            QMD Overview All Locales
          </div>
        </div>
        <Link
          href="/qmd/accounts"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--navy)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 12px",
            textDecoration: "none",
          }}
        >
          <KeyRound size={14} /> Branch accounts
        </Link>
      </div>

      <div
        style={{
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 14,
          marginBottom: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))",
          gap: 12,
        }}
      >
        <Kpi
          label="Total CAPA"
          value={totals.total}
          color="var(--navy)"
          icon={ClipboardList}
          onClick={() => setTab("overview")}
          active={tab === "overview"}
        />
        <Kpi
          label="For Verification"
          value={totals["For QMD Verification"] || 0}
          color="var(--gold)"
          icon={ClipboardCheck}
          onClick={() => setTab("verification")}
          active={tab === "verification"}
        />
        <Kpi
          label="Effective"
          value={totals.Effective || 0}
          color="var(--green)"
          icon={CircleCheck}
          onClick={() => setTab("effective")}
          active={tab === "effective"}
        />
        <Kpi
          label="Partially Effective"
          value={totals["Partially Effective"] || 0}
          color="var(--purple)"
          icon={RotateCcw}
          onClick={() => setTab("partial")}
          active={tab === "partial"}
        />
        <Kpi
          label="Not Effective"
          value={totals["Not Effective"] || 0}
          color="var(--red)"
          icon={RefreshCcw}
          onClick={() => setTab("noteffective")}
          active={tab === "noteffective"}
        />
      </div>

      <div
        className="no-print"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 6,
          overflowX: "auto",
          flex: "1 1 420px",
          minWidth: 0,
        }}
      >
        {QMD_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "9px 16px",
                borderRadius: 8,
                whiteSpace: "nowrap",
                background: active ? "var(--navy)" : "transparent",
                color: active ? "#fff" : "var(--ink-muted)",
                fontWeight: 600,
                fontSize: 13.5,
              }}
            >
              {t.label}
              {t.key === "verification" && forVerification.length > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    background: active ? "rgba(255,255,255,0.25)" : "var(--gold-soft)",
                    color: active ? "#fff" : "var(--gold)",
                    borderRadius: 999,
                    padding: "1px 7px",
                    fontSize: 11,
                  }}
                >
                  {forVerification.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
        <QmdReportDialog
          plans={enriched}
          locales={data.locales}
          departments={departments}
        />
      </div>

      {tab === "verification" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--border)",
              background: "var(--gold-soft)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span className="disp" style={{ fontWeight: 700, fontSize: 16 }}>
              CAPAs for Verification
            </span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--gold)",
              }}
            >
              {forVerificationShown.length} awaiting QMD review
              {verifLocale !== "All" ? ` in ${verifLocale}` : ""}
            </span>
            <Select
              value={verifLocale}
              onChange={(e) => setVerifLocale(e.target.value)}
              style={{ width: 150, marginLeft: "auto" }}
            >
              <option value="All">All locales</option>
              {data.locales.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id}
                </option>
              ))}
            </Select>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)" }}>
                  {[
                    "CAPA ID",
                    "Locale",
                    "Month",
                    "Department",
                    "Prepared By",
                    "No. of Findings",
                    "Submitted Date",
                    "Status",
                    "",
                  ].map((h, i) => (
                    <th key={i} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forVerificationShown.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={td}>
                      <span className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>
                        {p.capaId}
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 700 }}>{p.localeId}</td>
                    <td style={td}>{p._monthLabel}</td>
                    <td style={td}>{p.department}</td>
                    <td style={td}>{p.preparedBy || "—"}</td>
                    <td style={td}>{p._sets}</td>
                    <td style={td}>{fmtDate(p.submittedDate)}</td>
                    <td style={td}>
                      <StatusBadge status={p._status} size="sm" />
                    </td>
                    <td style={td}>
                      <Link href={`/capa/${p.capaId}?stage=summary`}>
                        <Btn size="sm">
                          <ClipboardCheck size={13} /> Review / Verify
                        </Btn>
                      </Link>
                    </td>
                  </tr>
                ))}
                {forVerificationShown.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{ padding: 20, textAlign: "center", color: "var(--ink-faint)" }}
                    >
                      {verifLocale === "All"
                        ? "Nothing awaiting verification right now."
                        : `Nothing awaiting verification in ${verifLocale}.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "effective" && (
        <ResultListTable
          plans={effective}
          locales={data.locales}
          emptyLabel="No CAPAs marked Effective yet."
          actions={(p) => (
            <div style={{ display: "flex", gap: 6 }}>
              <Link href={`/capa/${p.capaId}?stage=summary`}>
                <Btn size="sm" variant="outline">
                  View CAPA
                </Btn>
              </Link>
              <Link href={`/capa/${p.capaId}/report`} title="Report">
                <Btn size="sm" variant="ghost">
                  <FileText size={14} />
                </Btn>
              </Link>
            </div>
          )}
        />
      )}
      {tab === "partial" && (
        <ResultListTable
          plans={partial}
          locales={data.locales}
          emptyLabel="No CAPAs marked Partially Effective yet."
          actions={(p) => (
            <div style={{ display: "flex", gap: 6 }}>
              <Link href={`/capa/${p.capaId}?stage=summary`}>
                <Btn size="sm" variant="outline">
                  View CAPA
                </Btn>
              </Link>
              <Link href={`/capa/${p.capaId}/report`} title="Report">
                <Btn size="sm" variant="ghost">
                  <FileText size={14} />
                </Btn>
              </Link>
            </div>
          )}
        />
      )}
      {tab === "noteffective" && (
        <ResultListTable
          plans={notEffective}
          locales={data.locales}
          emptyLabel="No CAPAs marked Not Effective."
          actions={(p) => (
            <div style={{ display: "flex", gap: 6 }}>
              <Link href={`/capa/${p.capaId}?stage=summary`}>
                <Btn size="sm" variant="danger">
                  <RefreshCcw size={13} /> Reopen CAPA
                </Btn>
              </Link>
              <Link href={`/capa/${p.capaId}/report`} title="Report">
                <Btn size="sm" variant="ghost">
                  <FileText size={14} />
                </Btn>
              </Link>
            </div>
          )}
        />
      )}

      {tab === "overview" && (
        <>
          <Card style={{ padding: 0, marginBottom: 18, overflow: "hidden" }}>
            <div
              className="disp"
              style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}
            >
              <span style={{ fontWeight: 700, fontSize: 16 }}>
                CAPA Status by Locale
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}
              >
                <thead>
                  <tr style={{ background: "var(--surface-alt)" }}>
                    {[
                      "Locale",
                      "CAPA Plans",
                      "Major Findings",
                      "Open",
                      "In Progress",
                      "Overdue",
                      "Effective",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{ ...th, textAlign: h === "Locale" ? "left" : "right" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byLocale.map((l) => (
                    <tr key={l.locale} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ ...td, fontWeight: 700 }}>{l.locale}</td>
                      <td style={{ ...td, textAlign: "right" }}>{l.plans}</td>
                      <td style={{ ...td, textAlign: "right" }}>{l.findings}</td>
                      <td style={{ ...td, textAlign: "right" }}>{l.open}</td>
                      <td style={{ ...td, textAlign: "right" }}>{l.inProgress}</td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          color: l.overdue > 0 ? "var(--red)" : "inherit",
                          fontWeight: l.overdue > 0 ? 700 : 400,
                        }}
                      >
                        {l.overdue}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          color: "var(--green)",
                          fontWeight: 700,
                        }}
                      >
                        {l.closed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <ChartCard title="CAPAs by Locale" height={260}>
              <BarChart data={byLocale}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9EEF2" />
                <XAxis
                  dataKey="locale"
                  fontSize={11}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={40}
                />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="plans" fill="#3B7CB4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="CAPAs by Status" height={300}>
              <PieChart>
                <Pie
                  data={statusPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="46%"
                  outerRadius={68}
                  label={(e: { value?: number }) => e.value ?? ""}
                >
                  {statusPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  verticalAlign="bottom"
                  height={52}
                  iconSize={9}
                  wrapperStyle={{ fontSize: 11, lineHeight: 1.4 }}
                />
              </PieChart>
            </ChartCard>

            <ChartCard title="Major Findings by Locale" height={260}>
              <BarChart data={byLocale}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9EEF2" />
                <XAxis
                  dataKey="locale"
                  fontSize={11}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={40}
                />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="findings" fill="#D97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <ChartCard title="Overdue CAPAs by Locale" height={240}>
              <BarChart data={byLocale}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9EEF2" />
                <XAxis
                  dataKey="locale"
                  fontSize={11}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={40}
                />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="overdue" fill="#CC3B3B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="CAPAs by Department" height={240}>
              <BarChart data={byDept} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E9EEF2" />
                <XAxis type="number" fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={80} fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="#1E3A8A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartCard>
          </div>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "16px 18px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div
                className="disp"
                style={{ fontWeight: 700, fontSize: 16, marginRight: "auto" }}
              >
                All CAPA Plans
              </div>
              <div style={{ position: "relative", width: 220 }}>
                <Search
                  size={14}
                  style={{ position: "absolute", left: 10, top: 11, color: "var(--ink-faint)" }}
                />
                <TextInput
                  placeholder="Search…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ paddingLeft: 30 }}
                />
              </div>
              <Select
                value={localeFilter}
                onChange={(e) => setLocaleFilter(e.target.value)}
                style={{ width: 120 }}
              >
                <option>All</option>
                {data.locales.map((l) => (
                  <option key={l.id}>{l.id}</option>
                ))}
              </Select>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: 190 }}
              >
                <option>All</option>
                {[
                  "Open",
                  "In Progress",
                  "For QMD Verification",
                  "Overdue",
                  "Effective",
                  "Partially Effective",
                  "Not Effective",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}
              >
                <thead>
                  <tr style={{ background: "var(--surface-alt)" }}>
                    {[
                      "CAPA ID",
                      "Locale",
                      "Month",
                      "Department",
                      "Prepared By",
                      "Status",
                      "Completion",
                      "Action",
                    ].map((h) => (
                      <th key={h} style={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={td}>
                        <span className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>
                          {p.capaId}
                        </span>
                      </td>
                      <td style={{ ...td, fontWeight: 700 }}>{p.localeId}</td>
                      <td style={{ ...td, color: "var(--ink-muted)" }}>
                        {p._monthLabel}
                      </td>
                      <td style={{ ...td, color: "var(--ink-muted)" }}>
                        {p.department}
                      </td>
                      <td style={td}>{p.preparedBy || "—"}</td>
                      <td style={td}>
                        <StatusBadge status={p._status} size="sm" />
                      </td>
                      <td style={td}>{p._pct}%</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Link href={`/capa/${p.capaId}`}>
                            <Btn size="sm" variant="outline">
                              View
                            </Btn>
                          </Link>
                          <Link href={`/capa/${p.capaId}/report`} title="Report">
                            <Btn size="sm" variant="ghost">
                              <FileText size={14} />
                            </Btn>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{ padding: 24, textAlign: "center", color: "var(--ink-faint)" }}
                      >
                        No matching CAPA plans.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
