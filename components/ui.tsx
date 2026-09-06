"use client";

/* Ported from _legacy/app.js atoms (lines ~357-386, 380-386, 528-538).
   Same inline styles/props; the Tailwind pass is a later phase. */
import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AlertTriangle, X } from "lucide-react";

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  // Longhand (not the `border` shorthand) so callers can override just
  // `borderColor` without React warning about mixing shorthand/longhand.
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--border)",
  fontSize: 14,
  fontFamily: "var(--font-inter, Inter, sans-serif)",
  background: "#fff",
  color: "var(--ink)",
};

type BtnVariant =
  | "primary"
  | "steel"
  | "outline"
  | "ghost"
  | "danger"
  | "success"
  | "save";

const btnVariants: Record<BtnVariant, CSSProperties> = {
  primary: { background: "var(--navy)", color: "#fff" },
  steel: { background: "var(--steel)", color: "#fff" },
  outline: { background: "#fff", color: "var(--navy)", border: "1px solid var(--border)" },
  ghost: { background: "transparent", color: "var(--ink-muted)" },
  danger: { background: "#fff", color: "var(--red)", border: "1px solid var(--red-soft)" },
  success: { background: "var(--green)", color: "#fff" },
  save: { background: "var(--navy)", color: "#fff" },
};

export function Btn({
  children,
  variant = "primary",
  size = "md",
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: "sm" | "md";
}) {
  const base: CSSProperties = {
    fontFamily: "var(--font-inter, Inter, sans-serif)",
    fontWeight: 600,
    borderRadius: 8,
    cursor: props.disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid transparent",
    padding: size === "sm" ? "6px 12px" : "9px 16px",
    fontSize: size === "sm" ? 13 : 14,
    transition: "all .15s ease",
    opacity: props.disabled ? 0.5 : 1,
    whiteSpace: "nowrap",
  };
  return (
    <button {...props} style={{ ...base, ...btnVariants[variant], ...style }}>
      {children}
    </button>
  );
}

export function Card({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "var(--surface)",
        // Longhand so callers can override just `borderColor` (see inputStyle).
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--border)",
        borderRadius: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function FieldLabel({
  children,
  hint,
  strong,
}: {
  children: ReactNode;
  hint?: ReactNode;
  /** Emphasise a required / primary field without colouring it like an error. */
  strong?: boolean;
}) {
  return (
    <div style={{ marginBottom: 5 }}>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: strong ? 800 : 600,
          color: strong ? "var(--navy-deep)" : "var(--ink-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {children}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function TextInput({
  style,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...style }} />;
}

export function TextArea({
  style,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} style={{ ...inputStyle, resize: "vertical", ...style }} />
  );
}

export function Select({
  children,
  style,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} style={{ ...inputStyle, ...style }}>
      {children}
    </select>
  );
}

/** Textarea that grows to fit its content. */
export function AutoTextArea({
  value,
  style,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 64) + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      {...props}
      style={{
        ...inputStyle,
        resize: "vertical",
        overflow: "hidden",
        minHeight: 64,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        ...style,
      }}
    />
  );
}

export function Modal({
  title,
  onClose,
  children,
  width = 640,
}: {
  title: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,39,64,0.45)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        overflowY: "auto",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: width,
          boxShadow: "0 20px 60px rgba(15,39,64,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="disp" style={{ fontWeight: 700, fontSize: 17 }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-muted)",
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  busy = false,
}: {
  title: ReactNode;
  message: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel} width={460}>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <AlertTriangle
          size={22}
          color="var(--red)"
          style={{ flexShrink: 0, marginTop: 2 }}
        />
        <div style={{ fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.5 }}>
          {message}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn variant="ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Btn>
        <Btn
          variant={danger ? "danger" : "primary"}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Working…" : confirmLabel}
        </Btn>
      </div>
    </Modal>
  );
}
