import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AppHeader } from "@/components/site/app-header";
import { SettingsPage } from "@/components/settings/settings-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("settings"))("title") };
}

export default function Page() {
  return (
    <>
      <AppHeader />
      <Suspense>
        <SettingsPage />
      </Suspense>
    </>
  );
}
