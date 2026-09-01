import { requireStaff } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}
