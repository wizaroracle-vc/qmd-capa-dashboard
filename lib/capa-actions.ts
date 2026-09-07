"use server";

import { revalidatePath } from "next/cache";
import { requireQmd, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPlanByCapaId } from "@/lib/capa";
import {
  MONTH_NAMES,
  WORKFLOW_STEPS,
  buildDefaultSets,
  pad,
  planStatus,
  todayStr,
  validateWorkflowStep,
} from "@/lib/capa-logic";
import type { CapaPlan, Verification } from "@/lib/capa-types";

export type MutationResult = {
  error?: string;
  conflict?: boolean;
  ok?: boolean;
  /** New capa_plans.updated_at after a successful write (for optimistic concurrency). */
  updatedAt?: string;
};

/* --------------------------------------------------------------- months --- */

export async function createMonthAction(
  localeId: string,
  year: number,
  monthNum: number,
): Promise<{ error?: string; year?: number; monthNum?: number }> {
  const user = await requireUser();
  if (user.role !== "QMD" && user.localeId !== localeId) {
    return { error: "You can only manage your own branch." };
  }
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    !Number.isInteger(monthNum) ||
    monthNum < 1 ||
    monthNum > 12
  ) {
    return { error: "Invalid month or year." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("months").insert({
    locale_id: localeId,
    year,
    month_num: monthNum,
    label: `${MONTH_NAMES[monthNum - 1]} ${year}`,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: `${MONTH_NAMES[monthNum - 1]} ${year} already exists for ${localeId}.` };
    }
    return { error: error.message };
  }
  revalidatePath(`/locale/${localeId}`);
  return { year, monthNum };
}

/* ---------------------------------------------------------------- plans --- */

export async function createCapaPlanAction(
  localeId: string,
  monthId: string,
  department: string,
  form: { dateCreated: string; source: string; preparedBy: string },
): Promise<{ error?: string; capaId?: string }> {
  const user = await requireUser();
  if (user.role !== "QMD" && user.localeId !== localeId) {
    return { error: "You can only manage your own branch." };
  }
  if (!form.preparedBy.trim()) return { error: "Prepared By is required." };

  const supabase = await createClient();
  const { data: month, error: monthErr } = await supabase
    .from("months")
    .select("year, month_num")
    .eq("id", monthId)
    .eq("locale_id", localeId)
    .maybeSingle();
  if (monthErr) return { error: monthErr.message };
  if (!month) return { error: "Month not found." };

  const { count, error: countErr } = await supabase
    .from("capa_plans")
    .select("id", { count: "exact", head: true })
    .eq("locale_id", localeId)
    .eq("year", month.year)
    .eq("month_num", month.month_num);
  if (countErr) return { error: countErr.message };

  const capaId = `CAPA-${localeId}-${month.year}-${pad(month.month_num)}-${pad(
    (count ?? 0) + 1,
    3,
  )}`;

  const { data: planRow, error: planErr } = await supabase
    .from("capa_plans")
    .insert({
      capa_id: capaId,
      locale_id: localeId,
      month_id: monthId,
      year: month.year,
      month_num: month.month_num,
      department,
      date_created: form.dateCreated || todayStr(),
      source: form.source,
      prepared_by: form.preparedBy.trim(),
      stage: "draft",
      submitted_date: "",
      archived: false,
      verification: {
        date: "",
        verifiedBy: "",
        evidence: "",
        result: "",
        remarks: "",
      },
    })
    .select("id")
    .single();
  if (planErr) return { error: planErr.message };

  const [defaultSet] = buildDefaultSets(capaId, 1);
  const { error: setErr } = await supabase.from("capa_sets").insert({
    plan_id: planRow.id,
    set_number: defaultSet.setNumber,
    set_code: defaultSet.setCode,
    archived: false,
    issue: "",
    six_m: defaultSet.sixM,
    vital_causes: [],
    five_whys: defaultSet.fiveWhys,
  });
  if (setErr) return { error: setErr.message };

  revalidatePath(`/locale/${localeId}`);
  return { capaId };
}

const DELETABLE_STATUSES = new Set(["Open", "In Progress"]);

export async function deleteCapaPlanAction(
  capaId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const plan = await getPlanByCapaId(capaId);
  if (!plan) return { error: "Plan not found." };

  const status = planStatus(plan);
  const supabase = await createClient(); // RLS: QMD may delete any row.

  if (user.role === "QMD") {
    // QMD can delete any CAPA at any stage.
    const { error } = await supabase
      .from("capa_plans")
      .delete()
      .eq("id", plan.id);
    if (error) return { error: error.message };
  } else {
    // Branch users: only their own, only Open / In Progress drafts.
    if (plan.localeId !== user.localeId) {
      return { error: "You can only manage your own branch." };
    }
    if (!DELETABLE_STATUSES.has(status)) {
      return {
        error: `Only Open or In Progress CAPAs can be deleted (this one is "${status}").`,
      };
    }
    const { error } = await supabase
      .from("capa_plans")
      .delete()
      .eq("id", plan.id)
      .eq("stage", "draft");
    if (error) return { error: error.message };
  }

  // capa_sets / action_items cascade on the FK.
  revalidatePath(`/locale/${plan.localeId}`);
  revalidatePath(`/locale/${plan.localeId}/${plan.year}/${plan.monthNum}`);
  revalidatePath("/qmd");
  return { ok: true };
}

/* ----------------------------------------------------- save / submit plan --- */

