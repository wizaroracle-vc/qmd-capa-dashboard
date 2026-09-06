import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Never prerender or cache — this must hit the database on every invocation.
export const dynamic = "force-dynamic";

/**
 * Keep-alive ping for the free-tier Supabase project.
 *
 * Supabase pauses a free project after 7 days with no activity. A Vercel Cron
 * job (see `vercel.json`) calls this daily; the one query below is enough to
 * reset the inactivity timer.
 *
 * Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` on cron
 * invocations when the `CRON_SECRET` env var is set — we require it so the
 * endpoint can't be used to spin the database by anyone else.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Anon client (no session on a cron request). RLS returns an empty result
  // without an error — the query still executes on Postgres, which is all we
  // need. A non-null `error` means the database is actually unreachable.
  const supabase = await createClient();
  const { error } = await supabase.from("locales").select("id").limit(1);

  return Response.json(
    { ok: !error, at: new Date().toISOString(), error: error?.message },
    { status: error ? 500 : 200 },
  );
}
