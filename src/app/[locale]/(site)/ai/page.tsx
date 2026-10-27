import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Callout } from "@/components/ui/feedback";
import { CheckList, ContentPage, ContentSection } from "@/features/content/content-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("ai") };
}

export default async function AiPage() {
  const t = await getTranslations("pages.ai");
  return (
    <ContentPage title={t("title")} lede={t("lede")} notice={<Callout tone="info" title={t("statusTitle")}>{t("statusBody")}</Callout>}>
      <ContentSection title={t("usedTitle")}><CheckList items={[t("used.photos"), t("used.triage")]} /></ContentSection>
      <ContentSection title={t("notTitle")}><CheckList tone="dash" items={[t("not.routing"), t("not.profiles"), t("not.weather")]} /></ContentSection>
      <ContentSection title={t("limitsTitle")}><CheckList tone="dash" items={[t("limits.accuracy"), t("limits.bias"), t("limits.confidence")]} /></ContentSection>
    </ContentPage>
  );
}
