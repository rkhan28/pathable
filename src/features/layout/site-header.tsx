"use client";

import { CommandIcon, MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/features/brand/logo";
import { openCommandPalette } from "@/features/commands/command-palette-host";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import { ThemeMenu } from "@/features/preferences/theme-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/navigate", key: "navigate" },
  { href: "/report", key: "report" },
  { href: "/coverage", key: "coverage" },
  { href: "/help", key: "help" },
] as const;

export function SiteHeader({ variant = "site" }: { variant?: "site" | "app" }) {
  const t = useTranslations("nav");
  const tBrand = useTranslations("brand");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        "z-40 w-full border-b border-border/70 bg-bg/85 backdrop-blur-md supports-[backdrop-filter]:bg-bg/75",
        variant === "site" ? "sticky top-0" : "relative",
      )}
    >
      <div className={cn("mx-auto flex h-16 items-center gap-2 px-4 sm:px-6", variant === "site" ? "max-w-7xl" : "max-w-none")}>
        <Link href="/" className="me-2 inline-flex min-h-11 items-center rounded-md" aria-label={tBrand("logoLabel")}>
          <Logo />
        </Link>

        <nav aria-label={t("primaryLabel")} className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className="inline-flex min-h-11 items-center rounded-full px-4 text-[0.95rem] font-medium text-fg-muted transition-colors hover:text-fg aria-[current=page]:bg-bg-subtle aria-[current=page]:font-semibold aria-[current=page]:text-fg"
                >
                  {t(l.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="md"
            className="hidden gap-2 px-3 text-fg-muted lg:inline-flex"
            onClick={openCommandPalette}
            aria-keyshortcuts="Control+K Meta+K"
          >
            <CommandIcon aria-hidden="true" />
            <span>{t("commandPalette")}</span>
            <kbd className="rounded border border-border bg-bg-subtle px-1.5 font-mono text-xs">⌘K</kbd>
          </Button>
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <ThemeMenu />
          {variant === "site" ? (
            <Button asChild size="md" className="ms-1 hidden sm:inline-flex">
              <Link href="/navigate">{t("openApp")}</Link>
            </Button>
          ) : null}

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("openMenu")}>
                <MenuIcon aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="end" closeLabel={tCommon("close")}>
              <SheetTitle>{t("menuTitle")}</SheetTitle>
              <SheetDescription className="sr-only">{tBrand("statement")}</SheetDescription>
              <nav aria-label={t("primaryLabel")}>
                <ul className="flex flex-col gap-1">
                  {[{ href: "/", key: "home" } as const, ...LINKS, { href: "/settings", key: "settings" } as const].map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={() => setMenuOpen(false)}
                        aria-current={pathname === l.href ? "page" : undefined}
                        className="flex min-h-12 items-center rounded-md px-3 text-lg font-medium hover:bg-bg-subtle aria-[current=page]:bg-bg-subtle aria-[current=page]:font-semibold"
                      >
                        {t(l.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-auto flex items-center gap-2 border-t border-border pt-4">
                <LanguageSwitcher />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
