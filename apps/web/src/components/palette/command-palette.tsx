"use client";

import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const PaletteDialog = dynamic(() => import("./palette-dialog"), { ssr: false });

/** ⌘K / Ctrl+K anywhere opens the palette; the dialog code loads on first use. */
export function CommandPalette({ withButton = false }: { withButton?: boolean }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setLoaded(true);
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {withButton && (
        <button
          type="button"
          className="pa-icon-button max-md:hidden"
          aria-label={t("commandPalette")}
          aria-keyshortcuts="Meta+K Control+K"
          onClick={() => {
            setLoaded(true);
            setOpen(true);
          }}
        >
          <Search aria-hidden size={20} />
        </button>
      )}
      {loaded && <PaletteDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}
