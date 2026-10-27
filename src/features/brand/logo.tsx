import { cn } from "@/lib/utils";

/**
 * The PathAble mark: a single continuous route that draws the letter "P".
 * It starts at an open origin ring, rises without a single step, and turns
 * through a generous bowl to arrive at a solid destination point.
 * No wheelchair pictogram — the mark is about the route, not a diagnosis.
 */
export const MARK_PATH = "M11 29.6V15.2C11 10.6 14.6 7 19.2 7H22a8 8 0 0 1 0 16h-1.6";

interface MarkProps extends React.SVGProps<SVGSVGElement> {
  title?: string;
}

export function PathAbleMark({ className, title, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={cn("size-8", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="11" cy="33" r="3.1" stroke="currentColor" strokeWidth="2.6" />
      <path d={MARK_PATH} stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.6" cy="23" r="3.2" className="fill-accent" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  /** Hide the wordmark and keep only the symbol. */
  markOnly?: boolean;
  label?: string;
}

export function Logo({ className, markOnly, label = "PathAble" }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-fg", className)}>
      <PathAbleMark className="size-8 shrink-0" title={markOnly ? label : undefined} />
      {markOnly ? null : (
        <span className="text-[1.3rem] leading-none font-semibold tracking-[-0.025em]" translate="no">
          Path<span className="text-accent">Able</span>
        </span>
      )}
    </span>
  );
}
