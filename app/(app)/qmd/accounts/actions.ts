"use server";

import { revalidatePath } from "next/cache";
import { requireQmd } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AccountsActionState = { error?: string; ok?: string };

const EMAIL_DOMAIN = "capa.local";
const BRANCH_ID_RE = /^[A-Z0-9]{2,8}$/;

function toEmail(username: string) {
  const u = username.trim().toLowerCase();
  return u.includes("@") ? u : `${u}@${EMAIL_DOMAIN}`;
}

/** Branches now live in the `locales` table (QMD can add them), not a constant. */
async function localeExists(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locales")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return !!data;
}

/** QMD adds a new branch. RLS (`locales_qmd_write`) already restricts this to QMD. */
export async function createBranch(
  _prev: AccountsActionState,
  formData: FormData,
): Promise<AccountsActionState> {
  await requireQmd();
  const id = String(formData.get("id") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();

  if (!BRANCH_ID_RE.test(id))
    return { error: "Branch code must be 2–8 letters or numbers (e.g. VCHI)." };
  if (!name) return { error: "Enter a branch name." };
  if (await localeExists(id)) return { error: `Branch ${id} already exists.` };

  const supabase = await createClient();
  const { error } = await supabase.from("locales").insert({ id, name });
  if (error) return { error: error.message };

  revalidatePath("/qmd/accounts");
  revalidatePath("/qmd");
  return { ok: `Branch ${id} added — now create its login below.` };
}

async function accountUserId(localeId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locale_accounts")
    .select("user_id")
    .eq("locale_id", localeId)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function createLocaleAccount(
  _prev: AccountsActionState,
  formData: FormData,
): Promise<AccountsActionState> {
  await requireQmd();
  const localeId = String(formData.get("localeId") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!(await localeExists(localeId))) return { error: "Unknown branch." };
  if (!username) return { error: "Enter a username." };
  if (password.length < 6)
    return { error: "Password must be at least 6 characters." };
  if (await accountUserId(localeId))
    return { error: `${localeId} already has an account.` };

  const admin = createAdminClient();
  const email = toEmail(username);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return { error: createErr?.message ?? "Could not create the auth user." };
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .upsert({ id: created.user.id, role: "LOCALE", full_name: `${localeId} Branch` });
  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileErr.message };
  }

  const { error: acctErr } = await admin.from("locale_accounts").insert({
    locale_id: localeId,
    user_id: created.user.id,
    email,
    visible_password: password,
    enabled: true,
    updated_at: new Date().toISOString(),
  });
  if (acctErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: acctErr.message };
  }

  revalidatePath("/qmd/accounts");
  return { ok: `Created ${localeId} account (${email}).` };
}

export async function resetLocalePassword(
  _prev: AccountsActionState,
  formData: FormData,
): Promise<AccountsActionState> {
  await requireQmd();
  const localeId = String(formData.get("localeId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!(await localeExists(localeId))) return { error: "Unknown branch." };
  if (password.length < 6)
    return { error: "Password must be at least 6 characters." };

  const userId = await accountUserId(localeId);
  if (!userId) return { error: `${localeId} has no account yet.` };

  const admin = createAdminClient();
  const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  if (pwErr) return { error: pwErr.message };

  const { error: acctErr } = await admin
    .from("locale_accounts")
    .update({ visible_password: password, updated_at: new Date().toISOString() })
    .eq("locale_id", localeId);
  if (acctErr) return { error: acctErr.message };

  revalidatePath("/qmd/accounts");
  return { ok: `${localeId} password updated.` };
}

export async function setLocaleEnabled(
  _prev: AccountsActionState,
  formData: FormData,
): Promise<AccountsActionState> {
  await requireQmd();
  const localeId = String(formData.get("localeId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  if (!(await localeExists(localeId))) return { error: "Unknown branch." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("locale_accounts")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("locale_id", localeId);
  if (error) return { error: error.message };

  revalidatePath("/qmd/accounts");
  return { ok: `${localeId} account ${enabled ? "enabled" : "disabled"}.` };
}

export async function removeLocaleAccount(
  _prev: AccountsActionState,
  formData: FormData,
): Promise<AccountsActionState> {
  await requireQmd();
  const localeId = String(formData.get("localeId") ?? "");
  if (!(await localeExists(localeId))) return { error: "Unknown branch." };

  const userId = await accountUserId(localeId);
  if (!userId) return { error: `${localeId} has no account.` };

  const admin = createAdminClient();
  // profiles + locale_accounts cascade via FK on auth.users delete.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/qmd/accounts");
  return { ok: `${localeId} account removed.` };
}
