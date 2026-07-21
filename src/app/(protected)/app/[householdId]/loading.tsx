import { RouteLoadGuard } from "@/components/route-load-guard";

export default function HouseholdLoading() {
  return <RouteLoadGuard stage="home" label="Loading household dashboard" />;
}
