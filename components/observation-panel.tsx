"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Hourglass,
  PlayCircle,
  Timer,
} from "lucide-react";
import { Btn, Card, ConfirmDialog, Modal, Select, TextInput } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import {
  DEFAULT_OBSERVATION_DAYS,
  OBSERVATION_PRESETS,
  fmtDate,
  isObservationComplete,
  observationDaysRemaining,
  observationEndDate,
  observationProgressPct,
  planStatus,
  todayStr,
} from "@/lib/capa-logic";
import {
  adjustObservationAction,
  cancelObservationAction,
  startObservationAction,
} from "@/lib/capa-actions";
import type { AppData, CapaPlan } from "@/lib/capa-types";

const th: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 12,
  color: "var(--ink-muted)",
  textTransform: "uppercase",
};
const td: React.CSSProperties = { padding: "10px 14px", verticalAlign: "top" };

const PAGE_SIZE = 8;

type Enriched = CapaPlan & { _monthLabel: string };

/** Slice `items` into pages; resets to page 1 whenever `resetKey` changes. */
function usePage<T>(items: T[], resetKey: unknown) {
  const [page, setPage] = useState(1);
  const [prevKey, setPrevKey] = useState(resetKey);
  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setPage(1);
  }
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  return { rows, page: current, setPage, pageCount };
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

function Pager({
  page,
  pageCount,
  setPage,
}: {
  page: number;
  pageCount: number;
  setPage: (fn: (n: number) => number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 12,
        padding: "10px 16px",
        borderTop: "1px solid var(--border)",
      }}
    >
      <button
        type="button"
        onClick={() => setPage((n) => Math.max(1, n - 1))}
        disabled={page <= 1}
        style={pagerBtn(page <= 1)}
      >
        <ChevronLeft size={14} /> Prev
      </button>
      <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => setPage((n) => Math.min(pageCount, n + 1))}
        disabled={page >= pageCount}
        style={pagerBtn(page >= pageCount)}
      >
        Next <ChevronRight size={14} />
      </button>
    </div>
  );
}

/** Add N days to a "YYYY-MM-DD" string. */
function addDays(date: string, days: number): string {
  const t = new Date(date + "T00:00:00").getTime();
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 999,
        background: "var(--border)",
        overflow: "hidden",
        minWidth: 90,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: "var(--steel)",
        }}
      />
    </div>
  );
}

function remainingLabel(n: number | null): string {
  if (n === null) return "—";
  if (n > 1) return `${n} days left`;
  if (n === 1) return "1 day left";
  if (n === 0) return "ends today";
  return `${Math.abs(n)} day(s) overdue`;
}

/* ----------------------------------------------------- start / adjust --- */

