import {
  CameraIcon,
  CheckIcon,
  CircleCheckIcon,
  EyeIcon,
  ListChecksIcon,
  ScanSearchIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { MOBILITY_PROFILE_IDS } from "@/api/contracts";
import { BlurFade } from "@/components/magic/blur-fade";
import { DotPattern } from "@/components/magic/dot-pattern";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/misc";
import { HazardBadgeIcon } from "@/features/hazards/hazard-visuals";
import { HeroRouteDemo } from "@/features/landing/hero-route-demo";
import { HeroSearch } from "@/features/landing/hero-search";
import { StatesExplorer } from "@/features/landing/states-explorer";
import { PROFILE_ICONS } from "@/features/preferences/profiles";
import { Link } from "@/i18n/navigation";

function SectionHeading({ id, kicker, title, body }: { id: string; kicker: string; title: string; body?: string }) {
  return (
    <div className="mb-12 max-w-3xl">
      <p className="mb-3 font-semibold text-accent">{kicker}</p>
      <h2 id={id} className="font-display text-headline text-fg">
        {title}
      </h2>
      {body ? <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-muted">{body}</p> : null}
    </div>
  );
}

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tProfiles = await getTranslations("profiles");
  const tFaq = await getTranslations("pages.faq");
  const tCoverage = await getTranslations("pages.coverage");
  const tHazards = await getTranslations("hazards.types");

  const steps = ["profile", "compare", "go", "report"] as const;
  const principles = ["safe", "sources", "explain", "correct"] as const;
  const inclusive = ["keyboard", "screenReader", "contrast", "text", "motion", "languages"] as const;
  const faqs = ["safe", "unknown", "sample", "profile", "winter"] as const;
  const statusRows = ["interface", "search", "map", "routing", "analysis"] as const;

  return (
    <>
      {/* HERO */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 lg:pt-20 lg:pb-28">
          <div className="flex flex-col gap-7">
            <BlurFade>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-semibold text-fg-muted">
                <span className="size-2 rounded-full bg-emerald-bright" aria-hidden="true" />
                {t("eyebrow")}
              </p>
            </BlurFade>
            {/* The headline is the LCP element, so it paints immediately with no JS-driven entrance. */}
            <h1 id="hero-title" className="font-display text-display text-fg">
              {t("headline")}
            </h1>
            <p className="max-w-xl text-xl leading-relaxed text-fg-muted">{t("lede")}</p>
            <HeroSearch />
            <p className="max-w-xl text-sm text-fg-subtle">{t("devNote")}</p>
          </div>
          <BlurFade delay={0.1} offset={16}>
            <HeroRouteDemo />
          </BlurFade>
        </div>
      </section>

      {/* HOW IT WORKS — a real sequence, so it's numbered and drawn as a route */}
      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 border-t border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading id="how-title" kicker={t("how.eyebrow")} title={t("how.title")} />
          <ol className="relative grid gap-10 md:grid-cols-4 md:gap-6">
            <span aria-hidden="true" className="absolute start-[1.35rem] top-6 bottom-6 w-1 rounded-full bg-accent/25 md:start-6 md:end-6 md:top-[1.35rem] md:bottom-auto md:h-1 md:w-auto" />
            {steps.map((step, i) => (
              <li key={step} className="relative flex gap-5 md:flex-col">
                <span
                  aria-hidden="true"
                  className={
                    i === steps.length - 1
                      ? "relative z-10 grid size-11 shrink-0 place-items-center rounded-full bg-accent font-mono text-lg font-semibold text-accent-fg ring-8 ring-surface"
                      : "relative z-10 grid size-11 shrink-0 place-items-center rounded-full border-4 border-fg bg-surface font-mono text-lg font-semibold ring-8 ring-surface"
                  }
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-title font-semibold">{t(`how.steps.${step}.title`)}</h3>
                  <p className="mt-2 leading-relaxed text-fg-muted">{t(`how.steps.${step}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PROFILES */}
      <section aria-labelledby="profiles-title" className="py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <SectionHeading id="profiles-title" kicker={t("profiles.eyebrow")} title={t("profiles.title")} body={t("profiles.body")} />
            <Button asChild size="lg" variant="secondary" className="-mt-4">
              <Link href="/onboarding">{t("profiles.cta")}</Link>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-3" aria-label={t("profiles.eyebrow")}>
            {MOBILITY_PROFILE_IDS.map((id) => {
              const Icon = PROFILE_ICONS[id];
              return (
                <li
                  key={id}
                  className="inline-flex min-h-14 items-center gap-3 rounded-full border border-border bg-surface-raised py-2 ps-2 pe-5 text-lg font-medium shadow-1"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-mint text-forest dark:text-accent">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {tProfiles(`${id}.name`)}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* FOUR STATES */}
      <section aria-labelledby="states-title" className="border-y border-border bg-bg-subtle py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading id="states-title" kicker={t("states.eyebrow")} title={t("states.title")} body={t("states.body")} />
          <StatesExplorer />
        </div>
      </section>

      {/* AI + COMMUNITY */}
      <section aria-labelledby="ai-title" className="py-24">
        <div className="mx-auto grid max-w-7xl gap-16 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionHeading id="ai-title" kicker={t("ai.eyebrow")} title={t("ai.title")} body={t("ai.body")} />
            <ol className="-mt-4 flex flex-col gap-0 rounded-xl border border-border bg-surface">
              {[
                { icon: CameraIcon, text: t("ai.point3") },
                { icon: ScanSearchIcon, text: t("ai.point1") },
                { icon: ListChecksIcon, text: t("ai.point2") },
              ].map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-start gap-4 border-b border-border p-5 last:border-b-0">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mint text-forest dark:text-accent">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="pt-2 leading-relaxed">{text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 flex items-center gap-2 text-sm text-fg-muted">
              <EyeIcon className="size-4" aria-hidden="true" />
              {t("ai.status")}
            </p>
          </div>
          <div>
            <SectionHeading id="community-title" kicker={t("community.eyebrow")} title={t("community.title")} body={t("community.body")} />
            <Button asChild size="lg" className="-mt-4">
              <Link href="/report">{t("community.cta")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* WINTER — the one full-bleed colour band */}
      <section aria-labelledby="winter-title" className="relative overflow-hidden bg-forest py-24 text-[#faf7f0]">
        <DotPattern className="text-white/10" size={22} radius={1.4} />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <div className="max-w-2xl">
            <p className="mb-3 font-semibold text-[#9fe3c2]">{t("winter.eyebrow")}</p>
            <h2 id="winter-title" className="font-display text-headline">
              {t("winter.title")}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-[#d3ddd7]">{t("winter.body")}</p>
            <p className="mt-6 border-s-4 border-[#9fe3c2] ps-4 font-semibold">{t("winter.weatherNote")}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {(
              [
                { type: "snow_blocked", label: t("winter.snow"), status: "reported" },
                { type: "ice", label: t("winter.ice"), status: "reported" },
                { type: "blocked_curb_ramp", label: t("winter.ramp"), status: "verified" },
              ] as const
            ).map((m) => (
              <li key={m.type} className="flex items-center gap-4 rounded-full bg-[#faf7f0] py-2 ps-2 pe-6 text-[#181c19] shadow-3">
                <HazardBadgeIcon hazard={{ type: m.type, status: m.status, severity: "caution" }} size="lg" />
                <span className="flex flex-col">
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-sm text-[#4a514b]">{tHazards(m.type)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* TRUST */}
      <section aria-labelledby="trust-title" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading id="trust-title" kicker={t("trust.eyebrow")} title={t("trust.title")} />
          <dl className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            {principles.map((p) => (
              <div key={p} className="border-t-2 border-fg pt-5">
                <dt className="text-title font-semibold">{t(`trust.principles.${p}.title`)}</dt>
                <dd className="mt-2 max-w-lg text-lg leading-relaxed text-fg-muted">{t(`trust.principles.${p}.body`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* INCLUSIVE */}
      <section aria-labelledby="inclusive-title" className="border-t border-border bg-surface py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionHeading id="inclusive-title" kicker={t("inclusive.eyebrow")} title={t("inclusive.title")} body={t("inclusive.body")} />
            <Button asChild variant="secondary" size="lg" className="-mt-4">
              <Link href="/accessibility">{t("inclusive.cta")}</Link>
            </Button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {inclusive.map((k) => (
              <li key={k} className="flex items-start gap-3 rounded-lg bg-bg-subtle p-4">
                <CheckIcon className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={3} aria-hidden="true" />
                <span className="font-medium">{t(`inclusive.items.${k}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className="py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <h2 id="faq-title" className="font-display text-headline">
              {t("faq.title")}
            </h2>
            <Button asChild variant="link" className="mt-4 px-0 text-lg">
              <Link href="/help">{t("faq.more")}</Link>
            </Button>
          </div>
          <Accordion type="multiple" className="border-t border-border">
            {faqs.map((f) => (
              <AccordionItem key={f} value={f}>
                <AccordionTrigger>{tFaq(`${f}.q`)}</AccordionTrigger>
                <AccordionContent>{tFaq(`${f}.a`)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* AVAILABILITY */}
      <section aria-labelledby="availability-title" className="border-t border-border bg-bg-subtle py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading id="availability-title" kicker={t("availability.eyebrow")} title={t("availability.title")} body={t("availability.body")} />
            <div className="-mt-4 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/navigate">{t("availability.tryCta")}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/coverage">{t("availability.cta")}</Link>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-surface-raised shadow-2">
            <table className="w-full text-start">
              <caption className="border-b border-border bg-surface px-5 py-4 text-start font-semibold">
                {t("availability.statusLabel")}: {t("availability.status")}
              </caption>
              <tbody>
                {statusRows.map((row) => {
                  const state = tCoverage(`rows.${row}.state`);
                  const working = row === "interface" || row === "search" || row === "map";
                  return (
                    <tr key={row} className="border-b border-border last:border-b-0">
                      <th scope="row" className="px-5 py-4 text-start font-medium">
                        {tCoverage(`rows.${row}.name`)}
                      </th>
                      <td className="px-5 py-4 text-sm">
                        <span className={working ? "inline-flex items-center gap-1.5 font-semibold text-verified" : "inline-flex items-center gap-1.5 text-fg-muted"}>
                          {working ? <CircleCheckIcon className="size-4" aria-hidden="true" /> : <span aria-hidden="true" className="size-2 rounded-full border-2 border-fg-subtle" />}
                          {state}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
