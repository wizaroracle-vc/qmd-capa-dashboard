import { requireLocaleAccess } from "@/lib/auth";
import { ensureCurrentMonth, getScopedData } from "@/lib/capa";
import { BranchCapaOverview } from "@/components/branch-capa-overview";
import { BranchDashboardTop } from "@/components/branch-dashboard-top";

export default async function LocaleDashboardPage({
  params,
}: PageProps<"/locale/[localeId]">) {
  const { localeId } = await params;
  await requireLocaleAccess(localeId);

  // Current month appears automatically — no manual "Create Month" step.
  await ensureCurrentMonth(localeId);

  const { months, plans } = await getScopedData();
  const branchPlans = plans.filter((p) => p.localeId === localeId && !p.archived);
  const monthCards = months
    .filter((m) => m.localeId === localeId)
    .sort((a, b) => b.year - a.year || b.monthNum - a.monthNum)
    .map((m) => ({
      id: m.id,
      year: m.year,
      monthNum: m.monthNum,
      label: m.label,
      count: branchPlans.filter((p) => p.monthId === m.id).length,
    }));
  const monthLabels = Object.fromEntries(
    monthCards.map((m) => [m.id, m.label]),
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 60px" }}>
      <BranchDashboardTop localeId={localeId} months={monthCards} />
      <BranchCapaOverview plans={branchPlans} monthLabels={monthLabels} />
    </div>
  );
}
