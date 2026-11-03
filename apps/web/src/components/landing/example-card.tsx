"use client";

import { RouteCard } from "@/components/route/route-card";
import type { Route } from "@/lib/api/contracts";

/** A real route card shown as an illustration: inert, so it is never focusable. */
export function ExampleCard({ route }: { route: Route }) {
  return (
    <div inert className="pa-example-card">
      <ul>
        <RouteCard route={route} total={3} name="example" selected fixture onSelect={() => {}} onIsolate={() => {}} onDetails={() => {}} />
      </ul>
    </div>
  );
}
