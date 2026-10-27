import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("onboarding") };
}

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
