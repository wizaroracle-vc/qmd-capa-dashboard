import { notFound } from "next/navigation";
import { getSessionUser, requireLocaleAccess } from "@/lib/auth";
import { getMonthLabel, getPlanByCapaId } from "@/lib/capa";
import { CapaWorkflowEditor } from "./capa-workflow-editor";

export default async function CapaPage({
  params,
  searchParams,
}: PageProps<"/capa/[capaId]">) {
  const { capaId } = await params;
  const { stage } = await searchParams;

  const plan = await getPlanByCapaId(capaId);
  if (!plan) notFound();
  await requireLocaleAccess(plan.localeId);
  const user = await getSessionUser();

  const monthLabel = await getMonthLabel(plan.monthId);

  return (
    <CapaWorkflowEditor
      key={`${plan.id}:${plan.stage}`}
      plan={plan}
      role={user?.role === "QMD" ? "QMD" : "LOCALE"}
      monthLabel={monthLabel}
      initialStage={typeof stage === "string" ? stage : undefined}
    />
  );
}
