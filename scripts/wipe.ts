/* ---------------------------------------------------------------------------
   Wipe CAPA data to start fresh. Run against the hosted Supabase project.

     npm run wipe -- --yes                # delete ALL CAPA plans + months
     npm run wipe -- --yes --branches     # ALSO delete every branch login + branch

   Keeps: the QMD account. Without --branches it also keeps every branch and
   its login (just clears their CAPAs / months).

   Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
   THIS IS PERMANENT — there are no backups on the free tier.
--------------------------------------------------------------------------- */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env", override: false });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const YES = process.argv.includes("--yes");
const BRANCHES = process.argv.includes("--branches");

if (!URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!YES) {
  console.error(
    "Refusing to run without confirmation. This permanently deletes data.\n" +
      "  npm run wipe -- --yes              (CAPAs + months)\n" +
      "  npm run wipe -- --yes --branches   (+ every branch login + branch)",
  );
  process.exit(1);
}

const db = createClient<Database>(URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function counts() {
  const [plans, months, locales] = await Promise.all([
    db.from("capa_plans").select("id", { count: "exact", head: true }),
    db.from("months").select("id", { count: "exact", head: true }),
    db.from("locales").select("id", { count: "exact", head: true }),
  ]);
  return {
    plans: plans.count ?? 0,
    months: months.count ?? 0,
    locales: locales.count ?? 0,
  };
}

async function main() {
  console.log(`Wiping ${URL}`);
  console.log("  before:", await counts());

  // capa_plans delete cascades -> capa_sets -> action_items
  {
    const { error } = await db.from("capa_plans").delete().neq("capa_id", "");
    if (error) throw error;
  }
  {
    const { error } = await db.from("months").delete().neq("label", "");
    if (error) throw error;
  }

  if (BRANCHES) {
    const { data: accts, error } = await db
      .from("locale_accounts")
      .select("user_id");
    if (error) throw error;
    for (const a of accts ?? []) {
      const { error } = await db.auth.admin.deleteUser(a.user_id); // cascades profiles + locale_accounts
      if (error) console.warn(`  ! ${a.user_id}: ${error.message}`);
    }
    const { error: locErr } = await db.from("locales").delete().neq("id", "");
    if (locErr) throw locErr;
    console.log(`  removed ${accts?.length ?? 0} branch logins + all branches`);
  }

  console.log("  after: ", await counts());
  console.log(
    `\nDone. ${BRANCHES ? "Branches removed." : "Branches + logins kept."} QMD account untouched.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
