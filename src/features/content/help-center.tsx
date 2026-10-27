"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";

const CATEGORIES = {
  routes: ["safe", "unknown", "sample", "winter"],
  reporting: ["ai", "photos"],
  privacy: ["profile", "data"],
  access: ["keyboard", "languages"],
} as const;

type FaqKey = (typeof CATEGORIES)[keyof typeof CATEGORIES][number];

export function HelpCenter() {
  const t = useTranslations("pages.help");
  const tFaq = useTranslations("pages.faq");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const text = (k: FaqKey) => ({
    q: tFaq(`${k}.q`),
    a: k === "keyboard" ? tFaq("keyboard.a", { shortcut: "Ctrl/⌘ + K" }) : tFaq(`${k}.a`),
  });

  const filtered = useMemo(
    () =>
      (Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[])
        .map((cat) => ({
          cat,
          items: (CATEGORIES[cat] as readonly FaqKey[]).filter((k) => {
            if (!q) return true;
            const { q: question, a } = text(k);
            return `${question} ${a}`.toLowerCase().includes(q);
          }),
        }))
        .filter((g) => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, tFaq],
  );
  const total = filtered.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="flex flex-col gap-12">
      <div role="search" className="relative max-w-xl">
        <label htmlFor="help-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <SearchIcon className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <input
          id="help-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="min-h-14 w-full rounded-full border-2 border-input bg-surface-raised ps-12 pe-5 text-lg focus-visible:border-focus focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-halo)]"
        />
        <p className="sr-only" role="status">
          {q ? (total === 0 ? t("noMatches", { query }) : `${total}`) : ""}
        </p>
      </div>

      {total === 0 ? <p className="text-lg text-fg-muted">{t("noMatches", { query })}</p> : null}

      {filtered.map(({ cat, items }) => (
        <section key={cat} aria-labelledby={`help-${cat}`}>
          <h2 id={`help-${cat}`} className="mb-2 text-title font-semibold">
            {t(`categories.${cat}`)}
          </h2>
          <Accordion type="multiple" className="border-t border-border" defaultValue={q ? items : undefined}>
            {items.map((k) => {
              const { q: question, a } = text(k);
              return (
                <AccordionItem key={k} value={k}>
                  <AccordionTrigger>{question}</AccordionTrigger>
                  <AccordionContent>{a}</AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-bg-subtle p-6">
        <p className="text-lg font-semibold">{t("contactPrompt")}</p>
        <Button asChild variant="secondary">
          <Link href="/contact">{t("contactCta")}</Link>
        </Button>
      </div>
    </div>
  );
}