function ObservationDialog({
  plan,
  mode,
  onClose,
}: {
  plan: Enriched;
  mode: "start" | "adjust";
  onClose: () => void;
}) {
  const router = useRouter();
  const [startedBy, setStartedBy] = useState(plan.observationStartedBy ?? "");
  const [startedDate, setStartedDate] = useState(
    plan.observationStartedDate || todayStr(),
  );
  const initialDays =
    mode === "adjust"
      ? plan.observationDurationDays ?? DEFAULT_OBSERVATION_DAYS
      : DEFAULT_OBSERVATION_DAYS;
  const presetMatch = OBSERVATION_PRESETS.some((p) => p.days === initialDays);
  const [preset, setPreset] = useState<string>(
    presetMatch ? String(initialDays) : "custom",
  );
  const [customDays, setCustomDays] = useState<string>(String(initialDays));
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();

  const days = preset === "custom" ? Math.floor(Number(customDays)) : Number(preset);
  const validDays = Number.isFinite(days) && days >= 1 && days <= 730;
  const endDate = validDays && startedDate ? addDays(startedDate, days) : "";

  const submit = () => {
    setErr("");
    if (!validDays) {
      setErr("Duration must be between 1 and 730 days.");
      return;
    }
    if (mode === "start" && !startedBy.trim()) {
      setErr("Enter who is starting the observation.");
      return;
    }
    start(async () => {
      const res =
        mode === "start"
          ? await startObservationAction(
              plan.capaId,
              { startedDate, durationDays: days, startedBy },
              plan.updatedAt ?? "",
            )
          : await adjustObservationAction(
              plan.capaId,
              { startedDate, durationDays: days },
              plan.updatedAt ?? "",
            );
      if (res.error) {
        setErr(res.error);
        return;
      }
      if (res.conflict) {
        setErr("Someone else changed this CAPA — reload and try again.");
        return;
      }
      onClose();
      router.refresh();
    });
  };

  const label: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--ink-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 5,
    display: "block",
  };

  return (
    <Modal
      title={
        mode === "start"
          ? `Start observation — ${plan.capaId}`
          : `Adjust observation window — ${plan.capaId}`
      }
      onClose={busy ? undefined : onClose}
      width={480}
    >
      <div style={{ display: "grid", gap: 14 }}>
        {mode === "start" && (
          <div>
            <label style={label}>Observation started by</label>
            <TextInput
              value={startedBy}
              onChange={(e) => setStartedBy(e.target.value)}
              placeholder="QMD officer name"
            />
          </div>
        )}
        <div>
          <label style={label}>Duration</label>
          <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {OBSERVATION_PRESETS.map((p) => (
              <option key={p.days} value={String(p.days)}>
                {p.label} ({p.days} days)
              </option>
            ))}
            <option value="custom">Custom…</option>
          </Select>
          {preset === "custom" && (
            <TextInput
              type="number"
              min={1}
              max={730}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder="Number of days"
              style={{ marginTop: 8 }}
            />
          )}
        </div>
        <div>
          <label style={label}>Start date</label>
          <TextInput
            type="date"
            value={startedDate}
            onChange={(e) => setStartedDate(e.target.value)}
          />
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--navy)",
            background: "var(--steel-soft)",
            border: "1px solid var(--steel)",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          {endDate ? (
            <>
              Observation ends <strong>{fmtDate(endDate)}</strong>. The CAPA then
              moves to <strong>For QMD Verification</strong> automatically.
            </>
          ) : (
            "Enter a valid duration and start date."
          )}
        </div>
        {err && (
          <div style={{ fontSize: 12.5, color: "var(--red)" }}>{err}</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn variant="primary" onClick={submit} disabled={busy || !endDate}>
            {busy
              ? "Saving…"
              : mode === "start"
                ? "Start Observation"
                : "Save window"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------- sections --- */

function SectionCard({
  title,
  tone,
  icon: Icon,
  count,
  children,
  pager,
}: {
  title: string;
  tone: string;
  icon: typeof Hourglass;
  count: number;
  children: React.ReactNode;
  pager?: React.ReactNode;
}) {
  return (
    <Card style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}>
      <div
        style={{
          padding: "13px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon size={17} color={tone} />
        <span className="disp" style={{ fontWeight: 700, fontSize: 15.5 }}>
          {title}
        </span>
        <span
          style={{
            background: "var(--surface-alt)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "1px 9px",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-muted)",
          }}
        >
          {count}
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
      {pager}
    </Card>
  );
}

export function ObservationPanel({ data }: { data: AppData }) {
  const router = useRouter();
  const [localeFilter, setLocaleFilter] = useState("All");
  const [dialog, setDialog] = useState<
    { plan: Enriched; mode: "start" | "adjust" } | null
  >(null);
  const [cancelFor, setCancelFor] = useState<Enriched | null>(null);
  const [busy, startCancel] = useTransition();

  const monthById = useMemo(
    () => new Map(data.months.map((m) => [m.id, m.label])),
    [data.months],
  );

  const enriched: Enriched[] = useMemo(
    () =>
      data.plans
        .filter((p) => !p.archived)
        .filter((p) => localeFilter === "All" || p.localeId === localeFilter)
        .map((p) => ({ ...p, _monthLabel: monthById.get(p.monthId) ?? "—" })),
    [data.plans, monthById, localeFilter],
  );

  const awaiting = enriched
    .filter((p) => p.stage === "submitted")
    .sort((a, b) => (b.submittedDate || "").localeCompare(a.submittedDate || ""));
  const observing = enriched
    .filter((p) => p.stage === "observing" && !isObservationComplete(p))
    .sort(
      (a, b) =>
        (observationDaysRemaining(a) ?? 0) - (observationDaysRemaining(b) ?? 0),
    );
  const ready = enriched.filter(
    (p) => p.stage === "observing" && isObservationComplete(p),
  );

  const awaitingPage = usePage(awaiting, localeFilter);
  const observingPage = usePage(observing, localeFilter);
  const readyPage = usePage(ready, localeFilter);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 60px" }}>
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
          <div className="capa-tag">QMD · MONITORING</div>
          <div
            className="disp"
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "var(--navy-deep)",
              marginTop: 10,
            }}
          >
            Observation Panel
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 6 }}>
            Put submitted CAPAs under observation. When the window ends they move
            to QMD verification automatically.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Select
            value={localeFilter}
            onChange={(e) => setLocaleFilter(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="All">All locales</option>
            {data.locales.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id}
              </option>
            ))}
          </Select>
          <Link
            href="/qmd"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--navy)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 12px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <SectionCard
        title="Awaiting Observation"
        tone="#6366F1"
        icon={Hourglass}
        count={awaiting.length}
        pager={
          <Pager
            page={awaitingPage.page}
            pageCount={awaitingPage.pageCount}
            setPage={awaitingPage.setPage}
          />
        }
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {["CAPA ID", "Locale", "Month", "Department", "Prepared By", "Submitted", ""].map(
                (h, i) => (
                  <th key={i} style={th}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {awaitingPage.rows.map((p) => (
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
                <td style={td}>{fmtDate(p.submittedDate)}</td>
                <td style={td}>
                  <Btn
                    size="sm"
                    onClick={() => setDialog({ plan: p, mode: "start" })}
                  >
                    <PlayCircle size={13} /> Start Observation
                  </Btn>
                </td>
              </tr>
            ))}
            {awaiting.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{ padding: 20, textAlign: "center", color: "var(--ink-faint)" }}
                >
                  Nothing waiting for an observation window.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard
        title="Under Observation"
        tone="#14B8A6"
        icon={Eye}
        count={observing.length}
        pager={
          <Pager
            page={observingPage.page}
            pageCount={observingPage.pageCount}
            setPage={observingPage.setPage}
          />
        }
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {["CAPA ID", "Locale", "Started", "Ends", "Progress", "Remaining", ""].map(
                (h, i) => (
                  <th key={i} style={th}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {observingPage.rows.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>
                    {p.capaId}
                  </span>
                  <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                    {p.department} · {p.observationDurationDays} days
                  </div>
                </td>
                <td style={{ ...td, fontWeight: 700 }}>{p.localeId}</td>
                <td style={td}>{fmtDate(p.observationStartedDate)}</td>
                <td style={td}>{fmtDate(observationEndDate(p))}</td>
                <td style={{ ...td, minWidth: 110 }}>
                  <ProgressBar pct={observationProgressPct(p)} />
                </td>
                <td style={td}>{remainingLabel(observationDaysRemaining(p))}</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() => setDialog({ plan: p, mode: "adjust" })}
                    >
                      <Timer size={13} /> Adjust
                    </Btn>
                    <Link href={`/capa/${p.capaId}?stage=summary`}>
                      <Btn size="sm" variant="ghost">
                        Review
                      </Btn>
                    </Link>
                    <Btn
                      size="sm"
                      variant="danger"
                      onClick={() => setCancelFor(p)}
                    >
                      Cancel
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
            {observing.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{ padding: 20, textAlign: "center", color: "var(--ink-faint)" }}
                >
                  No CAPAs are currently under observation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard
        title="Observation ended ready to verify"
        tone="#3B82F6"
        icon={ClipboardCheck}
        count={ready.length}
        pager={
          <Pager
            page={readyPage.page}
            pageCount={readyPage.pageCount}
            setPage={readyPage.setPage}
          />
        }
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {["CAPA ID", "Locale", "Department", "Window", "Ended", "Status", ""].map(
                (h, i) => (
                  <th key={i} style={th}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {readyPage.rows.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>
                    {p.capaId}
                  </span>
                </td>
                <td style={{ ...td, fontWeight: 700 }}>{p.localeId}</td>
                <td style={td}>{p.department}</td>
                <td style={td}>
                  {fmtDate(p.observationStartedDate)} → {fmtDate(observationEndDate(p))}
                </td>
                <td style={td}>{remainingLabel(observationDaysRemaining(p))}</td>
                <td style={td}>
                  <StatusBadge status={planStatus(p)} size="sm" />
                </td>
                <td style={td}>
                  <Link href={`/capa/${p.capaId}?stage=summary`}>
                    <Btn size="sm" variant="primary">
                      <ClipboardCheck size={13} /> Verify
                    </Btn>
                  </Link>
                </td>
              </tr>
            ))}
            {ready.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{ padding: 20, textAlign: "center", color: "var(--ink-faint)" }}
                >
                  No observation windows have ended yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </SectionCard>

      {dialog && (
        <ObservationDialog
          plan={dialog.plan}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
        />
      )}
      {cancelFor && (
        <ConfirmDialog
          title="Cancel observation?"
          message={`${cancelFor.capaId} goes back to "Awaiting Observation". You can start a new window with different settings.`}
          confirmLabel="Cancel observation"
          cancelLabel="Keep observing"
          busy={busy}
          onCancel={() => setCancelFor(null)}
          onConfirm={() =>
            startCancel(async () => {
              const res = await cancelObservationAction(
                cancelFor.capaId,
                cancelFor.updatedAt ?? "",
              );
              setCancelFor(null);
              if (!res.error) router.refresh();
            })
          }
        />
      )}
    </div>
  );
}
