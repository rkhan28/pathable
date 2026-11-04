import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { CoveragePatterns } from "@/components/route/coverage-bar";
import { ExampleCard } from "@/components/landing/example-card";
import { GuideStory } from "@/components/landing/guide-story";
import { IntroMark } from "@/components/landing/intro";
import { LandingSearch } from "@/components/landing/landing-search";
import { ProfilePicks } from "@/components/landing/profile-picks";
import { HeroNetwork } from "@/components/landing/network/hero-network";
import { PhotoPrivacy, TrustNumbers, WinterExample } from "@/components/landing/sections";
import { StatesExplorer } from "@/components/landing/states-explorer";
import { Link } from "@/i18n/navigation";
import { Navigation, Route as RouteIcon, Search, SlidersHorizontal } from "lucide-react";

const STEP_ICONS = [SlidersHorizontal, Search, RouteIcon, Navigation];
/** Position in the hero's entrance; each item rises a beat after the one before. */
const rise = (i: number) => ({ "--i": i }) as CSSProperties;
import { RouteResponse } from "@/lib/api/contracts";
import { heroData } from "@/lib/hero-data";
import { guideData } from "@/lib/guide-data";
import { heroNetworkMeta } from "@/lib/hero-network";
import realityCheck from "@/generated/reality-check.json";
import sample from "@/generated/fixtures/routes/york-u-finch-west.json";

const PUBLISHERS: Record<string, string> = {
  "open-government-licence-toronto": "City of Toronto",
};
const LICENCE: Record<string, string> = {
  "open-government-licence-toronto": "OGL – Toronto",
};

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const data = heroData();
  const guide = guideData();
  const network = heroNetworkMeta();
  const s = realityCheck.corridor_states_pct_length;
  const shares = { verified: s.known_accessible, barrier: s.known_barrier, unverified: s.reported_unverified, unknown: s.no_data };
  const steps = (["s1", "s2", "s3", "s4"] as const).map((k) => ({ title: t(`how.${k}Title`), body: t(`how.${k}Body`) }));
  const example = RouteResponse.parse(sample.response).routes.find((r) => r.id.endsWith("-a"))!;
  const exampleLight = { ...example, segments: example.segments.slice(0, 1), geometry: example.geometry.slice(0, 2), steps: example.steps.slice(0, 2) };
  const sources = [
    { title: "OpenStreetMap (Geofabrik Ontario extract)", publisher: "OpenStreetMap contributors", refreshed: "2026-11-01", licence: "ODbL 1.0" },
    ...Object.values(realityCheck.sources)
      .filter((src) => src.title !== "Neighbourhoods" && src.title !== "Former Municipality Boundaries")
      .map((src) => ({
        title: src.resource_name.includes("Crossover") ? `${src.title}: Pedestrian Crossover` : src.title,
        publisher: PUBLISHERS[src.licence] ?? "",
        refreshed: src.last_refreshed.slice(0, 10),
        licence: LICENCE[src.licence] ?? src.licence,
      })),
    { title: "HRDEM lidar TRCA-GTA 2023 (1 m)", publisher: "Natural Resources Canada", refreshed: "2023-05-11", licence: "OGL – Canada 2.0" },
    { title: "HRDEM lidar NRCAN-GTA 2015 (1 m)", publisher: "Natural Resources Canada", refreshed: "2015-04-25", licence: "OGL – Canada 2.0" },
  ];

  return (
    <>
      <CoveragePatterns />
      <IntroMark />
      <section className="pa-hero" aria-labelledby="hero-title">
        <div className="pa-container pa-hero-grid">
          <div className="pa-hero-copy">
            <h1 id="hero-title" className="pa-display pa-rise-t" style={rise(0)}>
              {t("title")}
            </h1>
            <p className="pa-lede pa-rise" style={rise(1)}>{t("lede")}</p>
            <div className="pa-rise" style={rise(2)}>
              <LandingSearch />
            </div>
            <div className="pa-rise mt-6 flex flex-wrap items-center gap-x-6 gap-y-3" style={rise(3)}>
              <Link href="/navigate" className="pa-link-button is-primary">
                {t("cta")}
              </Link>
              <a href="#guide" className="pa-text-link">
                {t("secondary")}
              </a>
            </div>
            <div className="pa-rise mt-10" style={rise(4)}>
              <ProfilePicks />
            </div>
            <p className="pa-rise mt-6 text-sm text-ink-muted" style={rise(5)}>
              {t("pilot")}{" "}
              <Link href="/coverage" className="pa-text-link">
                {t("coverageLink")}
              </Link>
            </p>
          </div>
          <div className="pa-hero-visual pa-rise" style={rise(2)}>
            <HeroNetwork aspect={network.aspect} captions={network.captions} />
          </div>
        </div>
      </section>

      <section id="guide" className="pa-story" aria-labelledby="story-title">
        <div className="pa-container">
          <h2 id="story-title" className="pa-h2">
            {t("story.title")}
          </h2>
          <p className="pa-section-lede">{t("story.lede")}</p>
          <GuideStory data={guide} />
        </div>
      </section>

      <section id="how-it-works" className="pa-section pa-section-rule" aria-labelledby="how-title">
        <div className="pa-container pa-split-even">
          <div className="min-w-0">
            <h2 id="how-title" className="pa-h2">
              {t("how.title")}
            </h2>
            <ol className="pa-steps">
              {steps.map((st, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <li key={st.title} className="pa-step pa-reveal">
                    <span className="pa-step-icon" aria-hidden>
                      <Icon size={20} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-md">{st.title}</h3>
                      <p className="mt-1 text-ink-muted">{st.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <figure className="pa-example pa-reveal min-w-0">
            <ExampleCard route={exampleLight} />
            <figcaption className="mt-3 text-sm text-ink-muted">{t("how.exampleCaption")}</figcaption>
          </figure>
        </div>
      </section>

      <section className="pa-section pa-section-rule" aria-labelledby="states-title">
        <div className="pa-container">
          <h2 id="states-title" className="pa-h2">
            {t("states.title")}
          </h2>
          <p className="pa-section-lede">{t("states.lede")}</p>
          <div className="pa-reveal">
            <StatesExplorer shares={shares} data={data} />
          </div>
        </div>
      </section>

      <section className="pa-section pa-section-rule" aria-labelledby="report-title">
        <div className="pa-container pa-split-even">
          <div>
            <h2 id="report-title" className="pa-h2">
              {t("reporting.title")}
            </h2>
            <p className="pa-section-lede">{t("reporting.body")}</p>
            <Link href="/report" className="pa-link-button mt-8">
              {t("reporting.cta")}
            </Link>
          </div>
          <div className="pa-reveal">
            <PhotoPrivacy />
          </div>
        </div>
      </section>

      <section className="pa-section pa-section-rule" aria-labelledby="winter-title">
        <div className="pa-container pa-split-even">
          <div>
            <h2 id="winter-title" className="pa-h2">
              {t("winter.title")}
            </h2>
            <p className="pa-section-lede">{t("winter.body")}</p>
          </div>
          <div className="pa-reveal">
            <WinterExample />
          </div>
        </div>
      </section>

      <section className="pa-section pa-section-rule" aria-labelledby="trust-title">
        <div className="pa-container">
          <h2 id="trust-title" className="pa-h2">
            {t("trust.title")}
          </h2>
          <p className="pa-section-lede">{t("trust.body")}</p>
          <TrustNumbers shares={shares} sources={sources} />
        </div>
      </section>
    </>
  );
}
