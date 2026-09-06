"use client";

import { AlertCircle, Check, Info, Plus, X } from "lucide-react";
import { Card, FieldLabel, TextArea, TextInput } from "@/components/ui";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  MAX_CAUSES_PER_CATEGORY,
  uid,
} from "@/lib/capa-logic";
import type { CapaSet, Category, Cause } from "@/lib/capa-types";

const MAX_VITAL_CAUSES = 2;

function Required() {
  return (
    <span style={{ color: "var(--red)", marginLeft: 3 }} aria-hidden>
      *
    </span>
  );
}

function CausesList({
  category,
  causes,
  onChange,
  readOnly,
}: {
  category: Category;
  causes: Cause[];
  onChange: (next: Cause[]) => void;
  readOnly: boolean;
}) {
  const update = (idx: number, text: string) => {
    const next = causes.slice();
    next[idx] = { ...next[idx], text };
    onChange(next);
  };
  const add = () => {
    if (causes.length >= MAX_CAUSES_PER_CATEGORY) return;
    onChange([...causes, { id: uid("c"), text: "" }]);
  };
  const remove = (idx: number) => onChange(causes.filter((_, i) => i !== idx));

  return (
    <Card style={{ padding: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div className="disp" style={{ fontWeight: 700, fontSize: 13.5 }}>
          {CATEGORY_LABELS[category]}
        </div>
        <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
          {causes.length}/{MAX_CAUSES_PER_CATEGORY}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {causes.map((c, i) => (
          <div key={c.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--ink-faint)", width: 16 }}
            >
              {i + 1}
            </span>
            <TextInput
              value={c.text}
              disabled={readOnly}
              onChange={(e) => update(i, e.target.value)}
              placeholder={`Cause #${i + 1}`}
              style={{ padding: "6px 9px", fontSize: 13 }}
            />
            {!readOnly && (
              <button
                onClick={() => remove(i)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink-faint)",
                  flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {causes.length === 0 && (
          <div
            style={{ fontSize: 12.5, color: "var(--ink-faint)", fontStyle: "italic" }}
          >
            No causes identified yet.
          </div>
        )}
      </div>
      {!readOnly && causes.length < MAX_CAUSES_PER_CATEGORY && (
        <button
          onClick={add}
          style={{
            marginTop: 8,
            background: "none",
            border: "1px dashed var(--border)",
            borderRadius: 6,
            width: "100%",
            padding: 6,
            cursor: "pointer",
            color: "var(--steel)",
            fontSize: 12.5,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          <Plus size={13} /> Add cause
        </button>
      )}
    </Card>
  );
}

function AffinitizeSection({
  set,
  onUpdateSet,
  readOnly,
}: {
  set: CapaSet;
  onUpdateSet: (next: CapaSet) => void;
  readOnly: boolean;
}) {
  // Pool = every non-empty cause entered across the 6M categories.
  const pool = CATEGORIES.map((cat) => ({
    cat,
    items: set.sixM[cat].filter((c) => c.text.trim()),
  })).filter((g) => g.items.length > 0);
  const poolCount = pool.reduce((n, g) => n + g.items.length, 0);

  const selectedIds = new Set(set.vitalCauses.map((v) => v.id));
  const atMax = set.vitalCauses.length >= MAX_VITAL_CAUSES;

  const toggle = (cause: Cause) => {
    if (selectedIds.has(cause.id)) {
      onUpdateSet({
        ...set,
        vitalCauses: set.vitalCauses.filter((v) => v.id !== cause.id),
      });
      return;
    }
    if (atMax) return;
    onUpdateSet({
      ...set,
      vitalCauses: [...set.vitalCauses, { id: cause.id, text: cause.text }],
    });
  };

  const removeSelected = (id: string) =>
    onUpdateSet({
      ...set,
      vitalCauses: set.vitalCauses.filter((v) => v.id !== id),
    });

  const missing = set.vitalCauses.length === 0;

  return (
    <Card
      style={{
        padding: 16,
        background: "var(--gold-soft)",
        borderColor: missing ? "var(--red)" : "var(--gold)",
      }}
    >
      <div
        className="disp"
        style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}
      >
        Affinitize Here <Required />
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 12 }}>
        Select <strong>1–2</strong> vital causes from the causes you entered under
        the 6M categories above.
      </div>

      {/* Currently selected */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {set.vitalCauses.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "var(--red)",
              fontWeight: 600,
            }}
          >
            <AlertCircle size={13} /> Select at least 1 vital cause.
          </div>
        ) : (
          set.vitalCauses.map((vc, i) => (
            <div
              key={vc.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                background: "#fff",
                border: "1px solid var(--gold)",
                borderRadius: 8,
                padding: "7px 10px",
              }}
            >
              <span
                className="disp"
                style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 13, flex: 1 }}>{vc.text || "—"}</span>
              {!readOnly && (
                <button
                  onClick={() => removeSelected(vc.id)}
                  title="Remove"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--ink-faint)",
                    display: "flex",
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pool selector, grouped by 6M category */}
      {!readOnly && (
        <>
          {poolCount === 0 ? (
            <div
              style={{ fontSize: 12.5, color: "var(--ink-muted)", fontStyle: "italic" }}
            >
              Add causes under the 6M categories above, then pick the vital ones
              here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pool.map((g) => (
                <div key={g.cat}>
                  <div
                    className="disp"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "var(--ink-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: 6,
                    }}
                  >
                    {CATEGORY_LABELS[g.cat]}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {g.items.map((c) => {
                      const selected = selectedIds.has(c.id);
                      const blocked = atMax && !selected;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggle(c)}
                          disabled={blocked}
                          title={
                            blocked ? "You can select at most 2" : c.text
                          }
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            maxWidth: "100%",
                            border: `1px solid ${
                              selected ? "var(--navy)" : "var(--border)"
                            }`,
                            background: selected ? "var(--navy)" : "#fff",
                            color: selected ? "#fff" : "var(--ink)",
                            borderRadius: 999,
                            padding: "6px 12px",
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: blocked ? "not-allowed" : "pointer",
                            opacity: blocked ? 0.45 : 1,
                          }}
                        >
                          {selected ? <Check size={13} /> : <Plus size={13} />}
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 260,
                            }}
                          >
                            {c.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              marginTop: 10,
              fontSize: 11.5,
              color: "var(--ink-faint)",
            }}
          >
            {set.vitalCauses.length}/{MAX_VITAL_CAUSES} selected · minimum 1
            required
          </div>
        </>
      )}
    </Card>
  );
}

export function IssueAnd6MStage({
  set,
  onUpdateSet,
  readOnly,
}: {
  set: CapaSet;
  onUpdateSet: (next: CapaSet) => void;
  readOnly: boolean;
}) {
  const issueMissing = !set.issue.trim();

  const setIssue = (issue: string) => onUpdateSet({ ...set, issue });

  const setCause = (cat: Category, causes: Cause[]) => {
    const nextSixM = { ...set.sixM, [cat]: causes };
    // Keep the affinitized selection in sync with the live 6M pool: drop
    // selections whose source cause was deleted or blanked, and refresh text.
    const byId = new Map<string, string>();
    for (const c of CATEGORIES) {
      for (const item of nextSixM[c]) {
        if (item.text.trim()) byId.set(item.id, item.text);
      }
    }
    const nextVital = set.vitalCauses
      .filter((v) => byId.has(v.id))
      .map((v) => ({ id: v.id, text: byId.get(v.id)! }));
    onUpdateSet({ ...set, sixM: nextSixM, vitalCauses: nextVital });
  };

  return (
    <div>
      <Card
        style={{
          padding: 16,
          marginBottom: 16,
        }}
      >
        <FieldLabel strong>
          Issue / Finding — Set {set.setNumber}
          <Required />
        </FieldLabel>
        <TextArea
          rows={2}
          disabled={readOnly}
          value={set.issue}
          onChange={(e) => setIssue(e.target.value)}
          placeholder='e.g. "Fire extinguisher was found expired during inspection."'
          aria-invalid={issueMissing}
          style={{ fontWeight: 500 }}
        />
        {issueMissing ? (
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-muted)",
              fontWeight: 500,
              marginTop: 6,
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <Info size={12} /> Issue / Finding is required before this CAPA can be
            submitted.
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-faint)",
              marginTop: 6,
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <Info size={12} /> Flows automatically into Fishbone, 5 Whys, Action
            Plan and the CAPA Report. Remember to click{" "}
            <strong>Submit to QMD for verification</strong>.
          </div>
        )}
      </Card>

      <div style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 10 }}>
        Identify possible causes under each 6M category (up to 10 each).
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {CATEGORIES.map((cat) => (
          <CausesList
            key={cat}
            category={cat}
            causes={set.sixM[cat]}
            onChange={(c) => setCause(cat, c)}
            readOnly={readOnly}
          />
        ))}
      </div>

      <AffinitizeSection set={set} onUpdateSet={onUpdateSet} readOnly={readOnly} />
    </div>
  );
}
