"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { Link } from "@/i18n/navigation";

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const t = useTranslations();
  return (
    <Dialog.Root>
      <Dialog.Trigger className="pa-icon-button md:hidden" aria-label={t("nav.menu")}>
        <Menu aria-hidden size={22} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="pa-overlay" />
        <Dialog.Content className="pa-drawer" aria-describedby={undefined}>
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg">{t("nav.menu")}</Dialog.Title>
            <Dialog.Close className="pa-icon-button" aria-label={t("common.close")}>
              <X aria-hidden size={22} />
            </Dialog.Close>
          </div>
          <nav aria-label={t("nav.primary")}>
            <ul className="mt-4 flex flex-col">
              {links.map((l) => (
                <li key={l.href}>
                  <Dialog.Close asChild>
                    <Link href={l.href} className="pa-drawer-link">
                      {l.label}
                    </Link>
                  </Dialog.Close>
                </li>
              ))}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
