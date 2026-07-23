"use client";

import { BeanedLogo } from "@/components/brand/BeanedLogo";
import { HERO_SHELL_CLASS } from "@/components/hero/heroLayout";
import { Button } from "@/components/ui/Button";
import { JOIN_HREF } from "@/lib/links";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

const links = [
  { href: "#what", label: "About" },
  { href: "#places", label: "Places" },
] as const;

export function HeroNav() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.header
      className="absolute inset-x-0 top-0 z-20"
      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
    >
      <div
        className={`${HERO_SHELL_CLASS} flex items-center justify-between gap-4 pb-3 pt-5 sm:pb-4 sm:pt-7`}
      >
        <BeanedLogo inverted priority />

        <div className="flex items-center gap-5 sm:gap-8">
          <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-sans text-[0.8125rem] font-medium tracking-[0.04em] text-paper/70 transition-colors duration-300 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <Button
            href={JOIN_HREF}
            variant="primary"
            tone="onInk"
            className="px-4 py-2 text-[0.8125rem] sm:px-5 sm:py-2.5"
          >
            Join
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
