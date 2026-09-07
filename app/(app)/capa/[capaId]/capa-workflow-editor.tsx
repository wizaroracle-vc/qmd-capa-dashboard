"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FileText,
  Lock,
  RefreshCcw,
  Send,
} from "lucide-react";
import { Btn, Card, ConfirmDialog } from "@/components/ui";
import { HeaderTitle } from "@/components/header-title";
import { StageNav, type Stage, type StepState } from "@/components/workflow/stage-nav";
import { SetTabs } from "@/components/workflow/set-tabs";
import { IssueAnd6MStage } from "@/components/workflow/issue-6m-stage";
import { FishboneStage } from "@/components/workflow/fishbone-stage";
import { FiveWhysStage } from "@/components/workflow/five-whys-stage";
import { ActionPlanStage } from "@/components/workflow/action-plan-stage";
import { QmdVerificationStage } from "@/components/workflow/qmd-verification-stage";
import { SummaryStage } from "@/components/workflow/summary-stage";
import {
  STAGES_LOCALE,
  WORKFLOW_STEPS,
  activeSets,
  firstIncompleteSet,
  firstIncompleteSetStep,
  firstIncompleteWorkflowStep,
  makeSet,
  renumberSets,
  validateSetStep,
} from "@/lib/capa-logic";
import {
  commitPlanAction,
  submitPlanAction,
  submitVerificationAction,
} from "@/lib/capa-actions";
import type { CapaPlan, CapaSet, Verification } from "@/lib/capa-types";

const SUMMARY_STAGE: Stage = { key: "summary", label: "Summary", num: "05" };
const STEP_KEYS = [...WORKFLOW_STEPS, "summary"];

