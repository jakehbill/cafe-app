"use client";

import { BeanedLogo } from "@/components/brand/BeanedLogo";
import { SITE_SHELL_CLASS } from "@/components/layout/siteLayout";
import { Button } from "@/components/ui/Button";
import { ComingSoonNote } from "@/components/ui/ComingSoonNote";
import { EXPLORE_HREF } from "@/lib/links";
import Link from "next/link";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: EXPLORE_HREF, label: "Explore" },
  { href: "#what", label: "About" },
] as const;

/**
 * Compact closing bar: brand + CTA left, nav right and vertically centered.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-paper text-ink">
      <div className={`${SITE_SHELL_CLASS} py-7 sm:py-8`}>
        <div className="flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
          <div className="max-w-xs">
            <BeanedLogo />
            <p className="mt-2.5 font-sans text-sm leading-relaxed text-muted">
              Discovering inspiring places to work.
            </p>
            <div className="mt-5">
              <Button href={EXPLORE_HREF} variant="primary" tone="onPaper">
                Explore on web
              </Button>
              <ComingSoonNote className="mt-3 ml-0.5" delay={0.1} when="view" />
            </div>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-col gap-2.5 sm:items-end"
          >
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="font-sans text-sm text-muted transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-7 font-sans text-xs tracking-wide text-muted/45">
          © {year} Beaned
        </p>
      </div>
    </footer>
  );
}
