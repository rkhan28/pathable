import { ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { ContentPage, ContentSection } from "@/features/content/content-page";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("contact") };
}

export default async function ContactPage() {
  const t = await getTranslations("pages.contact");
  const tNav = await getTranslations("nav");
  const tCommon = await getTranslations("common");
  return (
    <ContentPage title={t("title")} lede={t("lede")}>
      <ContentSection title={t("issuesTitle")}>
        <p>{t("issuesBody")}</p>
        {env.supportUrl ? (
          <Button asChild className="self-start">
            <a href={env.supportUrl} target="_blank" rel="noreferrer">
              {t("issuesCta")}
              <ExternalLinkIcon aria-hidden="true" />
              <span className="sr-only">{tCommon("externalLink")}</span>
            </a>
          </Button>
        ) : (
          <Callout tone="neutral">{t("noChannel")}</Callout>
        )}
      </ContentSection>
      <ContentSection title={t("responseTitle")}><p>{t("responseBody")}</p></ContentSection>
      <ContentSection title={t("barrierTitle")}>
        <p>{t("barrierBody")}</p>
        <Button asChild variant="secondary" className="self-start"><Link href="/report">{tNav("report")}</Link></Button>
      </ContentSection>
      <ContentSection title={t("cityTitle")}><p>{t("cityBody")}</p></ContentSection>
    </ContentPage>
  );
}
