"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

const EMAIL_DOMAIN = "capa.local";

export async function signInAction(
  formData: FormData,
): Promise<LoginState | void> {
  const rawUser = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!rawUser || !password) {
    return { error: "Enter your username and password." };
  }

  // The username is a Supabase email under the hood. Both the branch and the
  // role live on the account itself — nothing else to pick on this screen.
  const email = rawUser.includes("@")
    ? rawUser.toLowerCase()
    : `${rawUser.toLowerCase()}@${EMAIL_DOMAIN}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    return { error: "Invalid username or password." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role === "QMD") {
    redirect("/qmd");
  }

  const { data: localeId } = await supabase.rpc("auth_locale_id");
  if (!localeId) {
    await supabase.auth.signOut();
    return { error: "This account has no branch access. Contact QMD." };
  }

  redirect(`/locale/${localeId}`);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
