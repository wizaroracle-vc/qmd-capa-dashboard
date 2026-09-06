import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireLocaleAccess } from "@/lib/auth";
import { getScopedData } from "@/lib/capa";
import { DEPARTMENTS, pad } from "@/lib/capa-logic";
import { HeaderTitle } from "@/components/header-title";
import { CreateCapaButton } from "./create-capa-button";
import { PlanCard } from "./plan-card";

export default async function MonthDashboardPage({
  params,
}: PageProps<"/locale/[localeId]/[year]/[month]">) {
  const { localeId, year, month } = await params;
  await requireLocaleAccess(localeId);

  const yearNum = Number(year);
  const monthNum = Number(month);
  const { months, plans } = await getScopedData();
  const monthRec = months.find(
    (m) =>
      m.localeId === localeId &&
      m.year === yearNum &&
      m.monthNum === monthNum,
  );
  if (!monthRec) notFound();

  const monthPlans = plans.filter(
    (p) => p.monthId === monthRec.id && !p.archived,
  );
  const previewId = `CAPA-${localeId}-${yearNum}-${pad(monthNum)}-${pad(
    monthPlans.length + 1,
    3,
  )}`;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 60px" }}>
      <Link
        href={`/locale/${localeId}`}
        style={{
          background: "none",
          border: "none",
          color: "var(--ink-muted)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          marginBottom: 12,
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={14} /> Back to {localeId} Dashboard
      </Link>
      <HeaderTitle
        tag="MONTHLY CAPA VIEW"
        meta={`${localeId} · ${monthRec.label}`}
      />

      <div
        style={{
          borderBottom: "1px solid var(--border)",
          margin: "12px 0 22px",
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {DEPARTMENTS.map((dept) => {
          const deptPlans = monthPlans.filter((p) => p.department === dept);
          return (
            <div
              key={dept}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "var(--surface-alt)",
                }}
              >
                <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>
                  {dept.toUpperCase()}
                </div>
                <CreateCapaButton
                  localeId={localeId}
                  monthId={monthRec.id}
                  monthLabel={monthRec.label}
                  department={dept}
                  previewId={previewId}
                />
              </div>
              <div style={{ padding: 10 }}>
                {deptPlans.length === 0 && (
                  <div
                    style={{
                      padding: 12,
                      fontSize: 12.5,
                      color: "var(--ink-faint)",
                      fontStyle: "italic",
                    }}
                  >
                    No CAPA plans yet.
                  </div>
                )}
                {deptPlans.map((p) => (
                  <PlanCard key={p.id} plan={p} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
