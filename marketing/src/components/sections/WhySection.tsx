"use client";

import { CHAPTER_HEADING_CLASS } from "@/components/layout/typography";
import { Reveal } from "@/components/motion/Reveal";
import Image from "next/image";

/**
 * Compact full-bleed chapter: height follows content, not a tall empty image.
 */
export function WhySection() {
  return (
    <section
      id="why"
      aria-labelledby="why-heading"
      className="relative isolate overflow-hidden bg-ink text-paper"
    >
      <div className="absolute inset-0">
        <Image
          src="/why.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 bg-ink/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/75 via-ink/45 to-ink/30" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <Reveal className="max-w-3xl">
          <p className="mb-3 font-sans text-[0.65rem] font-medium uppercase tracking-[0.28em] text-paper/55 sm:mb-4 sm:text-[0.7rem]">
            Why it exists
          </p>
          <h2 id="why-heading" className={`${CHAPTER_HEADING_CLASS} text-paper`}>
            Remote work gave us freedom.
            <span className="mt-2.5 block text-paper/55 sm:mt-3">
              Finding somewhere great to work never caught up.
            </span>
          </h2>
          <p className="mt-5 max-w-md font-sans text-[0.9875rem] leading-relaxed text-paper/70 sm:mt-6 sm:text-base lg:text-lg">
            Beaned closes that gap, so you spend less time searching, and more
            time somewhere worth being.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
