"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
} from "lucide-react";
import {
  createBranch,
  removeBranch,
  resetLocalePassword,
  setLocaleEnabled,
  type AccountsActionState,
} from "./actions";

export type LocaleAccountRow = {
  localeId: string;
  email: string | null;
  visiblePassword: string | null;
  enabled: boolean | null;
  updatedAt: string | null;
};

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
  marginBottom: 12,
};
const input: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 13.5,
  background: "#fff",
  color: "var(--ink)",
};
const btn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontWeight: 600,
  fontSize: 13,
  borderRadius: 8,
  padding: "8px 12px",
  border: "1px solid transparent",
  cursor: "pointer",
};

function Feedback({ state }: { state: AccountsActionState }) {
  if (state.error)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "var(--red)",
          fontSize: 12.5,
          marginTop: 8,
        }}
      >
        <AlertCircle size={13} /> {state.error}
      </div>
    );
  if (state.ok)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "var(--green)",
          fontSize: 12.5,
          marginTop: 8,
        }}
      >
        <CheckCircle2 size={13} /> {state.ok}
      </div>
    );
  return null;
}

function AddBranchForm() {
  const [state, action, pending] = useActionState<AccountsActionState, FormData>(
    createBranch,
    {},
  );
  return (
    <div style={{ ...card, borderStyle: "dashed" }}>
      <div
        className="disp"
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "var(--navy-deep)",
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Building2 size={15} /> Add a branch
      </div>
      <div
        style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 10 }}
      >
        Enter the branch code. A login (username = code, auto-generated password)
        is created automatically.
      </div>
      <form action={action}>
        <div
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
        >
          <input
            name="code"
            placeholder="Branch code (e.g. VCHI)"
            autoFocus
            style={{ ...input, flex: "1 1 220px", textTransform: "uppercase" }}
          />
          <button
            type="submit"
            disabled={pending}
            style={{
              ...btn,
              background: "var(--navy)",
              color: "#fff",
              opacity: pending ? 0.6 : 1,
            }}
          >
            <Building2 size={14} /> {pending ? "Adding…" : "Add branch"}
          </button>
        </div>
        <Feedback state={state} />
      </form>
    </div>
  );
}

/** Legacy/seed branches with no login row — offer only to remove them. */
function NoLogin({ localeId }: { localeId: string }) {
  const [state, action, pending] = useActionState<AccountsActionState, FormData>(
    removeBranch,
    {},
  );
  return (
    <form action={action}>
      <input type="hidden" name="localeId" value={localeId} />
      <div style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 8 }}>
        No login on record. Remove this branch and add it again to create one.
      </div>
      <button
        type="submit"
        disabled={pending}
        style={{
          ...btn,
          background: "#fff",
          border: "1px solid var(--red-soft)",
          color: "var(--red)",
          opacity: pending ? 0.6 : 1,
        }}
      >
        <Trash2 size={14} /> {pending ? "Removing…" : "Remove branch"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function ManageForms({ row }: { row: LocaleAccountRow }) {
  const [reveal, setReveal] = useState(false);
  const [resetState, resetAction, resetting] = useActionState<
    AccountsActionState,
    FormData
  >(resetLocalePassword, {});
  const [toggleState, toggleAction, toggling] = useActionState<
    AccountsActionState,
    FormData
  >(setLocaleEnabled, {});
  const [removeState, removeAction, removing] = useActionState<
    AccountsActionState,
    FormData
  >(removeBranch, {});
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          fontSize: 13,
        }}
      >
        <div>
          <span style={{ color: "var(--ink-faint)" }}>Username&nbsp;</span>
          <span className="mono">{row.email}</span>
        </div>
        <div>
          <span style={{ color: "var(--ink-faint)" }}>Password&nbsp;</span>
          <span className="mono">
            {reveal ? row.visiblePassword : "••••••••"}
          </span>
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            title={reveal ? "Hide" : "Reveal"}
            style={{
              ...btn,
              padding: 4,
              marginLeft: 6,
              background: "transparent",
              color: "var(--ink-muted)",
            }}
          >
            {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            background: row.enabled ? "var(--green-soft)" : "var(--slate-soft)",
            color: row.enabled ? "var(--green)" : "var(--ink-muted)",
          }}
        >
          {row.enabled ? "ENABLED" : "DISABLED"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <form action={resetAction} style={{ display: "flex", gap: 8 }}>
          <input type="hidden" name="localeId" value={row.localeId} />
          <input name="password" placeholder="New password" style={input} />
          <button
            type="submit"
            disabled={resetting}
            style={{ ...btn, background: "var(--surface-alt)", color: "var(--navy)" }}
          >
            <KeyRound size={14} /> {resetting ? "Saving…" : "Reset password"}
          </button>
        </form>

        <form action={toggleAction}>
          <input type="hidden" name="localeId" value={row.localeId} />
          <input
            type="hidden"
            name="enabled"
            value={row.enabled ? "false" : "true"}
          />
          <button
            type="submit"
            disabled={toggling}
            style={{ ...btn, background: "#fff", border: "1px solid var(--border)", color: "var(--ink-muted)" }}
          >
            {row.enabled ? "Disable" : "Enable"}
          </button>
        </form>

        {confirmRemove ? (
          <form
            action={removeAction}
            style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
          >
            <input type="hidden" name="localeId" value={row.localeId} />
            <span style={{ fontSize: 12, color: "var(--red)", fontWeight: 600 }}>
              Deletes {row.localeId}, its login, and ALL its CAPA data. No undo.
            </span>
            <button
              type="submit"
              disabled={removing}
              style={{ ...btn, background: "var(--red)", color: "#fff" }}
            >
              <Trash2 size={14} /> {removing ? "Removing…" : "Delete branch"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              style={{ ...btn, background: "transparent", color: "var(--ink-muted)" }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            style={{
              ...btn,
              background: "#fff",
              border: "1px solid var(--red-soft)",
              color: "var(--red)",
            }}
          >
            <Trash2 size={14} /> Remove branch
          </button>
        )}
      </div>

      <Feedback state={resetState} />
      <Feedback state={toggleState} />
      <Feedback state={removeState} />
    </div>
  );
}

export function AccountsManager({ rows }: { rows: LocaleAccountRow[] }) {
  return (
    <div>
      <AddBranchForm />
      {rows.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: "4px 2px 0" }}>
          No branches yet — add one above.
        </p>
      )}
      {rows.map((row) => (
        <div key={row.localeId} style={card}>
          <div
            className="disp mono"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--navy-deep)",
              marginBottom: 12,
            }}
          >
            {row.localeId}
          </div>
          {row.email ? (
            <ManageForms row={row} />
          ) : (
            <NoLogin localeId={row.localeId} />
          )}
        </div>
      ))}
    </div>
  );
}
