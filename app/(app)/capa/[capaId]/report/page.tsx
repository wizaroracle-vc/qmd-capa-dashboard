import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireLocaleAccess } from "@/lib/auth";
import { getMonthLabel, getPlanByCapaId } from "@/lib/capa";
import { CapaReport } from "@/components/capa-report";
import { PrintButtons } from "./print-button";

export default async function CapaReportPage({
  params,
}: PageProps<"/capa/[capaId]/report">) {
  const { capaId } = await params;
  const plan = await getPlanByCapaId(capaId);
  if (!plan) notFound();
  await requireLocaleAccess(plan.localeId);
  const monthLabel = await getMonthLabel(plan.monthId);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 24px 80px" }}>
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Link
          href={`/capa/${plan.capaId}?stage=summary`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--ink-muted)",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} /> Back to summary
        </Link>
        <PrintButtons />
      </div>

      <CapaReport plan={plan} monthLabel={monthLabel} />
    </div>
  );
}
