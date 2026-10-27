import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Callout } from "@/components/ui/feedback";
import { ContentPage, ContentSection } from "@/features/content/content-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("coverage") };
}

const ROWS = ["interface", "search", "map", "routing", "hazards", "analysis", "reports"] as const;
const WORKING = new Set(["interface", "search", "map"]);

export default async function CoveragePage() {
  const t = await getTranslations("pages.coverage");
  return (
    <ContentPage title={t("title")} lede={t("lede")} wide>
      <ContentSection title={t("statusTitle")}>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-raised">
          <table className="w-full min-w-[32rem] text-start text-base">
            <thead className="bg-bg-subtle text-fg">
              <tr>
                <th scope="col" className="px-5 py-3 text-start font-semibold">{t("title")}</th>
                <th scope="col" className="px-5 py-3 text-start font-semibold">{t("stateLabel")}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const ok = WORKING.has(row);
                return (
                  <tr key={row} className="border-t border-border">
                    <th scope="row" className="px-5 py-4 text-start font-medium text-fg">{t(`rows.${row}.name`)}</th>
                    <td className="px-5 py-4">
                      <span className={ok ? "inline-flex items-center gap-2 font-semibold text-verified" : "inline-flex items-center gap-2 text-fg-muted"}>
                        {ok ? <CircleCheckIcon className="size-4" aria-hidden="true" /> : <CircleDashedIcon className="size-4" aria-hidden="true" />}
                        {t(`rows.${row}.state`)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ContentSection>
      <ContentSection title={t("areaTitle")}><p>{t("areaBody")}</p></ContentSection>
      <ContentSection title={t("dataTitle")}><p>{t("dataBody")}</p></ContentSection>
      <Callout tone="warning" title={t("notTitle")}>{t("notBody")}</Callout>
    </ContentPage>
  );
}
