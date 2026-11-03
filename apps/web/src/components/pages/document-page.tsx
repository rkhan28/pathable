import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PAGES, type PageId } from "@/content/pages";

export async function documentMeta(id: PageId) {
  const locale = (await getLocale()) as keyof typeof PAGES;
  return { title: PAGES[locale][id].title };
}

/** A trust page: title, date, draft notice when applicable, sections. No decoration. */
export async function DocumentPage({ id, children }: { id: PageId; children?: ReactNode }) {
  const locale = (await getLocale()) as keyof typeof PAGES;
  const t = await getTranslations("pages");
  const format = await getFormatter();
  const page = PAGES[locale][id];
  return (
    <article className="pa-container py-12">
      <div className="pa-prose">
        <h1 className="text-xl">{page.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t("updated", { date: format.dateTime(new Date(`${page.updated}T12:00:00`), { dateStyle: "long" }) })}</p>
        {page.draft && <p className="pa-notice mt-6 font-bold">{t("draft")}</p>}
        <p className="mt-6 text-md">{page.intro}</p>
        {page.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.body.length > 1 ? (
              <ul>
                {s.body.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : (
              <p>{s.body[0]}</p>
            )}
          </section>
        ))}
        {children}
      </div>
    </article>
  );
}
