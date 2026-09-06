"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { Btn, FieldLabel, Modal, Select, TextInput } from "@/components/ui";
import { MONTH_NAMES } from "@/lib/capa-logic";
import { createMonthAction } from "@/lib/capa-actions";

export function CreateMonthButton({
  localeId,
  existing,
}: {
  localeId: string;
  existing: { year: number; monthNum: number }[];
}) {
  const router = useRouter();
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [monthNum, setMonthNum] = useState(now.getMonth() + 1);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const duplicate = existing.some(
    (m) => m.year === Number(year) && m.monthNum === Number(monthNum),
  );

  const submit = () => {
    setError("");
    start(async () => {
      const res = await createMonthAction(localeId, Number(year), Number(monthNum));
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/locale/${localeId}/${res.year}/${res.monthNum}`);
    });
  };

  return (
    <>
      <Btn onClick={() => setOpen(true)}>
        <Plus size={16} /> Create Month
      </Btn>
      {open && (
        <Modal title="Create Month" onClose={() => setOpen(false)} width={420}>
          <div style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 16 }}>
            Select the month to create for branch <strong>{localeId}</strong>.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <FieldLabel>Month</FieldLabel>
              <Select
                value={monthNum}
                onChange={(e) => setMonthNum(Number(e.target.value))}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel>Year</FieldLabel>
              <TextInput
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
          </div>
          {duplicate && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--red)" }}>
              This month already exists for {localeId}.
            </div>
          )}
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
            <Btn variant="save" disabled={duplicate || pending} onClick={submit}>
              <Check size={14} /> {pending ? "Saving…" : "Create"}
            </Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
