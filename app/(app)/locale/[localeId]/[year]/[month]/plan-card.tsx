"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui";
import { StatusBadge, statusCardStyle } from "@/components/status-badge";
import { activeSets, planProgressPct, planStatus } from "@/lib/capa-logic";
import { deleteCapaPlanAction } from "@/lib/capa-actions";
import type { CapaPlan } from "@/lib/capa-types";

export function PlanCard({ plan }: { plan: CapaPlan }) {
  const router = useRouter();
  const status = planStatus(plan);
  const card = statusCardStyle(status);
  const canDelete = status === "Open" || status === "In Progress";

  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  return (
    <div style={{ position: "relative", marginBottom: 8 }}>
      <Link
        href={`/capa/${plan.capaId}`}
        style={{
          display: "block",
          textDecoration: "none",
          color: "inherit",
          background: card.background,
          border: `1px solid ${card.borderColor}`,
          borderRadius: 8,
          padding: "10px 12px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            {plan.preparedBy || plan.capaId}
          </span>
          <StatusBadge status={status} size="sm" />
        </div>
        {plan.preparedBy && (
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-muted)",
              marginTop: 2,
            }}
          >
            {plan.capaId}
          </div>
        )}
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-muted)",
            marginTop: 3,
            paddingRight: canDelete ? 22 : 0,
          }}
        >
          {activeSets(plan).length} CAPA Set(s) · {planProgressPct(plan)}% complete
        </div>
      </Link>

      {canDelete && (
        <button
          type="button"
          title="Delete CAPA"
          aria-label={`Delete ${plan.capaId}`}
          onClick={() => setConfirm(true)}
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-faint)",
            display: "flex",
            padding: 2,
          }}
        >
          <Trash2 size={14} />
        </button>
      )}

      {err && (
        <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 4 }}>
          {err}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title="Delete this CAPA?"
          message={`${plan.capaId} and all of its data will be permanently removed. This cannot be undone.`}
          confirmLabel="Delete"
          busy={pending}
          onCancel={() => setConfirm(false)}
          onConfirm={() =>
            start(async () => {
              setErr("");
              const res = await deleteCapaPlanAction(plan.capaId);
              if (res.error) {
                setErr(res.error);
                setConfirm(false);
                return;
              }
              setConfirm(false);
              router.refresh();
            })
          }
        />
      )}
    </div>
  );
}
