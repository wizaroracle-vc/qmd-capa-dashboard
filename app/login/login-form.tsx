"use client";

import { useState, useTransition } from "react";
import { AlertCircle, KeyRound } from "lucide-react";
import { signInAction } from "./actions";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 14,
  fontFamily: "var(--font-inter, Inter, sans-serif)",
  background: "#fff",
  color: "var(--ink)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--ink-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 5,
  display: "block",
};

export function LoginForm() {
  const [error, setError] = useState<string>("");
  const [pending, startTransition] = useTransition();

  // Manual submit (no `action` prop) so React 19 does NOT auto-reset the form
  // after a failed sign-in — the username stays as typed.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      setError("");
      const res = await signInAction(formData);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 28,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: "var(--surface-alt)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <KeyRound size={18} color="var(--ink-muted)" />
        </div>
        <div>
          <div className="disp" style={{ fontWeight: 700, fontSize: 17 }}>
            Sign In
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
            Use the account QMD gave you
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle} htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          placeholder="e.g. vchi"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter password"
          style={inputStyle}
        />
      </div>

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--red)",
            fontSize: 12.5,
            marginBottom: 12,
          }}
        >
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          width: "100%",
          justifyContent: "center",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "var(--font-inter, Inter, sans-serif)",
          fontWeight: 600,
          borderRadius: 8,
          border: "1px solid transparent",
          padding: "10px 16px",
          fontSize: 14,
          cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.6 : 1,
          background: "var(--navy)",
          color: "#fff",
        }}
      >
        {pending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
