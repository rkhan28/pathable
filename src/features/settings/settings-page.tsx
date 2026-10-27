"use client";

import { DownloadIcon, LockIcon, RotateCcwIcon, TrashIcon, UserIcon, Volume2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Callout } from "@/components/ui/feedback";
import { Label, Switch } from "@/components/ui/form-controls";
import { announce } from "@/features/a11y/announcer";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import { useTrip } from "@/features/navigation/trip-store";
import { DisplaySettings } from "@/features/preferences/display-settings";
import { PreferencesForm } from "@/features/preferences/preferences-form";
import { usePreferences } from "@/features/preferences/store";
import { MyReports } from "@/features/reporting/my-reports";
import { useReports } from "@/features/reporting/report-store";
import { useSpeech } from "@/features/routing/use-speech";
import { Link } from "@/i18n/navigation";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-border py-10 first:border-t-0 first:pt-0">
      <h2 id={`${id}-title`} className="mb-6 text-title font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const tLang = useTranslations("language");
  const tGuidance = useTranslations("directions.guidance");
  const voice = usePreferences((s) => s.display.voiceGuidance);
  const setDisplay = usePreferences((s) => s.setDisplay);
  const speech = useSpeech();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sections = [
    { id: "mobility", title: t("sections.mobility") },
    { id: "display", title: t("sections.display") },
    { id: "language", title: t("sections.language") },
    { id: "guidance", title: t("sections.guidance") },
    { id: "my-reports", title: t("sections.reports") },
    { id: "privacy", title: t("sections.privacy") },
    { id: "account", title: t("sections.account") },
  ];

  function exportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      app: "PathAble",
      preferences: usePreferences.getState().mobility,
      display: usePreferences.getState().display,
      personalNotes: usePreferences.getState().personalNotes,
      reports: useReports.getState().reports,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "pathable-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    usePreferences.getState().reset();
    useReports.getState().clear();
    useTrip.getState().clear();
    for (const key of ["pathable:preferences", "pathable:reports"]) localStorage.removeItem(key);
    sessionStorage.removeItem("pathable:trip");
    setConfirmOpen(false);
    toast.success(t("privacy.cleared"));
    announce(t("privacy.cleared"));
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:py-14 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-8 lg:self-start">
        <h1 className="font-display text-headline">{t("title")}</h1>
        <nav aria-label={t("title")} className="mt-6 hidden lg:block">
          <ul className="flex flex-col gap-1">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex min-h-10 items-center rounded-md px-3 text-fg-muted hover:bg-bg-subtle hover:text-fg">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="min-w-0">
        <p className="mb-10 flex items-center gap-2 text-lg text-fg-muted">
          <LockIcon className="size-5 shrink-0" aria-hidden="true" />
          {t("intro")}
        </p>

        <Section id="mobility" title={t("sections.mobility")}>
          <PreferencesForm />
          <Button asChild variant="ghost" className="mt-6 -ms-3">
            <Link href="/onboarding">
              <RotateCcwIcon aria-hidden="true" />
              {t("redoOnboarding")}
            </Link>
          </Button>
        </Section>

        <Section id="display" title={t("sections.display")}>
          <DisplaySettings />
        </Section>

        <Section id="language" title={t("sections.language")}>
          <div className="flex flex-wrap items-center gap-4">
            <LanguageSwitcher className="border border-border" />
            <p className="text-fg-muted">{tLang("preserved")}</p>
          </div>
        </Section>

        <Section id="guidance" title={t("sections.guidance")}>
          <div className="flex items-start justify-between gap-6">
            <div>
              <Label htmlFor="voice-guidance">{t("guidance.voice")}</Label>
              <p id="voice-guidance-hint" className="text-sm text-fg-muted">
                {t("guidance.voiceHint")}
              </p>
            </div>
            <Switch id="voice-guidance" checked={voice} onCheckedChange={(v) => setDisplay({ voiceGuidance: v })} aria-describedby="voice-guidance-hint" />
          </div>
          {speech.supported ? (
            <Button variant="secondary" className="mt-4" onClick={() => speech.speak(t("guidance.testPhrase"))}>
              <Volume2Icon aria-hidden="true" />
              {t("guidance.test")}
            </Button>
          ) : (
            <p className="mt-4 text-sm text-fg-muted">{tGuidance("voiceUnsupported")}</p>
          )}
        </Section>

        <Section id="my-reports" title={t("sections.reports")}>
          <MyReports showHeading={false} />
        </Section>

        <Section id="privacy" title={t("sections.privacy")}>
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="font-semibold">{t("privacy.location")}</h3>
              <p className="mt-1 text-fg-muted">{t("privacy.locationBody")}</p>
            </div>
            <div className="flex flex-col items-start gap-2">
              <Button variant="secondary" onClick={exportData}>
                <DownloadIcon aria-hidden="true" />
                {t("privacy.export")}
              </Button>
              <p className="text-sm text-fg-muted">{t("privacy.exportHint")}</p>
            </div>
            <div className="flex flex-col items-start gap-2">
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                <TrashIcon aria-hidden="true" />
                {t("privacy.clear")}
              </Button>
              <p className="text-sm text-fg-muted">{t("privacy.clearHint")}</p>
            </div>
            <Link href="/privacy" className="font-semibold text-accent underline underline-offset-4">
              {t("privacy.policy")}
            </Link>
          </div>
        </Section>

        <Section id="account" title={t("sections.account")}>
          <Callout tone="neutral" icon={UserIcon} title={t("account.title")}>
            {t("account.body")}
          </Callout>
        </Section>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent closeLabel={tCommon("close")} role="alertdialog">
          <DialogHeader>
            <DialogTitle>{t("privacy.clearConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("privacy.clearConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{tCommon("cancel")}</Button>
            </DialogClose>
            <Button variant="danger" onClick={clearAll}>
              {t("privacy.clearConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
