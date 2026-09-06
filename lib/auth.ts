import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "./capa-types";

/** Resolve the current session into a role-scoped user, or null if signed out. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  if (profile.role === "QMD") {
    return { role: "QMD", userId: user.id };
  }

  // LOCALE: resolve the branch via the SECURITY DEFINER helper (locale_accounts
  // is otherwise QMD-only under RLS).
  const { data: localeId } = await supabase.rpc("auth_locale_id");
  if (!localeId) return null;
  return { role: "LOCALE", localeId: localeId as string, userId: user.id };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireQmd(): Promise<Extract<SessionUser, { role: "QMD" }>> {
  const user = await requireUser();
  if (user.role !== "QMD") redirect("/");
  return user;
}

/** For LOCALE users, redirect to their own branch if they ask for another. */
export async function requireLocaleAccess(localeId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "QMD") return user;
  if (user.localeId !== localeId) redirect(`/locale/${user.localeId}`);
  return user;
}

/** Landing path after login / for the root route. */
export function homePathFor(user: SessionUser): string {
  return user.role === "QMD" ? "/qmd" : `/locale/${user.localeId}`;
}
