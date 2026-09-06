"use client";

import { useEffect } from "react";
import { useAppShell } from "@/app/(app)/app-shell";

/**
 * Publishes a page's identity (a tag + optional meta) into the centered slot of
 * the app header bar. Renders nothing itself.
 */
export function HeaderTitle({
  tag,
  meta,
  mono = false,
}: {
  tag: string;
  meta?: string;
  mono?: boolean;
}) {
  const { setHeaderExtra } = useAppShell();

  useEffect(() => {
    setHeaderExtra(
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <span
          className={mono ? "capa-tag mono" : "capa-tag"}
          style={{ fontSize: 12 }}
        >
          {tag}
        </span>
        {meta && (
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--navy-deep)",
              whiteSpace: "nowrap",
            }}
          >
            {meta}
          </span>
        )}
      </span>,
    );
    return () => setHeaderExtra(null);
  }, [setHeaderExtra, tag, meta, mono]);

  return null;
}
