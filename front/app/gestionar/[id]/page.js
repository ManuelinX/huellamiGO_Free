import { ManageReportPageClient } from "@/components/manage-report-page-client";

export const dynamic = "force-dynamic";

export default async function ManageReportPage({ params }) {
  const { id } = await params;

  return <ManageReportPageClient reportId={id} />;
}
