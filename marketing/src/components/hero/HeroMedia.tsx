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
  alt = "A calm, design-led café with a destination board and bicycles — a place made for spending the day",
}: HeroMediaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 80]);
  const scale = useTransform(scrollYProgress, [0, 1], reduceMotion ? [1, 1] : [1.06, 1.12]);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden" aria-hidden={!alt}>
      <motion.div
        className="absolute inset-0"
        style={{ y, scale }}
        initial={reduceMotion ? false : { scale: 1.08, opacity: 0 }}
        animate={{ scale: 1.06, opacity: 1 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_40%]"
        />
      </motion.div>

      {/* Soft read overlays — atmosphere, not chrome */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/35 to-ink/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/55 via-ink/15 to-transparent" />
    </div>
  );
}
