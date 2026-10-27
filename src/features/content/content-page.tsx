import { cn } from "@/lib/utils";

/** Shared layout for trust & support pages: readable measure, clear hierarchy. */
export function ContentPage({ title, lede, notice, children, wide = false }: { title: string; lede?: string; notice?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <article className={cn("mx-auto px-4 py-14 sm:px-6 sm:py-20", wide ? "max-w-5xl" : "max-w-3xl")}>
      <header className="mb-12">
        <h1 className="font-display text-headline">{title}</h1>
        {lede ? <p className="mt-4 max-w-2xl text-xl leading-relaxed text-fg-muted">{lede}</p> : null}
        {notice ? <div className="mt-8">{notice}</div> : null}
      </header>
      <div className="flex flex-col gap-12">{children}</div>
    </article>
  );
}

export function ContentSection({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined} className="flex flex-col gap-3">
      <h2 id={id ? `${id}-title` : undefined} className="text-title font-semibold">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-lg leading-relaxed text-fg-muted">{children}</div>
    </section>
  );
}

export function CheckList({ items, tone = "check" }: { items: string[]; tone?: "check" | "dash" }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden="true" className={cn("mt-2.5 size-2 shrink-0 rounded-full", tone === "check" ? "bg-accent" : "bg-fg-subtle")} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
