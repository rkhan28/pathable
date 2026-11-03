import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/site/app-header";
import { Onboarding } from "@/components/onboarding/onboarding";
import { previewRoute } from "@/lib/hero-data";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("onboarding"))("title") };
}

export default function Page() {
  return (
    <>
      <AppHeader />
      <Onboarding preview={previewRoute()} />
    </>
  );
}
