"use client";

import { motion, useReducedMotion } from "framer-motion";

export function ScrollCue() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.a
      href="#after-hero"
      className="absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-3 text-paper/55 transition-colors duration-300 hover:text-paper/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper sm:bottom-9"
      aria-label="Scroll to continue"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="text-[0.6875rem] font-medium uppercase tracking-[0.22em]">
        Scroll
      </span>
      <span className="relative h-10 w-px overflow-hidden bg-paper/20">
        <motion.span
          className="absolute inset-x-0 top-0 h-1/2 bg-paper/70"
          animate={
            reduceMotion
              ? undefined
              : {
                  y: ["-100%", "200%"],
                }
          }
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </span>
    </motion.a>
  );
}
