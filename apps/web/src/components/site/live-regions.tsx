/** Two persistent live regions; write to them with announce() from src/lib/announce.ts. */
export function LiveRegions() {
  return (
    <>
      <div id="live-polite" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div id="live-assertive" role="alert" aria-live="assertive" aria-atomic="true" className="sr-only" />
    </>
  );
}
