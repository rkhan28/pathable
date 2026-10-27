"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePreferences, type ThemePreference } from "./store";

export function ThemeMenu() {
  const t = useTranslations("theme");
  const theme = usePreferences((s) => s.display.theme);
  const setDisplay = usePreferences((s) => s.setDisplay);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("toggle")}>
          <SunIcon className="dark:hidden" aria-hidden="true" />
          <MoonIcon className="hidden dark:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setDisplay({ theme: v as ThemePreference })}>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon aria-hidden="true" />
            {t("system")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <SunIcon aria-hidden="true" />
            {t("light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon aria-hidden="true" />
            {t("dark")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
