"use server";

import { revalidatePath } from "next/cache";
import { requireQmd } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AccountsActionState = { error?: string; ok?: string };

const EMAIL_DOMAIN = "capa.local";
// Branch code = the branch name. Letters / digits / - / _, 2–40 chars.
const BRANCH_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;

function toEmail(username: string) {
  const u = username.trim().toLowerCase();
  return u.includes("@") ? u : `${u}@${EMAIL_DOMAIN}`;
}

function randomPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Branches live in the `locales` table (QMD adds them here). */
async function localeExists(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locales")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return !!data;
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

/**
 * Create the auth user + profile + locale_accounts row for a branch.
 * Assumes the caller has already verified QMD + that the locale exists and has
 * no account. Returns `{ error }` on failure (nothing partial is left behind).
 */
async function provisionLocaleAccount(
  localeId: string,
  username: string,
  password: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const email = toEmail(username);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return { error: createErr?.message ?? "Could not create the login." };
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
  return {};
}

/**
 * Add a branch AND its login in one step. The branch code is also the name;
 * the login username is the code (lower-cased) with an auto-generated password.
 */
export async function createBranch(
  _prev: AccountsActionState,
  formData: FormData,
): Promise<AccountsActionState> {
  await requireQmd();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();

  if (!BRANCH_CODE_RE.test(code)) {
    return {
      error: "Branch code: 2–40 letters, numbers, - or _ (e.g. VCHI).",
    };
  }
  if (await localeExists(code)) return { error: `Branch ${code} already exists.` };

  const supabase = await createClient();
  const { error: locErr } = await supabase
    .from("locales")
    .insert({ id: code, name: code });
  if (locErr) return { error: locErr.message };

  const username = code.toLowerCase();
  const password = randomPassword();
  const { error } = await provisionLocaleAccount(code, username, password);
  if (error) {
    // roll back the branch row so it isn't left login-less
    await supabase.from("locales").delete().eq("id", code);
    return { error };
  }

  revalidatePath("/qmd/accounts");
  revalidatePath("/qmd");
  return {
    ok: `Branch ${code} added — login: ${username} / ${password}`,
  };
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

/**
 * Remove a branch entirely — its login AND the branch itself, which cascades to
 * every month / CAPA plan / set / action item for that branch (FK
 * `on delete cascade`). There is no undo; use "Disable" for a temporary hold.
 */
export async function removeBranch(
  _prev: AccountsActionState,
  formData: FormData,
): Promise<AccountsActionState> {
  await requireQmd();
  const localeId = String(formData.get("localeId") ?? "");
  if (!(await localeExists(localeId))) return { error: "Unknown branch." };

  const admin = createAdminClient();

  // 1. delete the auth user if there is one (cascades profiles + locale_accounts).
  const userId = await accountUserId(localeId);
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return { error: error.message };
  }

  // 2. delete the branch row (cascades months + capa_plans + sets + items).
  const { error: locErr } = await admin.from("locales").delete().eq("id", localeId);
  if (locErr) return { error: locErr.message };

  revalidatePath("/qmd/accounts");
  revalidatePath("/qmd");
  return { ok: `Branch ${localeId} and all of its data were removed.` };
}
