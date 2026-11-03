import { CloudSnow, Camera } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { HeroMap } from "@/components/landing/hero-map";
import { LandingSearch } from "@/components/landing/landing-search";
import { StatesExplorer } from "@/components/landing/states-explorer";
import { Link } from "@/i18n/navigation";
import { heroData } from "@/lib/hero-data";
import realityCheck from "@/generated/reality-check.json";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const data = heroData();
  const states = realityCheck.corridor_states_pct_length;
  const steps = (["s1", "s2", "s3", "s4"] as const).map((s) => ({ title: t(`how.${s}Title`), body: t(`how.${s}Body`) }));

  return (
    <>
      <section className="pa-hero" aria-labelledby="hero-title">
        <div className="pa-container pa-hero-grid">
          <div className="pa-hero-copy">
            <h1 id="hero-title" className="pa-display">
              {t("title")}
            </h1>
            <p className="pa-lede">{t("lede")}</p>
            <LandingSearch />
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/navigate" className="pa-link-button is-primary">
                {t("cta")}
              </Link>
              <a href="#how-it-works" className="pa-text-link">
                {t("secondary")}
              </a>
            </div>
            <p className="mt-6 text-sm text-ink-muted">
              {t("pilot")}{" "}
              <Link href="/coverage" className="pa-text-link">
                {t("coverageLink")}
              </Link>
            </p>
          </div>
          <HeroMap data={data} />
        </div>
      </section>

      <section id="how-it-works" className="pa-section" aria-labelledby="how-title">
        <div className="pa-container">
          <h2 id="how-title" className="pa-h2">
            {t("how.title")}
          </h2>
          <p className="pa-section-lede">{t("how.lede")}</p>
          <ol className="pa-steps">
            {steps.map((s) => (
              <li key={s.title} className="pa-step">
                <h3 className="text-md">{s.title}</h3>
                <p className="mt-2 text-ink-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pa-section pa-section-raised" aria-labelledby="states-title">
        <div className="pa-container">
          <h2 id="states-title" className="pa-h2">
            {t("states.title")}
          </h2>
          <p className="pa-section-lede">{t("states.lede")}</p>
          <StatesExplorer
            shares={{
              verified: states.known_accessible,
              barrier: states.known_barrier,
              unverified: states.reported_unverified,
              unknown: states.no_data,
            }}
          />
        </div>
      </section>

      <section className="pa-section" aria-labelledby="report-title">
        <div className="pa-container pa-split">
          <div>
            <h2 id="report-title" className="pa-h2">
              {t("reporting.title")}
            </h2>
            <p className="pa-section-lede">{t("reporting.body")}</p>
            <Link href="/report" className="pa-link-button mt-6">
              <Camera aria-hidden size={18} />
              {t("reporting.cta")}
            </Link>
          </div>
          <p className="pa-aside">
            {t("reporting.ai")}
          </p>
        </div>
      </section>

      <section className="pa-section pa-winter" aria-labelledby="winter-title">
        <div className="pa-container">
          <h2 id="winter-title" className="pa-h2 flex items-center gap-3">
            <CloudSnow aria-hidden size={28} className="text-winter" />
            {t("winter.title")}
          </h2>
          <p className="pa-section-lede">{t("winter.body")}</p>
        </div>
      </section>

      <section className="pa-section" aria-labelledby="trust-title">
        <div className="pa-container">
          <h2 id="trust-title" className="pa-h2">
            {t("trust.title")}
          </h2>
          <p className="pa-section-lede">{t("trust.body")}</p>
          <p className="mt-4 text-sm text-ink-muted">{t("trust.sources")}</p>
          <Link href="/coverage" className="pa-text-link mt-6 inline-block">
            {t("trust.report")}
          </Link>
        </div>
      </section>
    </>
  );
}
