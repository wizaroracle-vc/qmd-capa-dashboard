import { requireUser } from "@/lib/auth";
import { AppShell } from "./app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="capa-root">
      <AppShell
        role={user.role}
        localeId={user.role === "LOCALE" ? user.localeId : undefined}
      >
        {children}
      </AppShell>
    </div>
  );
}
