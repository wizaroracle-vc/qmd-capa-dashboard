"use client";

import type { CSSProperties } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { AutoTextArea, Btn, Card, FieldLabel, TextInput } from "@/components/ui";
import { missingActionItemFields, uid } from "@/lib/capa-logic";
import type { ActionItem, CapaSet } from "@/lib/capa-types";

function Req() {
  return (
    <span style={{ color: "var(--red)", marginLeft: 3 }} aria-hidden>
      *
    </span>
  );
}

function ActionItemCard({
  item,
  index,
  onUpdate,
  onRemove,
  readOnly,
}: {
  item: ActionItem;
  index: number;
  onUpdate: (patch: Partial<ActionItem>) => void;
  onRemove: () => void;
  readOnly: boolean;
}) {
  const missing = missingActionItemFields(item);
  const incomplete = missing.length > 0;

  // Always return a borderColor (never undefined) so React isn't toggling the
  // property on/off between renders.
  const invalid = (empty: boolean): CSSProperties => ({
    borderColor: empty && !readOnly ? "var(--gold)" : "var(--border)",
  });

  return (
    <Card
      style={{
        padding: 16,
        borderColor: incomplete && !readOnly ? "var(--gold)" : "var(--border)",
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div className="disp" style={{ fontWeight: 700, fontSize: 13.5 }}>
          Action Item #{index + 1}
        </div>
        {!readOnly && (
          <button
            onClick={onRemove}
            title="Remove action item"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--red)",
              display: "flex",
            }}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <FieldLabel>
            Corrective Action
            <Req />
          </FieldLabel>
          <AutoTextArea
            disabled={readOnly}
            value={item.correctiveAction}
            onChange={(e) => onUpdate({ correctiveAction: e.target.value })}
            placeholder="What was done to correct the immediate issue..."
            style={invalid(!item.correctiveAction.trim())}
          />
        </div>
        <div>
          <FieldLabel>
            Preventive Action
            <Req />
          </FieldLabel>
          <AutoTextArea
            disabled={readOnly}
            value={item.preventiveAction}
            onChange={(e) => onUpdate({ preventiveAction: e.target.value })}
            placeholder="What will prevent recurrence..."
            style={invalid(!item.preventiveAction.trim())}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <FieldLabel>
            Responsible Person
            <Req />
          </FieldLabel>
          <TextInput
            disabled={readOnly}
            value={item.responsiblePerson}
            onChange={(e) => onUpdate({ responsiblePerson: e.target.value })}
            style={invalid(!item.responsiblePerson.trim())}
          />
        </div>
        <div>
          <FieldLabel>
            Started Date
            <Req />
          </FieldLabel>
          <TextInput
            type="date"
            disabled={readOnly}
            value={item.startedDate}
            onChange={(e) => onUpdate({ startedDate: e.target.value })}
            style={invalid(!item.startedDate)}
          />
        </div>
        <div>
          <FieldLabel>
            Expected Completion
            <Req />
          </FieldLabel>
          <TextInput
            type="date"
            disabled={readOnly}
            value={item.targetDate}
            onChange={(e) => onUpdate({ targetDate: e.target.value })}
            style={invalid(!item.targetDate)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <FieldLabel>
            Verification
            <Req />
          </FieldLabel>
          <AutoTextArea
            disabled={readOnly}
            value={item.verification}
            onChange={(e) => onUpdate({ verification: e.target.value })}
            placeholder="Evidence used to verify this action was completed..."
            style={invalid(!item.verification.trim())}
          />
        </div>
        <div>
          <FieldLabel>Remarks</FieldLabel>
          <AutoTextArea
            disabled={readOnly}
            value={item.remarks}
            onChange={(e) => onUpdate({ remarks: e.target.value })}
            placeholder="Additional notes (optional)..."
          />
        </div>
      </div>

      {!readOnly && incomplete && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            fontSize: 11.5,
            color: "var(--orange)",
            fontWeight: 600,
            marginTop: 10,
          }}
        >
          <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Required: {missing.join(", ")}. Fill these (only Remarks is optional)
            or remove this item.
          </span>
        </div>
      )}
    </Card>
  );
}

export function ActionPlanStage({
  set,
  onUpdateSet,
  readOnly,
}: {
  set: CapaSet;
  onUpdateSet: (next: CapaSet) => void;
  readOnly: boolean;
}) {
  const items = set.actionItems;
  const setItems = (next: ActionItem[]) =>
    onUpdateSet({ ...set, actionItems: next });
  const addItem = () =>
    setItems([
      ...items,
      {
        id: uid("act"),
        correctiveAction: "",
        preventiveAction: "",
        responsiblePerson: "",
        targetDate: "",
        startedDate: "",
        status: "Not Started",
        dateCompleted: "",
        verification: "",
        remarks: "",
      },
    ]);
  const updateItem = (idx: number, patch: Partial<ActionItem>) => {
    const n = items.slice();
    n[idx] = { ...n[idx], ...patch };
    setItems(n);
  };
  const removeItem = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx));

  return (
    <Card style={{ padding: 20 }}>
      <div className="disp" style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
        Improvement Action Plan
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 16 }}>
        Optional — add corrective / preventive actions if there are any to track.
        Any item you add must be fully completed (only Remarks is optional) before
        you can proceed.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div style={{ background: "var(--surface-alt)", borderRadius: 8, padding: 12 }}>
          <FieldLabel>Issue</FieldLabel>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
            {set.issue || "—"}
          </div>
        </div>
        <div style={{ background: "var(--gold-soft)", borderRadius: 8, padding: 12 }}>
          <FieldLabel>Root Cause / Finding</FieldLabel>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
            {set.fiveWhys.rootCause || "—"}
          </div>
        </div>
        <div style={{ background: "var(--steel-soft)", borderRadius: 8, padding: 12 }}>
          <FieldLabel>Vital Cause</FieldLabel>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
            {set.vitalCauses.map((v) => v.text).filter(Boolean).join("; ") || "—"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((item, idx) => (
          <ActionItemCard
            key={item.id}
            item={item}
            index={idx}
            readOnly={readOnly}
            onUpdate={(patch) => updateItem(idx, patch)}
            onRemove={() => removeItem(idx)}
          />
        ))}
        {items.length === 0 && (
          <div
            style={{
              padding: 20,
              color: "var(--ink-faint)",
              fontSize: 13,
              fontStyle: "italic",
              textAlign: "center",
              border: "1px dashed var(--border)",
              borderRadius: 10,
            }}
          >
            No action items — the action plan is optional, you can continue without
            one.
          </div>
        )}
      </div>
      {!readOnly && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 14,
          }}
        >
          <Btn size="sm" variant="outline" onClick={addItem}>
            <Plus size={13} /> Add Action Item
          </Btn>
        </div>
      )}
    </Card>
  );
}
