"use client";

import { motion, useReducedMotion } from "framer-motion";

export function ScrollCue() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.a
      href="#what"
      className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2 text-paper/45 transition-colors duration-300 hover:text-paper/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper sm:bottom-4 lg:bottom-5"
      aria-label="Scroll to continue"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.22em]">
        Scroll
      </span>
      <span className="relative h-6 w-px overflow-hidden bg-paper/20 sm:h-7">
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
