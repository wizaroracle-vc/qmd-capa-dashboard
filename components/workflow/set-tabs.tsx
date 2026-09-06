"use client";

import { Plus, Trash2 } from "lucide-react";
import { Btn } from "@/components/ui";
import { setReadiness } from "@/lib/capa-logic";
import type { CapaSet } from "@/lib/capa-types";

export function SetTabs({
  sets,
  activeSetId,
  onSelect,
  onAdd,
  onDelete,
  readOnly,
}: {
  sets: CapaSet[];
  activeSetId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  readOnly: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {sets.map((s) => {
        const active = s.id === activeSetId;
        const ready = setReadiness(s);
        const dot = ready >= 1 ? "#1E8E52" : ready > 0 ? "#3B7CB4" : "#93A1AF";
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            title={s.issue || `Set ${s.setNumber}`}
            style={{
              border: active ? "1px solid var(--navy)" : "1px solid var(--border)",
              background: active ? "var(--navy)" : "#fff",
              color: active ? "#fff" : "var(--ink)",
              borderRadius: 999,
              padding: "7px 14px 7px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: active ? "#fff" : dot,
              }}
            />
            Set {s.setNumber}
            {!readOnly && sets.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
                style={{ marginLeft: 2, opacity: 0.7, display: "flex" }}
              >
                <Trash2 size={12} />
              </span>
            )}
          </button>
        );
      })}
      {!readOnly && (
        <Btn size="sm" variant="outline" onClick={onAdd}>
          <Plus size={14} /> Add CAPA Set
        </Btn>
      )}
    </div>
  );
}
