"use client";

import { LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { announce } from "@/features/a11y/announcer";
import { ENABLED_LOCALES, LOCALE_REGISTRY, type AppLocale } from "@/i18n/locales";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Switching language keeps the current page *and* its query string, and the
 * trip/preferences stores live outside the route tree, so an in-progress route
 * survives the change (verified by e2e/navigation.spec.ts).
 */
export function LanguageSwitcher({ compact = false, className }: { compact?: boolean; className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = LOCALE_REGISTRY.find((l) => l.code === locale)!;
  const unavailable = LOCALE_REGISTRY.filter((l) => !(ENABLED_LOCALES as readonly string[]).includes(l.code));

  function change(next: string) {
    if (next === locale) return;
    const query = Object.fromEntries(new URLSearchParams(window.location.search));
    const target = LOCALE_REGISTRY.find((l) => l.code === next)!;
    startTransition(() => {
      router.replace({ pathname, query }, { locale: next as AppLocale, scroll: false });
    });
    announce(target.nativeName);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "md"}
          className={cn(!compact && "px-3.5", className)}
          aria-label={compact ? `${t("change")}. ${t("current", { language: current.nativeName })}` : undefined}
          aria-busy={pending || undefined}
        >
          <LanguagesIcon aria-hidden="true" />
          {compact ? null : (
            <>
              {/* Visible text stays at the start of the accessible name (WCAG 2.5.3 Label in Name). */}
              <span lang={current.code}>{current.prefix.toUpperCase()}</span>
              <span className="sr-only">
                , {t("change")}. {t("current", { language: current.nativeName })}
              </span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={change}>
          {LOCALE_REGISTRY.filter((l) => (ENABLED_LOCALES as readonly string[]).includes(l.code)).map((l) => (
            <DropdownMenuRadioItem key={l.code} value={l.code}>
              <span lang={l.code} dir={l.dir}>
                {l.nativeName}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-sm font-normal tracking-normal normal-case">{t("unavailableNote", { count: unavailable.length })}</DropdownMenuLabel>
        <div className="max-h-56 overflow-y-auto">
          {unavailable.map((l) => (
            <DropdownMenuItem key={l.code} disabled className="min-h-9 justify-between">
              <span lang={l.code} dir={l.dir}>
                {l.nativeName}
              </span>
              <span className="text-xs">{t("planned")}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
