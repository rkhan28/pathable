import { CircleCheck, CircleDashed, MessageCircleWarning, OctagonX, type LucideProps } from "lucide-react";
import type { KnowledgeState } from "@/lib/api/contracts";

const ICONS = { verified: CircleCheck, barrier: OctagonX, unverified: MessageCircleWarning, unknown: CircleDashed };
export const STATE_TEXT_CLASS: Record<KnowledgeState, string> = {
  verified: "text-verified",
  barrier: "text-barrier",
  unverified: "text-unverified",
  unknown: "text-unknown",
};

/** The icon half of the three-way state encoding (colour + pattern + icon/label). */
export function StateIcon({ state, ...props }: { state: KnowledgeState } & LucideProps) {
  const Icon = ICONS[state];
  return <Icon aria-hidden size={18} {...props} />;
}

/** A short line sample in the state's map pattern, for legends and cards. */
export function StateSwatch({ state, width = 40 }: { state: KnowledgeState; width?: number }) {
  const stroke = {
    verified: { color: "var(--signal)", dash: undefined, cap: "round" as const },
    barrier: { color: "var(--state-barrier)", dash: undefined, cap: "round" as const },
    unverified: { color: "var(--state-unverified)", dash: "6 4", cap: "butt" as const },
    unknown: { color: "var(--state-unknown)", dash: "0.1 6", cap: "round" as const },
  }[state];
  return (
    <svg width={width} height={12} viewBox={`0 0 ${width} 12`} aria-hidden className="shrink-0">
      <line x1={4} y1={6} x2={width - 4} y2={6} stroke={stroke.color} strokeWidth={5} strokeDasharray={stroke.dash} strokeLinecap={stroke.cap} />
      {state === "barrier" && <line x1={4} y1={6} x2={width - 4} y2={6} stroke="var(--route-casing)" strokeWidth={1.4} strokeLinecap="round" />}
    </svg>
  );
}
