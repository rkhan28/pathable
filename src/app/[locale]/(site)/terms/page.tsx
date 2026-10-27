import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Callout } from "@/components/ui/feedback";
import { ContentPage, ContentSection } from "@/features/content/content-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("terms") };
}

const SECTIONS = ["preview", "judgement", "reports", "data"] as const;

export default async function TermsPage() {
  const t = await getTranslations("pages.terms");
  return (
    <ContentPage title={t("title")} lede={t("lede")} notice={<Callout tone="warning" role="note">{t("draftNotice")}</Callout>}>
      {SECTIONS.map((s) => (
        <ContentSection key={s} id={s} title={t(`sections.${s}.title`)}><p>{t(`sections.${s}.body`)}</p></ContentSection>
      ))}
    </ContentPage>
  );
}
