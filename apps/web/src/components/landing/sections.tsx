import { CloudSnow } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ScrollRegion } from "@/components/site/scroll-region";
import { Link } from "@/i18n/navigation";

const REMOVED = ["gps", "altitude", "time", "camera", "software", "thumbnail"] as const;

/** What leaves the phone, stated precisely. Backed by src/lib/photo.ts and its tests. */
export async function PhotoPrivacy() {
  const t = await getTranslations("landing.reporting");
  return (
    <div className="pa-spec-sheet">
      <h3 className="pa-spec-title">{t("removedTitle")}</h3>
      <ul className="pa-spec-list">
        {REMOVED.map((k) => (
          <li key={k} className="is-removed">
            <span aria-hidden className="pa-spec-mark">−</span>
            {t(`removed.${k}`)}
          </li>
        ))}
      </ul>
      <h3 className="pa-spec-title mt-6">{t("keptTitle")}</h3>
      <ul className="pa-spec-list">
        <li>
          <span aria-hidden className="pa-spec-mark">+</span>
          {t("kept")}
        </li>
      </ul>
      <p className="pa-spec-status">
        <span className="pa-status-dot" aria-hidden />
        <span className="font-bold">{t("aiStatus")}</span>
        <span className="text-ink-muted">{t("aiOff")}</span>
      </p>
    </div>
  );
}

/** A labelled example of how a winter report reads; there are no real ones yet. */
export async function WinterExample() {
  const t = await getTranslations("landing.winter");
  return (
    <figure className="pa-winter-example">
      <div className="pa-winter-card">
        <span className="pa-hazard-dot is-reported mt-1" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-bold">
            <CloudSnow aria-hidden size={18} className="text-winter" />
            {t("exampleKind")}
          </p>
          <p className="text-sm">{t("exampleStatus")}</p>
          <p className="text-sm text-ink-muted">{t("exampleSeen")}</p>
          <div className="mt-3">
            <p className="text-sm font-bold">{t("exampleExpires")}</p>
            <span className="pa-share-track mt-1.5" role="img" aria-label={t("freshness")}>
              <span className="pa-share-fill" style={{ inlineSize: "96%", background: "var(--winter)" }} />
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-sm text-ink-muted">{t("exampleLabel")}</figcaption>
    </figure>
  );
}

interface SourceRow {
  title: string;
  publisher: string;
  refreshed: string;
  licence: string;
}

/** The real corridor numbers and the real sources behind them. */
export async function TrustNumbers({ shares, sources }: { shares: Record<"verified" | "barrier" | "unverified" | "unknown", number>; sources: SourceRow[] }) {
  const t = await getTranslations("landing.trust");
  const ts = await getTranslations("states");
  const tc = await getTranslations("common");
  const order = ["verified", "unverified", "unknown", "barrier"] as const;
  return (
    <div className="mt-10 grid grid-cols-1 gap-10">
      <figure>
        <div className="pa-corridor-bar" aria-hidden>
          {order.map((s) => (
            <span key={s} className={`pa-corridor-part is-${s}`} style={{ flexBasis: `${shares[s]}%` }} />
          ))}
        </div>
        <figcaption className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
          {order.map((s) => (
            <span key={s} className="flex justify-between gap-3 border-t border-line-subtle pt-2">
              <span>{ts(s)}</span>
              <span className="tabular">{tc("percent", { value: shares[s] })}</span>
            </span>
          ))}
          <span className="text-ink-muted sm:col-span-4">{t("corridorLabel")}</span>
        </figcaption>
      </figure>
      <div>
        <h3 id="sources-title" className="font-bold">{t("sourcesTitle")}</h3>
        {/* On a narrow screen the table scrolls sideways; as a focusable region, keyboard users can scroll it too. */}
        <ScrollRegion labelledBy="sources-title" className="mt-3">
          <table className="pa-table">
            <thead>
              <tr>
                <th scope="col">{t("dataset")}</th>
                <th scope="col">{t("publisher")}</th>
                <th scope="col">{t("refreshed")}</th>
                <th scope="col">{t("licence")}</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((r) => (
                <tr key={r.title}>
                  <td lang="en">{r.title}</td>
                  <td>{r.publisher}</td>
                  <td className="tabular">{r.refreshed}</td>
                  <td>{r.licence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
        <Link href="/coverage" className="pa-text-link mt-6 inline-block">
          {t("report")}
        </Link>
      </div>
    </div>
  );
}
