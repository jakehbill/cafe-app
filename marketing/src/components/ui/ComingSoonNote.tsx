"use client";

import { motion, useReducedMotion } from "framer-motion";

type ComingSoonNoteProps = {
  className?: string;
  /** Lighter ink for dark backgrounds */
  onDark?: boolean;
  delay?: number;
  /** Hero: animate on mount. Footer: animate when scrolled into view. */
  when?: "mount" | "view";
};

/**
 * Playful handwritten aside under primary CTAs.
 * Low visual weight — never competes with the buttons above.
 */
export function ComingSoonNote({
  className = "",
  onDark = false,
  delay = 0.85,
  when = "mount",
}: ComingSoonNoteProps) {
  const reduceMotion = useReducedMotion();

  const motionProps =
    when === "view"
      ? {
          initial: reduceMotion ? false : { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: { once: true, margin: "-8% 0px" },
        }
      : {
          initial: reduceMotion ? false : { opacity: 0 },
          animate: { opacity: 1 },
        };

  return (
    <motion.p
      className={`note-float font-hand text-[1.05rem] leading-none tracking-wide sm:text-[1.15rem] ${
        onDark ? "text-paper/55" : "text-brown/70"
      } ${className}`}
      {...motionProps}
      transition={{ duration: 1, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      (mobile app coming soon :)
    </motion.p>
  );
}
