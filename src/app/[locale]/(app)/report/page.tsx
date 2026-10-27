import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReportFlow } from "@/features/reporting/report-flow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("report") };
}

export default function ReportPage() {
  return <ReportFlow />;
}
