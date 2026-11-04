"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * An inline script that runs from the server's HTML before first paint.
 *
 * During hydration React reuses the server's element, so it renders here
 * then. On any later client-side mount of the layout (switching language
 * swaps the root layout) it renders nothing: the script has already run,
 * and React would only warn that a script made on the client never executes.
 * next/script's beforeInteractive is not used because it defers inline code
 * until Next's runtime loads, which is after first paint.
 */
export function BootScript({ code }: { code: string }) {
  const fromServer = useSyncExternalStore(
    noopSubscribe,
    () => false,
    () => true,
  );
  return fromServer ? <script dangerouslySetInnerHTML={{ __html: code }} /> : null;
}
