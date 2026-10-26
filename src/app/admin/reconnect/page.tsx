import type { Metadata } from "next";
import { ReconnectDashboard } from "@/components/admin/ReconnectDashboard";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Customer Reconnect",
  description: "Owner-only customer reactivation dashboard.",
  path: "/admin/reconnect",
  noIndex: true,
});

export default function ReconnectAdminPage() {
  return <ReconnectDashboard />;
}
