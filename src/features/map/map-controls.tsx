"use client";

import { LayersIcon, LocateFixedIcon, MaximizeIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

function ControlButton({ label, onClick, children, pressed, disabled }: { label: string; onClick: () => void; children: React.ReactNode; pressed?: boolean; disabled?: boolean }) {
  return (
    <Tooltip content={label} side="left">
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "grid size-11 place-items-center text-fg transition-colors hover:bg-bg-subtle disabled:opacity-40 [&_svg]:size-5",
          pressed && "bg-accent-soft text-accent",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** Custom map controls: large targets, real buttons, labelled, grouped as a toolbar. */
export function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  onFit,
  canFit,
  showHazards,
  onToggleHazards,
  locating,
  className,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  onFit: () => void;
  canFit: boolean;
  showHazards: boolean;
  onToggleHazards: () => void;
  locating: boolean;
  className?: string;
}) {
  const t = useTranslations("map");
  return (
    <div role="group" aria-label={t("label")} className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised shadow-3">
        <ControlButton label={t("zoomIn")} onClick={onZoomIn}>
          <PlusIcon aria-hidden="true" />
        </ControlButton>
        <ControlButton label={t("zoomOut")} onClick={onZoomOut}>
          <MinusIcon aria-hidden="true" />
        </ControlButton>
      </div>
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised shadow-3">
        <ControlButton label={t("locate")} onClick={onLocate}>
          <LocateFixedIcon className={locating ? "animate-pulse" : undefined} aria-hidden="true" />
        </ControlButton>
        <ControlButton label={t("fitRoute")} onClick={onFit} disabled={!canFit}>
          <MaximizeIcon aria-hidden="true" />
        </ControlButton>
        <ControlButton label={showHazards ? t("hideHazards") : t("showHazards")} onClick={onToggleHazards} pressed={showHazards}>
          <LayersIcon aria-hidden="true" />
        </ControlButton>
      </div>
    </div>
  );
}
