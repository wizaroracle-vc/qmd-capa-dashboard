import Link from "next/link";
import { Calendar } from "lucide-react";
import { requireLocaleAccess } from "@/lib/auth";
import { getScopedData } from "@/lib/capa";
import { BranchCapaOverview } from "@/components/branch-capa-overview";
import { CreateMonthButton } from "./create-month-button";

const sectionTitle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "var(--ink-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  margin: "22px 0 10px",
};

export default async function LocaleDashboardPage({
  params,
}: PageProps<"/locale/[localeId]">) {
  const { localeId } = await params;
  await requireLocaleAccess(localeId);

  const { months, plans } = await getScopedData();
  const branchPlans = plans.filter((p) => p.localeId === localeId && !p.archived);
  const branchMonths = months
    .filter((m) => m.localeId === localeId)
    .sort((a, b) => b.year - a.year || b.monthNum - a.monthNum);
  const years = [...new Set(branchMonths.map((m) => m.year))].sort((a, b) => b - a);
  const monthLabels = Object.fromEntries(
    branchMonths.map((m) => [m.id, m.label]),
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 60px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <div>
          <div className="capa-tag">BRANCH DASHBOARD</div>
          <div
            className="disp"
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: "var(--navy-deep)",
              marginTop: 10,
            }}
          >
            {localeId}
          </div>
        </div>
        <CreateMonthButton
          localeId={localeId}
          existing={branchMonths.map((m) => ({ year: m.year, monthNum: m.monthNum }))}
        />
      </div>

      <BranchCapaOverview plans={branchPlans} monthLabels={monthLabels} />

      <div style={sectionTitle}>Months</div>
      {branchMonths.length === 0 ? (
        <div
          style={{
            padding: 28,
            textAlign: "center",
            color: "var(--ink-faint)",
            border: "1px dashed var(--border)",
            borderRadius: 12,
          }}
        >
          No months yet. Click <strong>Create Month</strong> to start.
        </div>
      ) : (
        years.map((year) => (
          <div key={year} style={{ marginBottom: 18 }}>
            {years.length > 1 && (
              <div
                className="disp"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--navy-deep)",
                  marginBottom: 8,
                }}
              >
                {year}
              </div>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 14,
              }}
            >
              {branchMonths
                .filter((m) => m.year === year)
                .map((m) => {
                  const count = branchPlans.filter(
                    (p) => p.monthId === m.id,
                  ).length;
                  return (
                    <Link
                      key={m.id}
                      href={`/locale/${localeId}/${m.year}/${m.monthNum}`}
                      style={{
                        background: "#fff",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        padding: 18,
                        textDecoration: "none",
                        color: "inherit",
                        display: "block",
                      }}
                    >
                      <Calendar size={16} color="var(--steel)" />
                      <div
                        className="disp"
                        style={{ fontWeight: 700, fontSize: 17, marginTop: 10 }}
                      >
                        {m.label}
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "var(--ink-muted)",
                          marginTop: 4,
                        }}
                      >
                        {count} CAPA plan{count === 1 ? "" : "s"}
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
