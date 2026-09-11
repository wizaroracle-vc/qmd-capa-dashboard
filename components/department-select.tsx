"use client";

export function DepartmentSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontWeight: 600,
        fontSize: 13.5,
        fontFamily: "inherit",
        color: "var(--ink)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "3px 6px",
      }}
    >
      {!options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
