"use client";

import { useState, type CSSProperties } from "react";
import { Card, Modal } from "@/components/ui";
import { CATEGORY_LABELS } from "@/lib/capa-logic";
import type { CapaSet, Category, Cause } from "@/lib/capa-types";

const BONE_WIDTH = 200;

function BoneList({
  title,
  causes,
  onExpand,
}: {
  title: string;
  causes: Cause[];
  onExpand: (text: string, context: string) => void;
}) {
  return (
    <div style={{ width: BONE_WIDTH }}>
      <div
        className="disp"
        style={{
          fontWeight: 700,
          fontSize: 12,
          color: "var(--navy-deep)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {causes.length === 0 && (
          <div
            style={{ fontSize: 11, color: "var(--ink-faint)", fontStyle: "italic" }}
          >
            No causes yet
          </div>
        )}
        {causes.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onExpand(c.text || "—", title)}
            style={{
              width: "100%",
              textAlign: "left",
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 11,
              lineHeight: 1.4,
              cursor: "pointer",
              display: "flex",
              gap: 6,
              // let long causes wrap to as many lines as needed
              whiteSpace: "normal",
              overflowWrap: "anywhere",
            }}
          >
            <span
              className="mono"
              style={{ color: "var(--ink-faint)", flexShrink: 0 }}
            >
              {i + 1}
            </span>
            <span style={{ flex: 1 }}>{c.text || "—"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const W = 1160;
const H = 560;
const spineY = 250;
const spineX1 = 70;
const spineX2 = 760;
const cx = 900;
const cy = 250;
const r = 100;
// evenly spread so the wrapped BoneLists (width 200) never touch
const topAttach: [number, Category][] = [
  [200, "MAN"],
  [430, "METHOD"],
  [660, "MEASUREMENT"],
];
const botAttach: [number, Category][] = [
  [200, "MOTHER_NATURE"],
  [430, "MATERIALS"],
  [660, "MACHINE"],
];

export function FishboneStage({
  set,
  hideHeader = false,
  fit = false,
}: {
  set: CapaSet;
  /** In the report the step already has its own numbered header. */
  hideHeader?: boolean;
  /** Scale the whole 1160px diagram down to fit a narrow column (report/print). */
  fit?: boolean;
}) {
  const [expanded, setExpanded] = useState<{ t: string; c: string } | null>(null);

  return (
    <Card style={{ padding: 20 }}>
      {!hideHeader && (
        <>
          <div
            className="disp"
            style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}
          >
            Fishbone Diagram
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 16 }}>
            Auto-populated from the 6M Root Cause Analysis. Click any cause to view
            its full text.
          </div>
        </>
      )}
      <div
        className={fit ? "fishbone-fit" : "hide-scrollbar"}
        style={
          fit ? ({ zoom: 0.78 } as CSSProperties) : { overflowX: "auto" }
        }
      >
        <div style={{ position: "relative", width: W, minHeight: H, margin: "0 auto" }}>
          <svg
            width={W}
            height={H}
            style={{ position: "absolute", top: 0, left: 0, zIndex: 0 }}
          >
            <line x1={spineX1} y1={spineY} x2={spineX2} y2={spineY} stroke="#B9C6D2" strokeWidth="2.5" />
            {topAttach.map(([x], i) => (
              <line key={"t" + i} x1={x} y1={80} x2={x + 90} y2={spineY} stroke="#CBD6DF" strokeWidth="2" />
            ))}
            {botAttach.map(([x], i) => (
              <line key={"b" + i} x1={x} y1={H - 130} x2={x + 90} y2={spineY} stroke="#CBD6DF" strokeWidth="2" />
            ))}
            <circle cx={cx} cy={cy} r={r} fill="#FBE7EB" stroke="var(--rose)" strokeWidth="2.5" />
            <foreignObject x={cx - 88} y={cy - 78} width={176} height={156}>
              <div
                onClick={() =>
                  setExpanded({
                    t: set.issue || "No issue entered yet",
                    c: "Issue / Effect",
                  })
                }
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  cursor: "pointer",
                  padding: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--rose)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Issue / Effect
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    marginTop: 4,
                    color: "var(--navy-deep)",
                    lineHeight: 1.35,
                    overflowWrap: "anywhere",
                    display: "-webkit-box",
                    WebkitLineClamp: 6,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {set.issue || "No issue entered yet"}
                </div>
              </div>
            </foreignObject>
          </svg>

          {topAttach.map(([x, cat]) => (
            <div key={cat} style={{ position: "absolute", left: x - 90, top: 6, zIndex: 1 }}>
              <BoneList
                title={CATEGORY_LABELS[cat]}
                causes={set.sixM[cat]}
                onExpand={(t, c) => setExpanded({ t, c })}
              />
            </div>
          ))}
          {botAttach.map(([x, cat]) => (
            <div
              key={cat}
              style={{ position: "absolute", left: x - 90, top: H - 120, zIndex: 1 }}
            >
              <BoneList
                title={CATEGORY_LABELS[cat]}
                causes={set.sixM[cat]}
                onExpand={(t, c) => setExpanded({ t, c })}
              />
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 8,
          background: "var(--gold-soft)",
          border: "1px solid var(--gold)",
          borderRadius: 8,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
          List of Affinitized Vital Causes
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {set.vitalCauses.length === 0 && (
            <div
              style={{ fontSize: 12.5, color: "var(--ink-faint)", fontStyle: "italic" }}
            >
              None identified yet — complete Affinitization on the Issue &amp; 6M
              page.
            </div>
          )}
          {set.vitalCauses.map((vc, i) => (
            <div
              key={vc.id}
              style={{ fontSize: 13, overflowWrap: "anywhere" }}
            >
              <strong>{i + 1}.</strong> {vc.text || "—"}
            </div>
          ))}
        </div>
      </div>

      {expanded && (
        <Modal title={expanded.c} onClose={() => setExpanded(null)} width={440}>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {expanded.t}
          </div>
        </Modal>
      )}
    </Card>
  );
}
