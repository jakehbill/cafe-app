"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";

const ease = [0.22, 1, 0.36, 1] as const;

export function HeroContent() {
  const reduceMotion = useReducedMotion();

  const item = {
    hidden: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.9, ease },
    },
  };

  return (
    <div className="relative z-10 flex h-full w-full items-end">
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-24 pt-28 sm:px-10 sm:pb-28 sm:pt-32 lg:px-14 lg:pb-32">
        <motion.div
          className="max-w-xl lg:max-w-2xl"
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: reduceMotion ? 0 : 0.12, delayChildren: 0.25 }}
        >
          <motion.p
            variants={item}
            className="mb-6 font-sans text-[1.5rem] font-semibold tracking-[-0.04em] text-paper sm:mb-7 sm:text-[1.75rem]"
            aria-hidden="true"
          >
            beaned<span className="text-paper/55">.</span>
          </motion.p>

          <motion.h1
            variants={item}
            className="font-display text-[2.65rem] leading-[1.05] tracking-[-0.02em] text-paper sm:text-[3.5rem] sm:leading-[1.02] md:text-6xl lg:text-[4.75rem]"
          >
            Never wonder where to work again.
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-md font-sans text-[1.0625rem] leading-relaxed text-paper/78 sm:mt-8 sm:max-w-lg sm:text-lg sm:leading-relaxed"
          >
            Inspiring places with great Wi‑Fi, coffee, atmosphere, and community —
            wherever life takes you.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-9 flex flex-col gap-3 sm:mt-11 sm:flex-row sm:items-center sm:gap-4"
          >
            <Button href="#places" variant="primary" className="w-full sm:w-auto">
              Explore places
            </Button>
            <Button href="#join" variant="secondary" className="w-full sm:w-auto">
              Join the community
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
