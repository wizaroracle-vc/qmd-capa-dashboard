import { requireQmd } from "@/lib/auth";
import { getScopedData } from "@/lib/capa";
import { ObservationPanel } from "@/components/observation-panel";

export default async function ObservationPanelPage() {
  await requireQmd();
  const data = await getScopedData();
  return <ObservationPanel data={data} />;
}
