"use client";

import { HERO_SHELL_CLASS } from "@/components/hero/heroLayout";
import { Button } from "@/components/ui/Button";
import { ComingSoonNote } from "@/components/ui/ComingSoonNote";
import { EXPLORE_HREF, JOIN_HREF } from "@/lib/links";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

export function HeroContent() {
  const reduceMotion = useReducedMotion();

  const item = {
    hidden: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease },
    },
  };

  return (
    <div className={`${HERO_SHELL_CLASS} pb-12 pt-20 sm:pb-12 sm:pt-24 lg:pb-8 lg:pt-0`}>
      <motion.div
        className="max-w-xl lg:max-w-2xl"
        initial="hidden"
        animate="show"
        transition={{
          staggerChildren: reduceMotion ? 0 : 0.1,
          delayChildren: 0.15,
        }}
      >
        <motion.h1
          variants={item}
          className="font-display text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.02em] text-paper sm:text-[3.25rem] sm:leading-[1.02] md:text-5xl lg:text-[4.5rem]"
        >
          Never wonder where to work again.
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-4 max-w-md font-sans text-base font-normal leading-relaxed text-paper/78 sm:mt-5 sm:max-w-lg sm:text-lg"
        >
          Inspiring places with great Wi‑Fi, coffee, atmosphere, and community,
          wherever life takes you.
        </motion.p>

        <motion.div variants={item} className="mt-7 sm:mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3.5">
            <Button
              href={EXPLORE_HREF}
              variant="primary"
              tone="onInk"
              className="w-full sm:w-auto"
            >
              Explore on web
            </Button>
            <Button
              href={JOIN_HREF}
              variant="secondary"
              tone="onInk"
              className="w-full sm:w-auto"
            >
              Join the community
            </Button>
          </div>
          <ComingSoonNote onDark className="mt-3.5 ml-0.5 sm:mt-4" delay={0.85} />
        </motion.div>
      </motion.div>
    </div>
  );
}
