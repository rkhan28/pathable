"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useId, useState } from "react";
import type { Faq } from "@/content/help";

function normalise(s: string) {
  return s.toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function HelpSearch({ faqs }: { faqs: Faq[] }) {
  const t = useTranslations("help");
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const id = useId();
  const words = normalise(deferred).split(/\s+/).filter(Boolean);
  const shown = faqs.filter((f) => words.every((w) => normalise(`${f.q} ${f.a}`).includes(w)));
  return (
    <div className="mt-8">
      <label htmlFor={id} className="pa-field-label">{t("search")}</label>
      <div className="pa-combobox-field max-w-xl">
        <Search aria-hidden size={18} className="pointer-events-none absolute ms-4 text-ink-muted" />
        <input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="pa-combobox-input ps-11" aria-describedby={`${id}-count`} />
      </div>
      <p id={`${id}-count`} role="status" className="mt-2 text-sm text-ink-muted">{t("results", { count: shown.length })}</p>
      <dl className="pa-faq mt-6">
        {shown.map((f) => (
          <div key={f.q}>
            <dt className="font-bold">{f.q}</dt>
            <dd className="mt-1 text-ink-muted">{f.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
