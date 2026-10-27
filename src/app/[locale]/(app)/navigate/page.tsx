import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NavigationApp } from "@/features/navigation/navigation-app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("navigate") };
}

export default function NavigatePage() {
  return <NavigationApp />;
}
