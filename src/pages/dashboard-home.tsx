import { Navigate } from "react-router-dom";
import { Dashboard } from "./local";
import { useSubmissionOverview } from "@/context/submission-overview-context";

export function DashboardHome() {
  const overview = useSubmissionOverview();
  if (overview?.loading) return <div role="status" className="h-40 animate-pulse rounded-xl bg-muted" />;
  return overview?.result?.audience === "advisor" ? <Navigate to="/dashboard/submissions" replace /> : <Dashboard />;
}
