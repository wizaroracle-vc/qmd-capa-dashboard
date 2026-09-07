import "server-only";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_VERIFICATION, MONTH_NAMES, emptySixM } from "@/lib/capa-logic";
import type {
  ActionItem,
  AppData,
  CapaPlan,
  CapaSet,
  FiveWhys,
  Locale,
  Month,
  SixM,
  Verification,
} from "@/lib/capa-types";

/* ---------------------------------------------------------- row → domain --- */

type PlanRow = {
  id: string;
  capa_id: string;
  locale_id: string;
  month_id: string;
  year: number;
  month_num: number;
  department: string;
  date_created: string;
  source: string;
  prepared_by: string;
  stage: CapaPlan["stage"];
  submitted_date: string;
  archived: boolean;
  verification: unknown;
  updated_at: string;
  capa_sets: SetRow[] | null;
};
type SetRow = {
  id: string;
  set_number: number;
  set_code: string;
  archived: boolean;
  issue: string;
  six_m: unknown;
  vital_causes: unknown;
  five_whys: unknown;
  action_items: ActionItemRow[] | null;
};
type ActionItemRow = {
  id: string;
  corrective_action: string;
  preventive_action: string;
  responsible_person: string;
  target_date: string;
  status: string;
  date_completed: string;
  verification: string;
  remarks: string;
  order_index: number;
};

// NB: observation_* columns (migration 0003) are NOT selected here — they are
// filled in best-effort by enrichObservation() so the app keeps working before
// the migration is applied.
export const PLAN_SELECT = `
  id, capa_id, locale_id, month_id, year, month_num, department, date_created,
  source, prepared_by, stage, submitted_date, archived, verification, updated_at,
  capa_sets (
    id, set_number, set_code, archived, issue, six_m, vital_causes, five_whys,
    action_items (
      id, corrective_action, preventive_action, responsible_person, target_date,
      status, date_completed, verification, remarks, order_index
    )
  )
`;

function toVerification(v: unknown): Verification {
  const o = (v ?? {}) as Partial<Verification>;
  return { ...EMPTY_VERIFICATION, ...o };
}

function toSixM(v: unknown): SixM {
  const base = emptySixM();
  if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k in base && Array.isArray(val)) {
        base[k as keyof SixM] = val as SixM[keyof SixM];
      }
    }
  }
  return base;
}

function toFiveWhys(v: unknown): FiveWhys {
  const o = (v ?? {}) as Partial<FiveWhys>;
  return {
    why1: o.why1 ?? "",
    why2: o.why2 ?? "",
    why3: o.why3 ?? "",
    why4: o.why4 ?? "",
    why5: o.why5 ?? "",
    rootCause: o.rootCause ?? "",
  };
}

function mapActionItem(r: ActionItemRow): ActionItem {
  return {
    id: r.id,
    correctiveAction: r.corrective_action,
    preventiveAction: r.preventive_action,
    responsiblePerson: r.responsible_person,
    targetDate: r.target_date,
    startedDate: "",
    status: r.status,
    dateCompleted: r.date_completed,
    verification: r.verification,
    remarks: r.remarks,
  };
}

function mapSet(r: SetRow): CapaSet {
  return {
    id: r.id,
    setNumber: r.set_number,
    setCode: r.set_code,
    archived: r.archived,
    issue: r.issue,
    sixM: toSixM(r.six_m),
    vitalCauses: Array.isArray(r.vital_causes)
      ? (r.vital_causes as CapaSet["vitalCauses"])
      : [],
    fiveWhys: toFiveWhys(r.five_whys),
    actionItems: (r.action_items ?? [])
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map(mapActionItem),
  };
}

export function mapPlan(r: PlanRow): CapaPlan {
  return {
    id: r.id,
    capaId: r.capa_id,
    localeId: r.locale_id,
    monthId: r.month_id,
    year: r.year,
    monthNum: r.month_num,
    department: r.department,
    dateCreated: r.date_created,
    source: r.source,
    preparedBy: r.prepared_by,
    stage: r.stage,
    submittedDate: r.submitted_date,
    verification: toVerification(r.verification),
    archived: r.archived,
    observationStartedDate: "",
    observationDurationDays: 90,
    observationStartedBy: "",
    updatedAt: r.updated_at,
    sets: (r.capa_sets ?? [])
      .slice()
      .sort((a, b) => a.set_number - b.set_number)
      .map(mapSet),
  };
}

/* --------------------------------------------------------------- queries --- */

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Best-effort: fill in `action_items.started_date` (added by migration 0002).
 * Silently no-ops if the column doesn't exist yet, so the app keeps working
 * before the migration is applied.
 */
