import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { NotFoundView } from "@/components/pages/not-found-view";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <NotFoundView />
      </main>
      <SiteFooter />
    </div>
  );
}
