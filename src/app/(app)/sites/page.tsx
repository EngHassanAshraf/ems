import { listSites } from "@/actions/sites";
import { SitesClient } from "@/features/sites/sites-client";

export default async function SitesPage() {
  const result = await listSites(true);
  const sites = result.success ? result.data : [];
  return <SitesClient sites={sites} />;
}
