import { useFormatter, useTranslations } from "next-intl";

export function useRouteFormat() {
  const t = useTranslations("common");
  const format = useFormatter();
  return {
    // Walking distances: nearest 5 m below a kilometre, one decimal above. Finer is false precision.
    distance: (m: number) => (m >= 1000 ? t("km", { value: m / 1000 }) : t("m", { value: Math.max(5, Math.round(m / 5) * 5) })),
    minutes: (s: number) => t("minutes", { value: Math.max(1, Math.round(s / 60)) }),
    date: (iso: string | null) => (iso ? format.dateTime(new Date(`${iso}T12:00:00`), { dateStyle: "medium" }) : t("notObserved")),
  };
}
