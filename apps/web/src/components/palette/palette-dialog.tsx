"use client";

import { Command } from "cmdk";
import { Contrast, FileText, HelpCircle, Home, Languages, Map, MoonStar, Route, Settings, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useDemoTrips } from "@/components/planner/use-demo-trips";
import { LOCALES } from "@/i18n/locales";
import { useRouter } from "@/i18n/navigation";
import { formatLonLat } from "@/lib/geo";
import { useSettings } from "@/stores/settings";

/** The palette itself. Loaded on first open so cmdk never ships with the page. */
export default function PaletteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const demoTrips = useDemoTrips();
  const settings = useSettings();

  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };
  const item = (value: string, icon: ReactNode, label: string, onSelect: () => void) => (
    <Command.Item key={value} value={value} keywords={[label]} onSelect={run(onSelect)} className="pa-palette-item">
      {icon}
      <span>{label}</span>
    </Command.Item>
  );
  const isDark = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  const isMore = typeof document !== "undefined" && document.documentElement.dataset.contrast === "more";

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={t("nav.commandPalette")}
      overlayClassName="pa-overlay"
      contentClassName="pa-palette"
      loop
    >
      <Command.Input placeholder={t("palette.placeholder")} className="pa-palette-input" />
      <Command.List className="pa-palette-list">
        <Command.Empty className="pa-palette-empty">{t("palette.empty")}</Command.Empty>
        <Command.Group heading={t("palette.groupNavigate")} className="pa-palette-group">
          {item("home", <Home aria-hidden size={18} />, t("nav.home"), () => router.push("/"))}
          {item("planner", <Map aria-hidden size={18} />, t("nav.planner"), () => router.push("/navigate"))}
          {item("report", <TriangleAlert aria-hidden size={18} />, t("nav.report"), () => router.push("/report"))}
          {item("settings", <Settings aria-hidden size={18} />, t("nav.settings"), () => router.push("/settings"))}
          {item("coverage", <FileText aria-hidden size={18} />, t("nav.coverage"), () => router.push("/coverage"))}
          {item("help", <HelpCircle aria-hidden size={18} />, t("nav.help"), () => router.push("/help"))}
        </Command.Group>
        {demoTrips.length > 0 && (
          <Command.Group heading={t("search.demoTrips")} className="pa-palette-group">
            {demoTrips.map((trip) =>
              item(`trip-${trip.id}`, <Route aria-hidden size={18} />, trip.label, () =>
                router.push({ pathname: "/navigate", query: { from: formatLonLat(trip.origin.position), to: formatLonLat(trip.destination.position) } }),
              ),
            )}
          </Command.Group>
        )}
        <Command.Group heading={t("palette.groupActions")} className="pa-palette-group">
          {item("theme", <MoonStar aria-hidden size={18} />, t("palette.toggleTheme"), () => settings.set({ theme: isDark ? "light" : "dark" }))}
          {item("contrast", <Contrast aria-hidden size={18} />, t("palette.toggleContrast"), () => settings.set({ contrast: isMore ? "normal" : "more" }))}
          {LOCALES.filter((l) => l.enabled && l.code !== locale).map((l) =>
            item(`lang-${l.code}`, <Languages aria-hidden size={18} />, l.endonym, () => {
              const query = Object.fromEntries(new URLSearchParams(window.location.search).entries());
              router.replace({ pathname: window.location.pathname.replace(/^\/[^/]+/, "") || "/", query }, { locale: l.code });
            }),
          )}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