async function writePlanGraph(
  draft: CapaPlan,
  expectedUpdatedAt: string,
  opts: { submit?: boolean },
): Promise<MutationResult> {
  const user = await requireUser();
  if (user.role === "QMD") {
    return { error: "QMD cannot edit CAPA content; use the verification stage." };
  }

  if (opts.submit) {
    for (const step of WORKFLOW_STEPS) {
      const problem = validateWorkflowStep(step, draft);
      if (problem) return { error: problem };
    }
  }

  const supabase = await createClient();
  const { data: cur, error: curErr } = await supabase
    .from("capa_plans")
    .select("id, stage, locale_id, updated_at")
    .eq("id", draft.id)
    .maybeSingle();
  if (curErr) return { error: curErr.message };
  if (!cur) return { error: "Plan not found." };
  if (cur.locale_id !== user.localeId) return { error: "Not your branch." };
  if (cur.stage !== "draft" && cur.stage !== "reopened") {
    return { error: "This plan is locked pending QMD review." };
  }
  // Optimistic-concurrency pre-check — bail out BEFORE any write so a genuine
  // conflict never destroys the child rows, and (crucially) a failure in the
  // child writes below can't advance capa_plans.updated_at and strand the
  // client with a stale token (which surfaced as spurious "someone else saved
  // this CAPA" errors).
  if (cur.updated_at !== expectedUpdatedAt) return { conflict: true };

  const { error: delErr } = await supabase
    .from("capa_sets")
    .delete()
    .eq("plan_id", draft.id);
  if (delErr) return { error: delErr.message };

  for (const s of draft.sets) {
    const { data: setRow, error: setErr } = await supabase
      .from("capa_sets")
      .insert({
        plan_id: draft.id,
        set_number: s.setNumber,
        set_code: s.setCode,
        archived: s.archived,
        issue: s.issue,
        six_m: s.sixM,
        vital_causes: s.vitalCauses,
        five_whys: s.fiveWhys,
      })
      .select("id")
      .single();
    if (setErr) return { error: setErr.message };

    if (s.actionItems.length) {
      const baseRows = s.actionItems.map((a, i) => ({
        set_id: setRow.id,
        corrective_action: a.correctiveAction,
        preventive_action: a.preventiveAction,
        responsible_person: a.responsiblePerson,
        target_date: a.targetDate,
        status: a.status,
        date_completed: a.dateCompleted,
        verification: a.verification,
        remarks: a.remarks,
        order_index: i,
      }));
      const rows = baseRows.map((r, i) => ({
        ...r,
        started_date: s.actionItems[i].startedDate ?? "",
      }));
      const aiErr = (await supabase.from("action_items").insert(rows)).error;
      // Started Date is a required field, so it must persist. If the column is
      // missing (42703 = undefined column; PGRST204 = not in the PostgREST
      // schema cache) the pending migration hasn't been applied.
      if (aiErr?.code === "42703" || aiErr?.code === "PGRST204") {
        return {
          error:
            "Database is missing the action_items.started_date column. Apply the pending migration (supabase db push) and try again.",
        };
      }
      if (aiErr) return { error: aiErr.message };
    }
  }

  // The capa_plans row is written LAST — after the child rows are safely in —
  // still guarded on updated_at to catch a save that landed while we worked.
  const { data: updated, error: updErr } = await supabase
    .from("capa_plans")
    .update({
      department: draft.department,
      date_created: draft.dateCreated,
      source: draft.source,
      prepared_by: draft.preparedBy,
      ...(opts.submit
        ? { stage: "submitted", submitted_date: todayStr() }
        : {}),
    })
    .eq("id", draft.id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id, updated_at")
    .maybeSingle();
  if (updErr) return { error: updErr.message };
  if (!updated) return { conflict: true };

  // Only revalidate the editor route on submit — a plain draft save keeps the
  // client draft as source of truth and must NOT trigger a server re-render /
  // remount mid-wizard.
  revalidatePath(`/locale/${draft.localeId}`);
  if (opts.submit) {
    revalidatePath(`/capa/${draft.capaId}`);
    revalidatePath(`/capa/${draft.capaId}/report`);
    revalidatePath("/qmd");
  }
  return { ok: true, updatedAt: updated.updated_at as string };
}

export async function commitPlanAction(
  draft: CapaPlan,
  expectedUpdatedAt: string,
): Promise<MutationResult> {
  return writePlanGraph(draft, expectedUpdatedAt, {});
}

export async function submitPlanAction(
  draft: CapaPlan,
  expectedUpdatedAt: string,
): Promise<MutationResult> {
  return writePlanGraph(draft, expectedUpdatedAt, { submit: true });
}

/* ------------------------------------------------------- QMD verification --- */

const RESULT_TO_STAGE: Record<string, CapaPlan["stage"]> = {
  Effective: "closed",
  "Partially Effective": "monitoring",
  "Not Effective": "reopened",
};

export async function submitVerificationAction(
  capaId: string,
  verification: Verification,
  expectedUpdatedAt: string,
): Promise<MutationResult> {
  await requireQmd();
  const stage = RESULT_TO_STAGE[verification.result];
  if (!stage) return { error: "Select a verification result." };
  if (!verification.verifiedBy.trim()) return { error: "Enter 'Verified By'." };

  const supabase = await createClient();
  const plan = await getPlanByCapaId(capaId);
  if (!plan) return { error: "Plan not found." };

  const { data: updated, error } = await supabase
    .from("capa_plans")
    .update({
      verification: {
        ...verification,
        date: verification.date || todayStr(),
      },
      stage,
    })
    .eq("id", plan.id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { conflict: true };

  revalidatePath(`/capa/${capaId}`);
  revalidatePath("/qmd");
  revalidatePath(`/locale/${plan.localeId}`);
  return { ok: true };
}
