import { requireQmd } from "@/lib/auth";
import { getScopedData } from "@/lib/capa";
import { QmdDashboard } from "@/components/qmd-dashboard";

export default async function QmdDashboardPage() {
  await requireQmd();
  const data = await getScopedData();
  return <QmdDashboard data={data} />;
}
