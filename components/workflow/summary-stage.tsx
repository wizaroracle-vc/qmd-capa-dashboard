"use client";

import { CapaReport } from "@/components/capa-report";
import type { CapaPlan } from "@/lib/capa-types";

export function SummaryStage({
  plan,
  monthLabel,
}: {
  plan: CapaPlan;
  monthLabel: string;
}) {
  return (
    <div>
      <div
        style={{
          background: "var(--steel-soft)",
          border: "1px solid var(--steel)",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 16,
          fontSize: 13,
          color: "var(--navy)",
        }}
      >
        Read-only overview of everything entered for this CAPA. Review each section
        below, then use <strong>Submit for QMD Verification</strong> at the bottom.
      </div>

      <CapaReport plan={plan} monthLabel={monthLabel} />
    </div>
  );
}
