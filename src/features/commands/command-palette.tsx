"use client";

import { Command } from "cmdk";
import {
  ContrastIcon,
  FileTextIcon,
  HouseIcon,
  LanguagesIcon,
  LifeBuoyIcon,
  MapIcon,
  MessageSquareWarningIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  TypeIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { MOBILITY_PROFILE_IDS } from "@/api/contracts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { announce } from "@/features/a11y/announcer";
import { PROFILE_ICONS } from "@/features/preferences/profiles";
import { TEXT_SCALES, usePreferences } from "@/features/preferences/store";
import { ENABLED_LOCALES, getLocaleDefinition, type AppLocale } from "@/i18n/locales";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * ⌘K / Ctrl+K command palette (cmdk, MIT). A power-user shortcut that also
 * helps keyboard and switch users jump anywhere without tabbing through the page.
 * Loaded lazily by CommandPaletteHost on first open.
 */
const itemClass =
  "flex min-h-11 cursor-default items-center gap-3 rounded-md px-3 text-[0.95rem] outline-none data-[selected=true]:bg-bg-subtle data-[selected=true]:text-fg [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted";
const groupClass =
  "px-1.5 pb-1.5 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-fg-muted";

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const t = useTranslations("command");
  const tNav = useTranslations("nav");
  const tProfiles = useTranslations("profiles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const display = usePreferences((s) => s.display);
  const setDisplay = usePreferences((s) => s.setDisplay);
  const setProfile = usePreferences((s) => s.setProfile);

  const run = useCallback(
    (fn: () => void, message?: string) => {
      setOpen(false);
      fn();
      if (message) announce(message);
    },
    [setOpen],
  );

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const scaleIndex = TEXT_SCALES.indexOf(display.textScale);

  const pages = [
    { href: "/", label: tNav("home"), icon: HouseIcon },
    { href: "/navigate", label: tNav("navigate"), icon: MapIcon },
    { href: "/report", label: tNav("report"), icon: MessageSquareWarningIcon },
    { href: "/settings", label: tNav("settings"), icon: SettingsIcon },
    { href: "/help", label: tNav("help"), icon: LifeBuoyIcon },
    { href: "/accessibility", label: tNav("accessibility"), icon: FileTextIcon },
    { href: "/coverage", label: tNav("coverage"), icon: FileTextIcon },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0" closeLabel={tCommon("close")}>
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("placeholder")}</DialogDescription>
        <Command label={t("title")} className="flex flex-col" loop>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <SearchIcon className="size-5 shrink-0 text-fg-muted" aria-hidden="true" />
            <Command.Input
              placeholder={t("placeholder")}
              className="min-h-14 w-full bg-transparent pe-10 text-base text-fg outline-none placeholder:text-fg-subtle"
            />
          </div>
          <Command.List className="max-h-[min(60dvh,26rem)] overflow-y-auto scrollbar-thin">
            <Command.Empty className="px-4 py-8 text-center text-fg-muted">{t("empty")}</Command.Empty>
            <Command.Group heading={t("groups.go")} className={groupClass}>
              {pages.map((p) => (
                <Command.Item key={p.href} value={`go ${p.label}`} className={itemClass} onSelect={() => run(() => router.push(p.href))}>
                  <p.icon aria-hidden="true" />
                  {p.label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading={t("groups.display")} className={groupClass}>
              <Command.Item
                value="theme"
                className={itemClass}
                onSelect={() => run(() => setDisplay({ theme: isDark ? "light" : "dark" }), isDark ? t("actions.toggleLight") : t("actions.toggleDark"))}
              >
                {isDark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
                {isDark ? t("actions.toggleLight") : t("actions.toggleDark")}
              </Command.Item>
              <Command.Item
                value="contrast"
                className={itemClass}
                onSelect={() =>
                  run(
                    () => setDisplay({ contrast: display.contrast === "high" ? "standard" : "high" }),
                    display.contrast === "high" ? t("actions.highContrastOff") : t("actions.highContrastOn"),
                  )
                }
              >
                <ContrastIcon aria-hidden="true" />
                {display.contrast === "high" ? t("actions.highContrastOff") : t("actions.highContrastOn")}
              </Command.Item>
              {scaleIndex < TEXT_SCALES.length - 1 ? (
                <Command.Item value="bigger text" className={itemClass} onSelect={() => run(() => setDisplay({ textScale: TEXT_SCALES[scaleIndex + 1] }), t("actions.biggerText"))}>
                  <TypeIcon aria-hidden="true" />
                  {t("actions.biggerText")}
                </Command.Item>
              ) : null}
              {scaleIndex > 0 ? (
                <Command.Item value="smaller text" className={itemClass} onSelect={() => run(() => setDisplay({ textScale: TEXT_SCALES[scaleIndex - 1] }), t("actions.smallerText"))}>
                  <TypeIcon aria-hidden="true" className="!size-3.5" />
                  {t("actions.smallerText")}
                </Command.Item>
              ) : null}
            </Command.Group>
            <Command.Group heading={t("groups.profile")} className={groupClass}>
              {MOBILITY_PROFILE_IDS.map((id) => {
                const Icon = PROFILE_ICONS[id];
                const name = tProfiles(`${id}.name`);
                return (
                  <Command.Item key={id} value={`profile ${name}`} className={itemClass} onSelect={() => run(() => setProfile(id), t("actions.useProfile", { profile: name }))}>
                    <Icon aria-hidden="true" />
                    {t("actions.useProfile", { profile: name })}
                  </Command.Item>
                );
              })}
            </Command.Group>
            <Command.Group heading={t("groups.language")} className={groupClass}>
              {ENABLED_LOCALES.filter((l) => l !== locale).map((code) => {
                const def = getLocaleDefinition(code)!;
                return (
                  <Command.Item
                    key={code}
                    value={`language ${def.nativeName} ${def.englishName}`}
                    className={itemClass}
                    onSelect={() =>
                      run(() =>
                        router.replace({ pathname, query: Object.fromEntries(new URLSearchParams(window.location.search)) }, { locale: code as AppLocale }),
                      )
                    }
                  >
                    <LanguagesIcon aria-hidden="true" />
                    <span lang={code}>{def.nativeName}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
