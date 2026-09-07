"use client";

import { useState } from "react";
import { CircleCheck, Send } from "lucide-react";
import {
  Btn,
  Card,
  ConfirmDialog,
  FieldLabel,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import type { CapaPlan, Verification } from "@/lib/capa-types";

export function QmdVerificationStage({
  plan,
  onSubmit,
  busy,
}: {
  plan: CapaPlan;
  onSubmit: (v: Verification) => void;
  busy: boolean;
}) {
  const [v, setV] = useState<Verification>(plan.verification);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const locked = plan.stage === "closed";
  const canSubmit = !!v.result && v.verifiedBy.trim().length > 0;

  const setField = (k: keyof Verification, val: string) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const message =
    v.result === "Effective"
      ? "This will mark the CAPA Plan Effective and Closed. This reflects final QMD sign-off."
      : v.result === "Partially Effective"
        ? "This will mark the CAPA Plan Partially Effective and place it under monitoring / follow-up."
        : "This will mark the CAPA Plan Not Effective and reopen it, returning it to the branch for corrective action.";

  return (
    <Card style={{ padding: 20 }}>
      <div className="disp" style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
        Effectiveness Verification
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 16 }}>
        Review the complete CAPA Plan across all sets, then record the verification
        decision.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <FieldLabel>Verification Date</FieldLabel>
          <TextInput
            type="date"
            disabled={locked}
            value={v.date}
            onChange={(e) => setField("date", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Verified By</FieldLabel>
          <TextInput
            disabled={locked}
            value={v.verifiedBy}
            onChange={(e) => setField("verifiedBy", e.target.value)}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel hint="Paste a full URL (https://…) — it becomes a clickable link in the report.">
            Evidence / Reference
          </FieldLabel>
          <TextArea
            rows={2}
            disabled={locked}
            value={v.evidence}
            onChange={(e) => setField("evidence", e.target.value)}
            placeholder="Notes and/or a link to supporting evidence…"
          />
        </div>
        <div>
          <FieldLabel>Result</FieldLabel>
          <Select
            disabled={locked}
            value={v.result}
            onChange={(e) => setField("result", e.target.value)}
          >
            <option value="">— Select result —</option>
            <option>Effective</option>
            <option>Partially Effective</option>
            <option>Not Effective</option>
          </Select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel>Remarks</FieldLabel>
          <TextArea
            rows={2}
            disabled={locked}
            value={v.remarks}
            onChange={(e) => setField("remarks", e.target.value)}
          />
        </div>
      </div>

      {plan.verification.result && (
        <div style={{ marginTop: 14, fontSize: 13, color: "var(--ink-muted)" }}>
          Currently recorded result:{" "}
          <StatusBadge status={plan.verification.result} size="sm" />
        </div>
      )}

      {!locked ? (
        <>
          <Btn
            variant="primary"
            disabled={!canSubmit || busy}
            onClick={() => setConfirmOpen(true)}
            style={{ marginTop: 18 }}
          >
            <Send size={15} /> Submit Verification
          </Btn>
          {!canSubmit && (
            <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 6 }}>
              Select a Result and enter Verified By to submit.
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            marginTop: 16,
            background: "var(--green-soft)",
            border: "1px solid var(--green)",
            borderRadius: 8,
            padding: 14,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <CircleCheck size={20} color="var(--green)" />
          <div style={{ fontSize: 13.5 }}>
            This CAPA Plan has been marked Effective and is closed.
          </div>
        </div>
      )}

      {confirmOpen && (
        <ConfirmDialog
          title="Submit Verification?"
          message={message}
          confirmLabel="Submit Verification"
          cancelLabel="Cancel"
          danger={v.result === "Not Effective"}
          busy={busy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            onSubmit(v);
            setConfirmOpen(false);
          }}
        />
      )}
    </Card>
  );
}
