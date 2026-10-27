export function SkipLink({ href = "#main", children }: { href?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="fixed start-3 top-3 z-[100] -translate-y-24 rounded-full bg-primary px-5 py-3 font-semibold text-primary-fg shadow-3 transition-transform focus-visible:translate-y-0"
    >
      {children}
    </a>
  );
}
