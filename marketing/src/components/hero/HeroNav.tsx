"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

const links = [
  { href: "#places", label: "Places" },
  { href: "#about", label: "About" },
  { href: "#join", label: "Join" },
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
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 pb-4 pt-6 sm:px-10 sm:pt-8 lg:px-14">
        <Link
          href="/"
          className="font-sans text-[1.35rem] font-semibold tracking-[-0.04em] text-paper transition-opacity duration-300 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
          aria-label="Beaned home"
        >
          beaned<span className="text-paper/55">.</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-9 sm:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[0.8125rem] font-medium tracking-[0.04em] text-paper/70 transition-colors duration-300 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="#join"
          className="text-[0.8125rem] font-medium tracking-[0.04em] text-paper transition-opacity duration-300 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper sm:hidden"
        >
          Join
        </Link>
      </div>
    </motion.header>
  );
}