async function enrichStartedDates(
  supabase: ServerClient,
  plans: CapaPlan[],
): Promise<void> {
  const ids = plans.flatMap((p) =>
    p.sets.flatMap((s) => s.actionItems.map((a) => a.id)),
  );
  if (ids.length === 0) return;
  const { data, error } = await supabase
    .from("action_items")
    .select("id, started_date")
    .in("id", ids);
  if (error || !data) return;
  const map = new Map(
    (data as { id: string; started_date: string | null }[]).map((r) => [
      r.id,
      r.started_date ?? "",
    ]),
  );
  for (const p of plans) {
    for (const s of p.sets) {
      for (const a of s.actionItems) {
        a.startedDate = map.get(a.id) ?? a.startedDate;
      }
    }
  }
}

/**
 * Best-effort: fill in the `capa_plans.observation_*` columns (migration 0003).
 * Silently no-ops if the columns don't exist yet, so the app keeps working
 * before the migration is applied.
 */
async function enrichObservation(
  supabase: ServerClient,
  plans: CapaPlan[],
): Promise<void> {
  const ids = plans.map((p) => p.id);
  if (ids.length === 0) return;
  const { data, error } = await supabase
    .from("capa_plans")
    .select(
      "id, observation_started_date, observation_duration_days, observation_started_by",
    )
    .in("id", ids);
  if (error || !data) return;
  const map = new Map(
    (
      data as {
        id: string;
        observation_started_date: string | null;
        observation_duration_days: number | null;
        observation_started_by: string | null;
      }[]
    ).map((r) => [r.id, r]),
  );
  for (const p of plans) {
    const row = map.get(p.id);
    if (!row) continue;
    p.observationStartedDate = row.observation_started_date ?? "";
    p.observationDurationDays = row.observation_duration_days ?? 90;
    p.observationStartedBy = row.observation_started_by ?? "";
  }
}

/**
 * Full dataset in the shape the ported components expect ({ locales, months,
 * plans }). RLS scopes rows: a branch account sees only its branch, QMD sees all.
 */
export async function getScopedData(): Promise<AppData> {
  const supabase = await createClient();

  const [localesRes, monthsRes, plansRes] = await Promise.all([
    supabase.from("locales").select("id, name").order("id"),
    supabase
      .from("months")
      .select("id, locale_id, year, month_num, label")
      .order("year", { ascending: false })
      .order("month_num", { ascending: false }),
    supabase.from("capa_plans").select(PLAN_SELECT),
  ]);

  if (localesRes.error) throw localesRes.error;
  if (monthsRes.error) throw monthsRes.error;
  if (plansRes.error) throw plansRes.error;

  const locales: Locale[] = (localesRes.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
  }));
  const months: Month[] = (monthsRes.data ?? []).map((m) => ({
    id: m.id,
    localeId: m.locale_id,
    year: m.year,
    monthNum: m.month_num,
    label: m.label,
  }));
  const plans: CapaPlan[] = ((plansRes.data ?? []) as unknown as PlanRow[]).map(
    mapPlan,
  );
  await Promise.all([
    enrichStartedDates(supabase, plans),
    enrichObservation(supabase, plans),
  ]);

  return { locales, months, plans };
}

export async function getMonthLabel(monthId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("months")
    .select("label")
    .eq("id", monthId)
    .maybeSingle();
  return data?.label ?? "—";
}

/**
 * Idempotently make sure the current calendar month exists for this branch.
 * Called from the branch dashboard so months appear automatically — no manual
 * "Create Month" step. Safe to call on every load (one indexed SELECT, then an
 * INSERT only when missing; a 23505 race is ignored).
 */
export async function ensureCurrentMonth(localeId: string): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const monthNum = now.getMonth() + 1;

  const supabase = await createClient();
  const { data } = await supabase
    .from("months")
    .select("id")
    .eq("locale_id", localeId)
    .eq("year", year)
    .eq("month_num", monthNum)
    .maybeSingle();
  if (data) return;

  await supabase.from("months").insert({
    locale_id: localeId,
    year,
    month_num: monthNum,
    label: `${MONTH_NAMES[monthNum - 1]} ${year}`,
  });
}

export async function getPlanByCapaId(capaId: string): Promise<CapaPlan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("capa_plans")
    .select(PLAN_SELECT)
    .eq("capa_id", capaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const plan = mapPlan(data as unknown as PlanRow);
  await Promise.all([
    enrichStartedDates(supabase, [plan]),
    enrichObservation(supabase, [plan]),
  ]);
  return plan;
}
