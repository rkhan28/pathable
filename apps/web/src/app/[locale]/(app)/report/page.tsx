import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/site/app-header";
import { ReportFlowClient } from "@/components/report/report-flow-client";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("report"))("title") };
}

export default function Page() {
  return (
    <>
      <AppHeader />
      <ReportFlowClient />
    </>
  );
}
