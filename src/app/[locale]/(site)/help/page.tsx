import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContentPage } from "@/features/content/content-page";
import { HelpCenter } from "@/features/content/help-center";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("help") };
}

export default async function HelpPage() {
  const t = await getTranslations("pages.help");
  return (
    <ContentPage title={t("title")} lede={t("lede")}>
      <HelpCenter />
    </ContentPage>
  );
}
