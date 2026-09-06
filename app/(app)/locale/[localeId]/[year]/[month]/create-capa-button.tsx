"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { Btn, FieldLabel, Modal, Select, TextInput } from "@/components/ui";
import { todayStr } from "@/lib/capa-logic";
import { createCapaPlanAction } from "@/lib/capa-actions";

const SOURCES = [
  "Internal Audit",
  "External Audit",
  "Customer Complaint",
  "Management Review",
  "Incident Report",
  "Other",
];

export function CreateCapaButton({
  localeId,
  monthId,
  monthLabel,
  department,
  previewId,
}: {
  localeId: string;
  monthId: string;
  monthLabel: string;
  department: string;
  previewId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    dateCreated: todayStr(),
    source: "Internal Audit",
    preparedBy: "",
  });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    setError("");
    start(async () => {
      const res = await createCapaPlanAction(localeId, monthId, department, form);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/capa/${res.capaId}`);
    });
  };

  return (
    <>
      <Btn size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus size={13} /> CAPA Plan
      </Btn>
      {open && (
        <Modal
          title={`Create CAPA Plan — ${department}`}
          onClose={() => setOpen(false)}
          width={520}
        >
          <div
            style={{
              marginBottom: 16,
              background: "var(--steel-soft)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              color: "var(--navy)",
            }}
          >
            <span className="mono" style={{ fontWeight: 700 }}>
              {previewId}
            </span>{" "}
            · {localeId} · {monthLabel} · {department}. Created with{" "}
            <strong>1 default CAPA Set</strong> — add more from the workflow.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Date Created</FieldLabel>
              <TextInput
                type="date"
                value={form.dateCreated}
                onChange={(e) => set("dateCreated", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Source of Finding</FieldLabel>
              <Select
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
              >
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>Prepared By</FieldLabel>
              <TextInput
                value={form.preparedBy}
                onChange={(e) => set("preparedBy", e.target.value)}
              />
            </div>
          </div>
          {error && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--red)" }}>
              {error}
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 20,
            }}
          >
            <Btn variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Btn>
            <Btn
              variant="save"
              disabled={!form.preparedBy.trim() || pending}
              onClick={submit}
            >
              <Check size={14} /> {pending ? "Creating…" : "Create"}
            </Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
