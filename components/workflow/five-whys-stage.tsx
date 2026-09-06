"use client";

import { Info } from "lucide-react";
import { AutoTextArea, Card, FieldLabel, TextInput } from "@/components/ui";
import type { CapaSet, FiveWhys } from "@/lib/capa-types";

export function FiveWhysStage({
  set,
  onUpdateSet,
  readOnly,
}: {
  set: CapaSet;
  onUpdateSet: (next: CapaSet) => void;
  readOnly: boolean;
}) {
  const setW = (k: keyof FiveWhys, v: string) =>
    onUpdateSet({ ...set, fiveWhys: { ...set.fiveWhys, [k]: v } });

  return (
    <Card style={{ padding: 20 }}>
      <div className="disp" style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
        5 Whys Root Cause Analysis
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 12 }}>
        Continue asking Why until the underlying root cause is identified.
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          fontSize: 12.5,
          color: "var(--ink-muted)",
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "9px 11px",
          marginBottom: 16,
        }}
      >
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          You don&apos;t always need all five. If the root cause is clear sooner,
          type <strong>N/A</strong> in the Why boxes you don&apos;t need. Only{" "}
          <strong>Root Cause</strong> below is required.
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ background: "var(--surface-alt)", borderRadius: 8, padding: 12 }}>
          <FieldLabel>Issue</FieldLabel>
          <div style={{ fontSize: 13.5 }}>{set.issue || "—"}</div>
        </div>
        <div style={{ background: "var(--gold-soft)", borderRadius: 8, padding: 12 }}>
          <FieldLabel>Vital / Affinitized Causes</FieldLabel>
          {set.vitalCauses.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>—</div>
          ) : (
            set.vitalCauses.map((vc, i) => (
              <div key={vc.id} style={{ fontSize: 13.5 }}>
                {i + 1}. {vc.text}
              </div>
            ))
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <div key={n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 90, flexShrink: 0, paddingTop: 9 }}>
              <span
                style={{
                  background: "var(--navy)",
                  color: "#fff",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                WHY {n}
              </span>
            </div>
            <TextInput
              value={set.fiveWhys[`why${n}` as keyof FiveWhys]}
              disabled={readOnly}
              onChange={(e) => setW(`why${n}` as keyof FiveWhys, e.target.value)}
              placeholder={
                n === 1
                  ? "Why did this happen?"
                  : "Why did that happen?  (or N/A)"
              }
            />
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 18,
          background: "var(--gold-soft)",
          border: "2px solid var(--gold)",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <FieldLabel strong>
          Root Cause
          <span style={{ color: "var(--red)", marginLeft: 3 }} aria-hidden>
            *
          </span>
        </FieldLabel>
        <AutoTextArea
          disabled={readOnly}
          value={set.fiveWhys.rootCause}
          onChange={(e) => setW("rootCause", e.target.value)}
          placeholder="Final identified root cause..."
          style={{ background: "#fff", fontWeight: 600 }}
        />
      </div>
    </Card>
  );
}
