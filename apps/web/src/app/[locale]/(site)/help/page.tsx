import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { HelpSearch } from "@/components/pages/help-search";
import { HELP } from "@/content/help";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("help"))("title") };
}

export default async function HelpPage() {
  const t = await getTranslations("help");
  const locale = (await getLocale()) as keyof typeof HELP;
  return (
    <article className="pa-container py-12">
      <div className="pa-prose">
        <h1 className="text-xl">{t("title")}</h1>
        <p className="mt-4 text-md">{t("lede")}</p>
      </div>
      <HelpSearch faqs={HELP[locale]} />
    </article>
  );
}
