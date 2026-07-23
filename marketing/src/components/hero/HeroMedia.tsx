"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";

type HeroMediaProps = {
  src?: string;
  alt?: string;
};

export function HeroMedia({
  src = "/hero.jpg",
  alt = "A calm, design-led café with a destination board and bicycles, a place made for spending the day",
}: HeroMediaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 40]);
  const scale = useTransform(scrollYProgress, [0, 1], reduceMotion ? [1, 1] : [1.04, 1.08]);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden" aria-hidden={!alt}>
      <motion.div
        className="absolute inset-0"
        style={{ y, scale }}
        initial={reduceMotion ? false : { scale: 1.05, opacity: 0 }}
        animate={{ scale: 1.04, opacity: 1 }}
        transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="100vw"
          /* Bias crop toward lower half so the interesting frame sits behind the CTA */
          className="object-cover object-[center_58%] sm:object-[center_52%] lg:object-[center_42%]"
        />
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/45 to-ink/35" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/65 via-ink/25 to-transparent" />
    </div>
  );
}
