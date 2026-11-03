import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Planner } from "@/components/planner/planner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("planner");
  return { title: t("title") };
}

/** The planner's shape before its code arrives: map ground plus the panel outline. */
function PlannerSkeleton() {
  return (
    <div className="pa-planner-skeleton" aria-busy="true">
      <div>
        <span />
        <span />
        <span className="card" />
        <span className="card" />
      </div>
    </div>
  );
}

export default function NavigatePage() {
  return (
    <Suspense fallback={<PlannerSkeleton />}>
      <Planner />
    </Suspense>
  );
}
