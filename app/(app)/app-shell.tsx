"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { signOutAction } from "@/app/login/actions";

type ShellCtx = { setHeaderExtra: (node: ReactNode) => void };
const Ctx = createContext<ShellCtx>({ setHeaderExtra: () => {} });

/** Lets a page render content into the center of the app header bar. */
export const useAppShell = () => useContext(Ctx);

export function AppShell({
  role,
  localeId,
  children,
}: {
  role: "LOCALE" | "QMD";
  localeId?: string;
  children: ReactNode;
}) {
  const [headerExtra, setHeaderExtra] = useState<ReactNode>(null);

  return (
    <Ctx.Provider value={{ setHeaderExtra }}>
      <header
        className="no-print"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link
          href={role === "QMD" ? "/qmd" : `/locale/${localeId}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <Image
            src="/LOGO1.png"
            alt="CAPA"
            width={34}
            height={34}
            priority
            style={{ height: "auto", borderRadius: 6 }}
          />
          <span
            className="disp"
            style={{
              fontWeight: 700,
              color: "var(--navy-deep)",
              fontSize: 15,
              whiteSpace: "nowrap",
            }}
          >
            CAPA Management System
          </span>
        </Link>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {headerExtra}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "var(--ink-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {role === "QMD" ? (
              <>
                <ShieldCheck size={14} color="var(--navy)" /> QMD / Management
              </>
            ) : (
              <>Branch · {localeId}</>
            )}
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 13,
                color: "var(--ink-muted)",
                cursor: "pointer",
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </form>
        </div>
      </header>

      <main>{children}</main>
    </Ctx.Provider>
  );
}
