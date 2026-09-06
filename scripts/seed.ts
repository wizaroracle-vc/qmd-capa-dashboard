/* ---------------------------------------------------------------------------
   Seed script — grants the QMD role, seeds the branch list, and loads demo data.
   Run against a hosted or local Supabase project:

     npm run seed                 # uses .env.local

   Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

   Auth is Supabase-native. This script does NOT create the QMD user or set any
   password — you create the QMD user in the Supabase dashboard
   (Authentication -> Users), then set SEED_QMD_EMAIL to that email and run this
   once so it gets role = QMD. Branch logins are created later by QMD at
   /qmd/accounts.

   Safe to re-run. Demo data is skipped if any capa_plans exist; pass
   `npm run seed -- --force-data` to wipe and reload it.
--------------------------------------------------------------------------- */
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LOCALES } from "../lib/capa-logic";
import { makeSeedData } from "../lib/seed-data";
import type { Database } from "../lib/database.types";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env", override: false });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const QMD_EMAIL = process.env.SEED_QMD_EMAIL?.trim();
const FORCE_DATA = process.argv.includes("--force-data");

if (!URL || !SERVICE_ROLE) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const db = createClient<Database>(URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function seedLocales() {
  console.log("• branch list");
  const { error } = await db
    .from("locales")
    .upsert(LOCALES.map((l) => ({ id: l.id, name: l.name })));
  if (error) throw error;
}

async function grantQmdRole() {
  if (!QMD_EMAIL) {
    console.log(
      "• QMD role: SEED_QMD_EMAIL not set — skipping.\n" +
        "  Create the QMD user in Supabase (Authentication -> Users), then set\n" +
        "  SEED_QMD_EMAIL=that-email in .env.local and re-run `npm run seed`.",
    );
    return;
  }
  const user = await findUserByEmail(QMD_EMAIL);
  if (!user) {
    console.log(
      `• QMD role: no Supabase user found for ${QMD_EMAIL}.\n` +
        "  Create it under Authentication -> Users in the Supabase dashboard,\n" +
        "  then re-run `npm run seed`.",
    );
    return;
  }
  const { error } = await db
    .from("profiles")
    .upsert({ id: user.id, role: "QMD", full_name: "QMD Administrator" });
  if (error) throw error;
  console.log(`• QMD role granted to ${QMD_EMAIL}`);
}

async function seedDemoData(client: SupabaseClient<Database>) {
  const { count, error: countErr } = await client
    .from("capa_plans")
    .select("id", { count: "exact", head: true });
  if (countErr) throw countErr;

  if ((count ?? 0) > 0 && !FORCE_DATA) {
    console.log(
      `• demo data: ${count} plans already exist — skipping (use --force-data)`,
    );
    return;
  }
  if ((count ?? 0) > 0) {
    console.log("• demo data: wiping existing plans/months");
    await client
      .from("capa_plans")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await client
      .from("months")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const data = makeSeedData();

  console.log(`• months (${data.months.length})`);
  const monthIdMap = new Map<string, string>();
  for (const m of data.months) {
    const { data: row, error } = await client
      .from("months")
      .insert({
        locale_id: m.localeId,
        year: m.year,
        month_num: m.monthNum,
        label: m.label,
      })
      .select("id")
      .single();
    if (error) throw error;
    monthIdMap.set(m.id, row.id);
  }

  console.log(`• plans (${data.plans.length})`);
  for (const p of data.plans) {
    const { data: planRow, error: planErr } = await client
      .from("capa_plans")
      .insert({
        capa_id: p.capaId,
        locale_id: p.localeId,
        month_id: monthIdMap.get(p.monthId)!,
        year: p.year,
        month_num: p.monthNum,
        department: p.department,
        date_created: p.dateCreated,
        source: p.source,
        prepared_by: p.preparedBy,
        stage: p.stage,
        submitted_date: p.submittedDate,
        archived: p.archived,
        verification: p.verification,
      })
      .select("id")
      .single();
    if (planErr) throw planErr;

    for (const s of p.sets) {
      const { data: setRow, error: setErr } = await client
        .from("capa_sets")
        .insert({
          plan_id: planRow.id,
          set_number: s.setNumber,
          set_code: s.setCode,
          archived: s.archived,
          issue: s.issue,
          six_m: s.sixM,
          vital_causes: s.vitalCauses,
          five_whys: s.fiveWhys,
        })
        .select("id")
        .single();
      if (setErr) throw setErr;

      if (s.actionItems.length) {
        const { error: aiErr } = await client.from("action_items").insert(
          s.actionItems.map((a, i) => ({
            set_id: setRow.id,
            corrective_action: a.correctiveAction,
            preventive_action: a.preventiveAction,
            responsible_person: a.responsiblePerson,
            target_date: a.targetDate,
            status: a.status,
            date_completed: a.dateCompleted,
            verification: a.verification,
            remarks: a.remarks,
            order_index: i,
          })),
        );
        if (aiErr) throw aiErr;
      }
    }
  }
}

async function main() {
  console.log(`Seeding ${URL}`);
  await seedLocales();
  await grantQmdRole();
  await seedDemoData(db);
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
