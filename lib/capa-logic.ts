/* ---------------------------------------------------------------------------
   Pure CAPA domain logic — ported verbatim from the original app.js
   (see _legacy/app.js lines ~43-159). No React, no persistence: safe to import
   from both server components and client components.
--------------------------------------------------------------------------- */
import type {
  ActionItem,
  CapaPlan,
  CapaSet,
  Category,
  SixM,
} from "./capa-types";

export const LOCALES: { id: string; name: string }[] = [
  { id: "VCHI", name: "VCHI" },
  { id: "VCPA", name: "VCPA" },
  { id: "VCNE", name: "VCNE" },
  { id: "VCLP", name: "VCLP" },
  { id: "VCMA", name: "VCMA" },
  { id: "VCSF", name: "VCSF" },
  { id: "KHBA", name: "KHBA" },
  { id: "KHPA", name: "KHPA" },
];

export const DEPARTMENTS = ["Service", "Rooms", "LMT", "FHI"];

export const CATEGORIES: Category[] = [
  "MAN",
  "MACHINE",
  "METHOD",
  "MEASUREMENT",
  "MATERIALS",
  "MOTHER_NATURE",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  MAN: "MAN",
  MACHINE: "MACHINE",
  METHOD: "METHOD",
  MEASUREMENT: "MEASUREMENT",
  MATERIALS: "MATERIALS",
  MOTHER_NATURE: "MOTHER NATURE (ENVIRONMENT)",
};

export const MAX_CAUSES_PER_CATEGORY = 10;

export const STAGES_LOCALE = [
  { key: "issue6m", label: "Issue & 6M", num: "01" },
  { key: "fishbone", label: "Fishbone", num: "02" },
  { key: "fivewhys", label: "5 Whys", num: "03" },
  { key: "action", label: "Action Plan", num: "04" },
];

export const STAGE_QMD_VERIFY = {
  key: "verify",
  label: "QMD Verification",
  num: "05",
};

export const ACTION_STATUSES = [
  "Not Started",
  "In Progress",
  "Completed",
  "For Verification",
  "Closed",
];

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* ---------------------------------- utils --------------------------------- */
let uidCounter = 1;
export function uid(prefix = "id"): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}-${Math.floor(
    Math.random() * 9999,
  )}`;
}

export function pad(n: number | string, len = 2): string {
  return String(n).padStart(len, "0");
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(d?: string): string {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export function isPastDate(d?: string): boolean {
  if (!d) return false;
  return (
    new Date(d + "T00:00:00").getTime() <
    new Date(todayStr() + "T00:00:00").getTime()
  );
}

export function emptySixM(): SixM {
  const o = {} as SixM;
  CATEGORIES.forEach((c) => (o[c] = []));
  return o;
}

export function makeSet(
  setNumber: number,
  capaId: string,
  overrides: Partial<CapaSet> = {},
): CapaSet {
  return {
    id: uid("set"),
    setNumber,
    setCode: `${capaId}-SET-${pad(setNumber)}`,
    archived: false,
    issue: "",
    sixM: emptySixM(),
    vitalCauses: [],
    fiveWhys: { why1: "", why2: "", why3: "", why4: "", why5: "", rootCause: "" },
    actionItems: [],
    ...overrides,
  };
}

export function buildDefaultSets(capaId: string, count = 1): CapaSet[] {
  const sets: CapaSet[] = [];
  for (let i = 1; i <= count; i++) sets.push(makeSet(i, capaId));
  return sets;
}

/** Re-sequence set numbers / codes 1..N after an add or delete. */
export function renumberSets(sets: CapaSet[], capaId: string): CapaSet[] {
  return sets.map((s, i) => ({
    ...s,
    setNumber: i + 1,
    setCode: `${capaId}-SET-${pad(i + 1)}`,
  }));
}

export function activeSets(plan: CapaPlan): CapaSet[] {
  return (plan.sets || []).filter((s) => !s.archived);
}

/** Sequence is unique per Locale + Year + Month, across all departments. */
export function nextCapaId(
  plans: CapaPlan[],
  localeId: string,
  year: number,
  monthNum: number,
): string {
  const count = plans.filter(
    (p) => p.localeId === localeId && p.year === year && p.monthNum === monthNum,
  ).length;
  return `CAPA-${localeId}-${year}-${pad(monthNum)}-${pad(count + 1, 3)}`;
}

export function setReadiness(s: CapaSet): number {
  let n = 0;
  if (s.issue && s.issue.trim()) n++;
  if (CATEGORIES.some((c) => s.sixM[c].length > 0)) n++;
  if (s.vitalCauses.length > 0) n++;
  if (s.fiveWhys.rootCause && s.fiveWhys.rootCause.trim()) n++;
  if (s.actionItems.length > 0) n++;
  return n / 5;
}

export function planProgressPct(plan: CapaPlan): number {
  if (plan.stage === "closed") return 100;
  const sets = activeSets(plan);
  if (sets.length === 0) return 0;
  const avg = sets.reduce((a, s) => a + setReadiness(s), 0) / sets.length;
  return Math.round(avg * 100);
}

/** stage -> display label. "closed" stage represents an Effective (closed) verification result. */
export const STAGE_LABEL: Record<string, string> = {
  submitted: "For QMD Verification",
  closed: "Effective",
  monitoring: "Partially Effective",
  reopened: "Not Effective",
};

export function planStatus(plan: CapaPlan): string {
  if (plan.stage !== "draft") return STAGE_LABEL[plan.stage] || "Open";
  const sets = activeSets(plan);
  if (sets.length === 0) return "Open";
  const anyOverdue = sets.some((s) =>
    s.actionItems.some(
      (a: ActionItem) =>
        a.targetDate &&
        isPastDate(a.targetDate) &&
        !["Completed", "Closed"].includes(a.status),
    ),
  );
  if (anyOverdue) return "Overdue";
  const anyProgress = sets.some((s) => setReadiness(s) > 0);
  return anyProgress ? "In Progress" : "Open";
}

/* --------------------------- workflow step gating -------------------------- */

export const WORKFLOW_STEPS = [
  "issue6m",
  "fishbone",
  "fivewhys",
  "action",
] as const;
export type WorkflowStepKey = (typeof WORKFLOW_STEPS)[number];

/** Empty required fields on an action item (everything except Remarks). */
export function missingActionItemFields(a: ActionItem): string[] {
  const missing: string[] = [];
  if (!a.correctiveAction.trim()) missing.push("corrective action");
  if (!a.preventiveAction.trim()) missing.push("preventive action");
  if (!a.responsiblePerson.trim()) missing.push("responsible person");
  if (!a.startedDate) missing.push("started date");
  if (!a.targetDate) missing.push("expected completion date");
  if (!a.verification.trim()) missing.push("verification");
  return missing;
}

/**
 * Validates one workflow step for a SINGLE set.
 * Returns `null` when it passes, otherwise a short human-readable reason
 * (without a "Set N:" prefix).
 */
export function validateSetStep(
  step: WorkflowStepKey,
  s: CapaSet,
): string | null {
  switch (step) {
    case "issue6m":
      if (!s.issue.trim()) return "Issue / Finding is required.";
      if (s.vitalCauses.length < 1)
        return "select at least 1 vital cause (Affinitize).";
      return null;
    case "fishbone":
      return null; // review-only — auto-populated from the 6M analysis
    case "fivewhys":
      if (!s.fiveWhys.rootCause.trim())
        return "enter the Root Cause on 5 Whys.";
      return null;
    case "action":
      // Optional — but any item that was added must be fully filled in
      // (everything except Remarks).
      for (let i = 0; i < s.actionItems.length; i++) {
        const missing = missingActionItemFields(s.actionItems[i]);
        if (missing.length) {
          return `action item #${i + 1} needs ${missing.join(", ")} — or remove it.`;
        }
      }
      return null;
  }
}

