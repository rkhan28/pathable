"use client";

import { Check, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { useSearchParams } from "next/navigation";
import { LOCALES } from "@/i18n/locales";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Switching language keeps the page and query; the trip and selection live in sessionStorage. */
export function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = LOCALES.find((l) => l.code === locale)!;

  return (
    // Non-modal: a modal menu hides the rest of the page from assistive tech, including the skip link.
    <DropdownMenu.Root modal={false}>
      {/* The accessible name starts with the visible "EN" so voice control can say what it sees (WCAG 2.5.3). */}
      <DropdownMenu.Trigger className="pa-chip-button" aria-label={`${current.code.slice(0, 2).toUpperCase()}, ${t("languageLabel")}: ${current.endonym}`}>
        <Languages aria-hidden size={18} />
        <span className="max-sm:sr-only">{current.code.slice(0, 2).toUpperCase()}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="pa-menu">
          <DropdownMenu.Label className="pa-menu-label">{t("languageLabel")}</DropdownMenu.Label>
          {LOCALES.map((l) => (
            <DropdownMenu.Item
              key={l.code}
              disabled={!l.enabled}
              className="pa-menu-item"
              lang={l.code}
              dir={l.dir}
              onSelect={() => {
                const query = Object.fromEntries(params.entries());
                router.replace({ pathname, query }, { locale: l.code, scroll: false });
              }}
            >
              <span>{l.endonym}</span>
              {l.code === locale && <Check aria-hidden size={16} />}
              {!l.enabled && (
                <span className="pa-menu-hint" lang={locale}>
                  {t("comingLater")}
                </span>
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
