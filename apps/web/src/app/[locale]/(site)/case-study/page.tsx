import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Fragment } from "react";
import { CASE_STUDY } from "@/content/case-study";

export const metadata: Metadata = { title: "Case study" };

/** Mirrors docs/CASE_STUDY.md. Written in English; French readers are told so. */
export default async function CaseStudyPage() {
  const locale = await getLocale();
  return (
    <article className="pa-container py-12" lang="en">
      <div className="pa-prose">
        {locale !== "en-CA" && (
          <p className="pa-notice mb-6" lang={locale}>
            Cette étude de cas est rédigée en anglais.
          </p>
        )}
        {CASE_STUDY.map((b, i) => (
          <Fragment key={i}>
            {b.t === "h1" && <h1 className="text-xl">{b.text}</h1>}
            {b.t === "h2" && <h2>{b.text}</h2>}
            {b.t === "p" && <p>{b.text.replaceAll("**", "")}</p>}
            {b.t === "ul" && (
              <ul>
                {b.items.map((item) => (
                  <li key={item}>{item.replaceAll("**", "")}</li>
                ))}
              </ul>
            )}
          </Fragment>
        ))}
      </div>
    </article>
  );
}
