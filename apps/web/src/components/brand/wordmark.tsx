import { Mark } from "./mark";
import { WORDMARK_HEIGHT, WORDMARK_PATH, WORDMARK_WIDTH } from "./wordmark-path";

/** Mark plus the outlined "PathAble" wordmark; the text colour follows --ink. */
export function Wordmark({ className, title = "PathAble" }: { className?: string; title?: string }) {
  const textHeight = 22;
  const textWidth = (WORDMARK_WIDTH / WORDMARK_HEIGHT) * textHeight;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Mark width={30} height={30} />
      <svg
        viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`}
        width={textWidth}
        height={textHeight}
        role="img"
        aria-label={title}
      >
        <path d={WORDMARK_PATH} fill="var(--ink)" />
      </svg>
    </span>
  );
}
