/**
 * Original icons in Lucide's visual grammar (24px grid, 2px round strokes) for
 * mobility aids Lucide doesn't cover. Decorative: always paired with a text label.
 */
type IconProps = React.SVGProps<SVGSVGElement> & { size?: number | string };

function Base({ size = 24, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ScooterIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 15h10l3.5-9H20" />
      <path d="M8 15V10h4" />
      <circle cx="6.5" cy="18.5" r="2" />
      <circle cx="16.5" cy="18.5" r="2" />
    </Base>
  );
}

export function WalkerIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 4h10" />
      <path d="M8 4 6 19" />
      <path d="M16 4l2 15" />
      <path d="M7.2 11h9.6" />
      <circle cx="6" cy="20.5" r="1.2" />
      <circle cx="18" cy="20.5" r="1.2" />
    </Base>
  );
}

export function CaneIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 7a3 3 0 0 1 6 0v15" />
      <path d="M9 7v1.5" />
    </Base>
  );
}

/** Winter: a snowflake inside a path tile — used for snow/ice markers. */
export function SnowPathIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3v18" />
      <path d="m8 5 4 3 4-3" />
      <path d="m8 19 4-3 4 3" />
      <path d="M4.2 7.5 19.8 16.5" />
      <path d="M19.8 7.5 4.2 16.5" />
    </Base>
  );
}

export function CurbRampIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 17h5l8-6h5" />
      <path d="M3 20h18" />
    </Base>
  );
}
