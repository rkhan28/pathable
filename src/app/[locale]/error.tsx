"use client";

import { RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center gap-5 px-6 py-20 text-center">
      <h1 className="text-headline font-semibold">{t("boundaryTitle")}</h1>
      <p className="text-lg text-fg-muted">{t("boundaryBody")}</p>
      {error.digest ? <p className="font-mono text-sm text-fg-subtle">{error.digest}</p> : null}
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RefreshCwIcon aria-hidden="true" />
          {t("boundaryRetry")}
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">{t("boundaryHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
