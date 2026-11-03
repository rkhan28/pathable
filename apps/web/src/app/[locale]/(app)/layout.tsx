import type { ReactNode } from "react";

/** App surfaces (planner, onboarding, report, settings) use their own chrome. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="outline-none">
      {children}
    </main>
  );
}
