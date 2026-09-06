/* Status badge + dashboard-card styling, keyed to planStatus() in lib/capa-logic.ts. */

const STATUS_STYLES: Record<string, { bg: string; fg: string; dot: string }> = {
  Open: { bg: "#F1F5F9", fg: "#475569", dot: "#94A3B8" },
  "In Progress": { bg: "#FEF3C7", fg: "#92400E", dot: "#F59E0B" },
  "For QMD Verification": { bg: "#DBEAFE", fg: "#1E40AF", dot: "#3B82F6" },
  Overdue: { bg: "var(--red-soft)", fg: "var(--red)", dot: "#CC3B3B" },
  Effective: { bg: "var(--green-soft)", fg: "var(--green)", dot: "#1E8E52" },
  "Partially Effective": {
    bg: "var(--purple-soft)",
    fg: "var(--purple)",
    dot: "#7A5CC0",
  },
  "Not Effective": { bg: "var(--red-soft)", fg: "var(--red)", dot: "#CC3B3B" },
  // Action-item statuses
  "Not Started": { bg: "#F1F5F9", fg: "#475569", dot: "#94A3B8" },
  Completed: { bg: "var(--green-soft)", fg: "var(--green)", dot: "#1E8E52" },
};

const STATUS_CARD_STYLES: Record<
  string,
  { background: string; borderColor: string }
> = {
  Open: { background: "#FFFFFF", borderColor: "#CBD5E1" },
  "In Progress": { background: "#FFFBEB", borderColor: "#FCD34D" },
  Overdue: { background: "#FEF2F2", borderColor: "var(--red)" },
  "For QMD Verification": { background: "#EFF6FF", borderColor: "#93C5FD" },
  Effective: { background: "#F0FDF4", borderColor: "var(--green)" },
  "Partially Effective": { background: "#FAF5FF", borderColor: "var(--purple)" },
  "Not Effective": { background: "#FEF2F2", borderColor: "var(--red)" },
};

/** Card background + border for a plan card, keyed to planStatus(). */
export function statusCardStyle(status: string) {
  return STATUS_CARD_STYLES[status] ?? STATUS_CARD_STYLES.Open;
}

export function StatusBadge({
  status,
  size = "md",
}: {
  status: string;
  size?: "sm" | "md";
}) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Open;
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        borderRadius: 999,
        padding: size === "sm" ? "2px 8px" : "4px 12px",
        fontSize: size === "sm" ? 11 : 12.5,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: 999, background: s.dot }}
      />
      {status}
    </span>
  );
}
