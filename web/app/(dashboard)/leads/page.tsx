import { createServiceClient } from "@/lib/supabase/server";
import { LeadsTable } from "./LeadsTable";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = await createServiceClient();
  const { data: signals } = await supabase
    .from("v_top_leads")
    .select("*")
    .order("score", { ascending: false })
    .limit(200);

  return <LeadsTable signals={signals || []} />;
}
