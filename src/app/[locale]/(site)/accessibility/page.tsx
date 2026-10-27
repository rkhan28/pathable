import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CheckList, ContentPage, ContentSection } from "@/features/content/content-page";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("accessibility") };
}

export default async function AccessibilityPage() {
  const t = await getTranslations("pages.accessibility");
  const tNav = await getTranslations("nav");
  const done = ["semantic", "keyboard", "map", "color", "contrast", "motion", "text", "touch", "announce"] as const;
  const known = ["map", "translation", "audit"] as const;
  return (
    <ContentPage title={t("title")} lede={t("lede")}>
      <ContentSection title={t("targetTitle")}><p>{t("targetBody")}</p></ContentSection>
      <ContentSection title={t("doneTitle")}><CheckList items={done.map((k) => t(`done.${k}`))} /></ContentSection>
      <ContentSection title={t("testingTitle")}><p>{t("testingBody")}</p></ContentSection>
      <ContentSection title={t("knownTitle")}><CheckList tone="dash" items={known.map((k) => t(`known.${k}`))} /></ContentSection>
      <ContentSection title={t("feedbackTitle")}>
        <p>{t("feedbackBody")}</p>
        <Button asChild variant="secondary" className="self-start"><Link href="/contact">{tNav("contact")}</Link></Button>
      </ContentSection>
    </ContentPage>
  );
}
