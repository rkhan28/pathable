"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CommandPalette = dynamic(() => import("./command-palette").then((m) => m.CommandPalette), { ssr: false });

export const openCommandPalette = () => window.dispatchEvent(new Event("pathable:command"));

/** Registers the ⌘K / Ctrl+K shortcut; the palette itself (cmdk + dialog) loads on first use. */
export function CommandPaletteHost() {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    const show = () => {
      setRequested(true);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setRequested(true);
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pathable:command", show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pathable:command", show);
    };
  }, []);
  return requested ? <CommandPalette open={open} setOpen={setOpen} /> : null;
}
