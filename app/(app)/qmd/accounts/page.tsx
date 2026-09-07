import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireQmd } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountsManager, type LocaleAccountRow } from "./accounts-manager";

export default async function QmdAccountsPage() {
  await requireQmd();
  const supabase = await createClient();
  const [localesRes, accountsRes] = await Promise.all([
    supabase.from("locales").select("id, name").order("id"),
    supabase
      .from("locale_accounts")
      .select("locale_id, email, visible_password, enabled, updated_at"),
  ]);

  const byLocale = new Map(
    (accountsRes.data ?? []).map((r) => [r.locale_id, r] as const),
  );

  const rows: LocaleAccountRow[] = (localesRes.data ?? []).map((l) => {
    const r = byLocale.get(l.id);
    return {
      localeId: l.id,
      email: r?.email ?? null,
      visiblePassword: r?.visible_password ?? null,
      enabled: r?.enabled ?? null,
      updatedAt: r?.updated_at ?? null,
    };
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 80px" }}>
      <Link
        href="/qmd"
        className="no-print"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--ink-muted)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      <div
        className="disp"
        style={{ fontSize: 24, fontWeight: 700, color: "var(--navy-deep)" }}
      >
        Branch Login Accounts
      </div>
      <p style={{ fontSize: 13.5, color: "var(--ink-muted)", margin: "6px 0 22px" }}>
        Adding a branch creates its login automatically (username = the code).
        Reveal or reset the password, or <strong>Disable</strong> the login for a
        temporary hold. <strong>Remove branch</strong> permanently deletes the
        branch and all of its CAPA data. Each branch only sees its own CAPAs.
      </p>

      <AccountsManager rows={rows} />
    </div>
  );
}
