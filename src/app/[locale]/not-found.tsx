import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PathAbleMark } from "@/features/brand/logo";
import { SiteHeader } from "@/features/layout/site-header";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <PathAbleMark className="size-16 text-fg-subtle" />
        <h1 className="font-display text-headline">{t("title")}</h1>
        <p className="text-lg text-fg-muted">{t("body")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/">{t("home")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/navigate">{t("navigate")}</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