/** First step index (0-3) that fails for this set, or WORKFLOW_STEPS.length. */
export function firstIncompleteSetStep(s: CapaSet): number {
  for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
    if (validateSetStep(WORKFLOW_STEPS[i], s)) return i;
  }
  return WORKFLOW_STEPS.length;
}

/**
 * Validates one workflow step across every active set (whole-CAPA gate).
 * Returns `null` when the step passes, otherwise a human-readable reason.
 */
export function validateWorkflowStep(
  step: WorkflowStepKey,
  plan: CapaPlan,
): string | null {
  const sets = activeSets(plan);
  if (sets.length === 0) return "Add at least one CAPA set.";
  for (const s of sets) {
    const problem = validateSetStep(step, s);
    if (problem) return `Set ${s.setNumber}: ${problem}`;
  }
  return null;
}

/** Index of the first step that fails for ANY set, or WORKFLOW_STEPS.length (Summary reachable). */
export function firstIncompleteWorkflowStep(plan: CapaPlan): number {
  for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
    if (validateWorkflowStep(WORKFLOW_STEPS[i], plan)) return i;
  }
  return WORKFLOW_STEPS.length;
}

/** The first set that has an incomplete step, with the step index. */
export function firstIncompleteSet(
  plan: CapaPlan,
): { set: CapaSet; stepIndex: number } | null {
  for (const s of activeSets(plan)) {
    const i = firstIncompleteSetStep(s);
    if (i < WORKFLOW_STEPS.length) return { set: s, stepIndex: i };
  }
  return null;
}

export function planRepresentativeIssue(plan: CapaPlan): string {
  const sets = activeSets(plan);
  const first = sets.find((s) => s.issue && s.issue.trim());
  if (first) return first.issue;
  return sets.length > 0
    ? `${sets.length} finding(s) — issue not yet entered`
    : "No findings entered";
}

/** Dashboard sort priority — In Progress & For QMD Verification first, then the rest. */
export const STATUS_PRIORITY: Record<string, number> = {
  "In Progress": 0,
  "For QMD Verification": 1,
  Overdue: 2,
  Open: 3,
  "Not Effective": 4,
  "Partially Effective": 5,
  Effective: 6,
};

export function statusPriority(status: string): number {
  return STATUS_PRIORITY[status] ?? 9;
}

export function countByStatus(plans: CapaPlan[]): Record<string, number> {
  const c: Record<string, number> = {
    total: plans.length,
    Open: 0,
    "In Progress": 0,
    "For QMD Verification": 0,
    Overdue: 0,
    Effective: 0,
    "Partially Effective": 0,
    "Not Effective": 0,
  };
  plans.forEach((p) => {
    const s = planStatus(p);
    c[s] = (c[s] || 0) + 1;
  });
  return c;
}

export const EMPTY_VERIFICATION = {
  date: "",
  verifiedBy: "",
  evidence: "",
  result: "",
  remarks: "",
};
