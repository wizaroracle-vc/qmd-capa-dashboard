import { Fragment } from "react";

// Splits on http(s) URLs; the capturing group keeps them in the result array.
const URL_SPLIT = /(https?:\/\/[^\s<>()[\]]+)/gi;
const IS_URL = /^https?:\/\//i;

/**
 * Renders text with any http(s) URL in it turned into a real link. Used for
 * QMD-entered Evidence / Reference and Remarks, so a pasted link is clickable
 * instead of plain text.
 */
export function Linkify({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <>
      {text.split(URL_SPLIT).map((part, i) =>
        IS_URL.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--steel)",
              textDecoration: "underline",
              wordBreak: "break-all",
            }}
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