export function CapaWorkflowEditor({
  plan,
  role,
  monthLabel,
  initialStage,
}: {
  plan: CapaPlan;
  role: "LOCALE" | "QMD";
  monthLabel: string;
  initialStage?: string;
}) {
  const router = useRouter();
  const isQmd = role === "QMD";

  const stages = useMemo<Stage[]>(
    () => [...STAGES_LOCALE, SUMMARY_STAGE],
    [],
  );

  const normalizedInitial =
    initialStage === "verify" ? "summary" : initialStage;
  const lockedView =
    isQmd || (plan.stage !== "draft" && plan.stage !== "reopened");
  const initialStageKey =
    normalizedInitial && STEP_KEYS.includes(normalizedInitial)
      ? normalizedInitial
      : lockedView
        ? "summary"
        : "issue6m";
  const defaultStage = lockedView ? "summary" : "issue6m";

  const [draft, setDraft] = useState<CapaPlan>(plan);
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [pending, start] = useTransition();

  const editable =
    !isQmd && (draft.stage === "draft" || draft.stage === "reopened");
  const readOnly = !editable;

  const sets = activeSets(draft);
  const [activeSetId, setActiveSetId] = useState<string | undefined>(sets[0]?.id);
  const [confirmDeleteSet, setConfirmDeleteSet] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<null | (() => void)>(null);

  const activeSet =
    sets.find((s) => s.id === activeSetId) || sets[0] || draft.sets[0];

  // Step position + visited high-water mark, tracked PER SET.
  const [stagesBySet, setStagesBySet] = useState<Record<string, string>>(() =>
    sets[0] ? { [sets[0].id]: initialStageKey } : {},
  );
  const [maxVisitedBySet, setMaxVisitedBySet] = useState<
    Record<string, number>
  >({});

  const activeId = activeSet?.id ?? "";
  const setFirstIncomplete = activeSet ? firstIncompleteSetStep(activeSet) : 0;
  const wholeFirstIncomplete = firstIncompleteWorkflowStep(draft);

  const stage = stagesBySet[activeId] ?? defaultStage;
  const currentIdx = STEP_KEYS.indexOf(stage);
  const isEditStep = currentIdx >= 0 && currentIdx <= 3;

  // how far the user has opened for THIS set — defaults to what's already complete
  const visited =
    maxVisitedBySet[activeId] ??
    (lockedView
      ? STEP_KEYS.length - 1
      : Math.max(currentIdx, setFirstIncomplete));

  // Steps 01-04 unlock per set; Summary (05) only when the WHOLE CAPA is complete.
  const perSetMax = Math.max(currentIdx, setFirstIncomplete);
  const maxNavIdx = readOnly
    ? STEP_KEYS.length - 1
    : wholeFirstIncomplete === WORKFLOW_STEPS.length
      ? Math.max(perSetMax, 4)
      : Math.min(perSetMax, 3);

  const stepStateOf = (key: string): StepState => {
    const idx = STEP_KEYS.indexOf(key);
    if (readOnly) return idx === currentIdx ? "current" : "available";
    const passes =
      idx < WORKFLOW_STEPS.length
        ? idx < setFirstIncomplete
        : wholeFirstIncomplete === WORKFLOW_STEPS.length;
    if (passes && idx <= visited) return "done";
    if (idx === currentIdx) return "current";
    if (idx > maxNavIdx) return "locked";
    return "available";
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);


  const touch = () => {
    setDirty(true);
    setJustSaved(false);
    setConflict(false);
  };

  const updateSet = (nextSet: CapaSet) => {
    setDraft((d) => ({
      ...d,
      sets: d.sets.map((s) => (s.id === nextSet.id ? nextSet : s)),
    }));
    touch();
  };

  const syncUrl = (s: string) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("stage", s);
    window.history.replaceState(null, "", url.toString());
  };

  /** Move the ACTIVE set to a step: position, per-set high-water mark, URL. */
  const navTo = (key: string, setId = activeId) => {
    const idx = STEP_KEYS.indexOf(key);
    setStagesBySet((m) => ({ ...m, [setId]: key }));
    setMaxVisitedBySet((m) => ({
      ...m,
      [setId]: Math.max(
        m[setId] ?? Math.max(currentIdx, setFirstIncomplete),
        idx,
      ),
    }));
    syncUrl(key);
  };

  /** Switch which set is active — the stepper follows that set's own position. */
  const selectSet = (id: string) => {
    setErrorMsg("");
    setActiveSetId(id);
    syncUrl(stagesBySet[id] ?? defaultStage);
  };

  const addSet = () => {
    const next = makeSet(draft.sets.length + 1, draft.capaId);
    setDraft((d) => ({
      ...d,
      sets: renumberSets([...d.sets, next], d.capaId),
    }));
    setActiveSetId(next.id);
    // a brand-new set always starts at step 1
    setStagesBySet((m) => ({ ...m, [next.id]: "issue6m" }));
    setMaxVisitedBySet((m) => ({ ...m, [next.id]: 0 }));
    syncUrl("issue6m");
    touch();
  };

  const deleteSet = (setId: string) => {
    const remaining = renumberSets(
      draft.sets.filter((s) => s.id !== setId),
      draft.capaId,
    );
    setDraft((d) => ({ ...d, sets: remaining }));
    setStagesBySet((m) => {
      const n = { ...m };
      delete n[setId];
      return n;
    });
    setMaxVisitedBySet((m) => {
      const n = { ...m };
      delete n[setId];
      return n;
    });
    if (activeSetId === setId) setActiveSetId(remaining[0]?.id);
    setConfirmDeleteSet(null);
    touch();
  };

  /** Jump to the first set/step that still has a gap, and explain why. */
  const jumpToGap = (): boolean => {
    const gap = firstIncompleteSet(draft);
    if (!gap) return false;
    const key = STEP_KEYS[gap.stepIndex];
    setActiveSetId(gap.set.id);
    setStagesBySet((m) => ({ ...m, [gap.set.id]: key }));
    syncUrl(key);
    setErrorMsg(
      `Set ${gap.set.setNumber}: ${validateSetStep(
        WORKFLOW_STEPS[gap.stepIndex],
        gap.set,
      )} — every CAPA set must be complete before submitting.`,
    );
    return true;
  };

  /** Persist the current draft (lenient — a draft may be incomplete). */
  const persist = async (): Promise<boolean> => {
    const res = await commitPlanAction(draft, draft.updatedAt ?? "");
    if (res.conflict) {
      setConflict(true);
      return false;
    }
    if (res.error) {
      setErrorMsg(res.error);
      return false;
    }
    setDraft((d) => ({ ...d, updatedAt: res.updatedAt ?? d.updatedAt }));
    setDirty(false);
    return true;
  };

  /** Header navigation — refuses locked steps; auto-saves pending edits. */
  const goToStage = (target: string) => {
    if (target === stage) return;
    if (STEP_KEYS.indexOf(target) > maxNavIdx) return; // locked
    setErrorMsg("");
    if (readOnly || !dirty) {
      navTo(target);
      return;
    }
    start(async () => {
      if (!(await persist())) return;
      setJustSaved(true);
      navTo(target);
      setTimeout(() => setJustSaved(false), 2000);
    });
  };

  /** "Next" — validate THIS set's step, save, advance. */
  const handleNext = () => {
    setErrorMsg("");
    if (!activeSet) return;
    const step = WORKFLOW_STEPS[currentIdx];
    const problem = validateSetStep(step, activeSet);
    if (problem) {
      setErrorMsg(`Set ${activeSet.setNumber}: ${problem}`);
      return;
    }
    // Advancing into the Summary means every OTHER set must be complete too.
    if (STEP_KEYS[currentIdx + 1] === "summary" && jumpToGap()) return;
    start(async () => {
      if (!(await persist())) return;
      setJustSaved(true);
      navTo(STEP_KEYS[currentIdx + 1]);
      setTimeout(() => setJustSaved(false), 2000);
    });
  };

  const leaveEditor = (fn: () => void) => {
    if (readOnly || !dirty) {
      fn();
      return;
    }
    setPendingLeave(() => fn);
  };

  const runSubmit = () => {
    setErrorMsg("");
    if (jumpToGap()) {
      setConfirmSubmit(false);
      return;
    }
    start(async () => {
      const res = await submitPlanAction(draft, draft.updatedAt ?? "");
      setConfirmSubmit(false);
      if (res.conflict) {
        setConflict(true);
        return;
      }
      if (res.error) {
        setErrorMsg(res.error);
        return;
      }
      setDraft((d) => ({
        ...d,
        stage: "submitted",
        submittedDate: new Date().toISOString().slice(0, 10),
        updatedAt: res.updatedAt ?? d.updatedAt,
      }));
      setDirty(false);
      setJustSaved(true);
      navTo("summary");
      setTimeout(() => setJustSaved(false), 2500);
    });
  };

  const runVerification = (v: Verification) => {
    setErrorMsg("");
    start(async () => {
      const res = await submitVerificationAction(
        draft.capaId,
        v,
        draft.updatedAt ?? "",
      );
      if (res.conflict) {
        setConflict(true);
        return;
      }
      if (res.error) {
        setErrorMsg(res.error);
        return;
      }
      router.refresh();
    });
  };

  const goBack = () =>
    router.push(
      isQmd ? "/qmd" : `/locale/${plan.localeId}/${plan.year}/${plan.monthNum}`,
    );

  if (!activeSet) {
    return (
      <div style={{ maxWidth: 900, margin: "60px auto", textAlign: "center" }}>
        <div style={{ color: "var(--ink-muted)" }}>No CAPA Sets found.</div>
        <Btn variant="outline" onClick={goBack} style={{ marginTop: 12 }}>
          Dashboard
        </Btn>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 24px 60px" }}>
      <HeaderTitle
        tag={draft.capaId}
        meta={`${draft.localeId} · ${draft.department}${
          draft.source ? ` · ${draft.source}` : ""
        }`}
        mono
      />

      {/* Back + 5-step progress on one row */}
      <div
        className="no-print"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ width: 128, flexShrink: 0 }}>
          <button
            onClick={() => leaveEditor(goBack)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--navy)",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={15} /> Dashboard
          </button>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StageNav
            stages={stages}
            activeStage={stage}
            onSelect={goToStage}
            stepStateOf={stepStateOf}
          />
        </div>
        <div style={{ width: 128, flexShrink: 0 }} aria-hidden />
      </div>

      <div
        className="no-print"
        style={{ borderBottom: "1px solid var(--border)", margin: "2px 0 20px" }}
      />

      {(readOnly || isQmd) && (
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-faint)",
            margin: "0 0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <Lock size={12} />
          {isQmd
            ? "Content read-only (QMD view)"
            : "Locked — awaiting/complete QMD review"}
        </div>
      )}

      {conflict && (
        <Card
          style={{
            padding: 14,
            marginBottom: 14,
            background: "var(--red-soft)",
            border: "1px solid var(--red)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "var(--red)",
              fontWeight: 600,
            }}
          >
            <AlertCircle size={16} /> Someone else saved this CAPA since you opened
            it. Reload to get the latest, then re-apply your changes.
            <Btn size="sm" variant="danger" onClick={() => router.refresh()}>
              <RefreshCcw size={13} /> Reload
            </Btn>
          </div>
        </Card>
      )}
      {errorMsg && (
        <Card
          style={{
            padding: 12,
            marginBottom: 14,
            background: "var(--red-soft)",
            border: "1px solid var(--red)",
          }}
        >
          <div style={{ fontSize: 13, color: "var(--red)" }}>{errorMsg}</div>
        </Card>
      )}

      {isEditStep && (
        <div className="no-print" style={{ marginBottom: 18 }}>
          <SetTabs
            sets={sets}
            activeSetId={activeSet.id}
            onSelect={selectSet}
            onAdd={addSet}
            onDelete={(id) => setConfirmDeleteSet(id)}
            readOnly={readOnly}
          />
        </div>
      )}

      {stage === "issue6m" && (
        <IssueAnd6MStage set={activeSet} onUpdateSet={updateSet} readOnly={readOnly} />
      )}
      {stage === "fishbone" && <FishboneStage set={activeSet} />}
      {stage === "fivewhys" && (
        <FiveWhysStage set={activeSet} onUpdateSet={updateSet} readOnly={readOnly} />
      )}
      {stage === "action" && (
        <ActionPlanStage set={activeSet} onUpdateSet={updateSet} readOnly={readOnly} />
      )}
      {stage === "summary" && (
        <>
          <div
            className="no-print"
            style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}
          >
            <Btn
              variant="outline"
              onClick={() =>
                leaveEditor(() => router.push(`/capa/${draft.capaId}/report`))
              }
            >
              <FileText size={15} /> View CAPA Report
            </Btn>
          </div>
          <SummaryStage plan={draft} monthLabel={monthLabel} />
          {isQmd && (
            <div style={{ marginTop: 20 }}>
              <QmdVerificationStage
                plan={draft}
                onSubmit={runVerification}
                busy={pending}
              />
            </div>
          )}
        </>
      )}

      {editable && isEditStep && (
        <Card
          style={{
            padding: 18,
            marginTop: 18,
            background: "var(--surface-alt)",
            borderStyle: "dashed",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {currentIdx > 0 && (
              <Btn
                variant="outline"
                size="sm"
                onClick={() => goToStage(STEP_KEYS[currentIdx - 1])}
                disabled={pending}
              >
                <ChevronLeft size={15} /> Back: {stages[currentIdx - 1].label}
              </Btn>
            )}
            <div
              style={{
                flex: 1,
                minWidth: 200,
                fontSize: 12.5,
                color: "var(--ink-muted)",
              }}
            >
              {justSaved ? (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "var(--green)",
                    fontWeight: 600,
                  }}
                >
                  <CircleCheck size={14} /> Progress saved.
                </span>
              ) : (
                <span>
                  Clicking <strong>&ldquo;Next&rdquo;</strong> will automatically
                  save your progress and move to the next section.
                </span>
              )}
            </div>
            <Btn variant="primary" onClick={handleNext} disabled={pending}>
              {pending
                ? "Saving…"
                : `Next: ${stages[currentIdx + 1]?.label ?? "Summary"}`}
              <ChevronRight size={15} />
            </Btn>
          </div>
        </Card>
      )}

      {editable && stage === "summary" && (
        <Card
          style={{
            padding: 18,
            marginTop: 18,
            background: "var(--surface-alt)",
            borderStyle: "dashed",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <Btn
              variant="outline"
              size="sm"
              onClick={() => goToStage("action")}
              disabled={pending}
            >
              <ChevronLeft size={15} /> Back: Action Plan
            </Btn>
            <div
              style={{
                flex: 1,
                minWidth: 200,
                fontSize: 12.5,
                color: "var(--ink-muted)",
              }}
            >
              Submitting locks this CAPA from further editing until QMD completes
              its verification review. All CAPA sets must be complete.
            </div>
            <Btn
              variant="steel"
              onClick={() => {
                setErrorMsg("");
                if (!jumpToGap()) setConfirmSubmit(true);
              }}
              disabled={pending}
            >
              <Send size={15} /> Submit for QMD Verification
            </Btn>
          </div>
        </Card>
      )}

      {confirmDeleteSet && (
        <ConfirmDialog
          title={`Delete CAPA Set ${
            draft.sets.find((s) => s.id === confirmDeleteSet)?.setNumber
          }?`}
          message="This removes the set and all of its Issue / 6M, Fishbone, 5 Whys and Action Plan data. The remaining sets are re-numbered. Saved on your next Next / navigation."
          onCancel={() => setConfirmDeleteSet(null)}
          onConfirm={() => deleteSet(confirmDeleteSet)}
        />
      )}
      {confirmSubmit && (
        <ConfirmDialog
          title="Submit for QMD Verification?"
          message="This saves all current information and locks the CAPA Plan from further editing until QMD completes its verification review."
          confirmLabel="Submit"
          danger={false}
          busy={pending}
          onCancel={() => setConfirmSubmit(false)}
          onConfirm={runSubmit}
        />
      )}
      {pendingLeave && (
        <ConfirmDialog
          title="Save before leaving?"
          message="You have unsaved edits on this step. Save them now and continue?"
          confirmLabel="Save & Leave"
          cancelLabel="Stay"
          danger={false}
          busy={pending}
          onCancel={() => setPendingLeave(null)}
          onConfirm={() => {
            const fn = pendingLeave;
            setPendingLeave(null);
            start(async () => {
              if (await persist()) fn();
            });
          }}
        />
      )}
    </div>
  );
}
