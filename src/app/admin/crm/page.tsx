import type { Metadata } from "next";
import { CrmDashboard } from "@/components/admin/CrmDashboard";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "CRM Operator Dashboard",
  description: "Internal lead pipeline for Core Rentals TLV operators.",
  path: "/admin/crm",
  noIndex: true,
});

export default function CrmAdminPage() {
  return <CrmDashboard />;
}
