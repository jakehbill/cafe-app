"use client";

import { SITE_SHELL_CLASS } from "@/components/layout/siteLayout";
import {
  CHAPTER_HEADING_CLASS,
  SECTION_Y_CLASS,
} from "@/components/layout/typography";
import { Reveal } from "@/components/motion/Reveal";
import Image from "next/image";

export function WhatIsSection() {
  return (
    <section
      id="what"
      aria-labelledby="what-heading"
      className="bg-paper text-ink"
    >
      <div
        className={`${SITE_SHELL_CLASS} grid items-center gap-8 ${SECTION_Y_CLASS} sm:gap-10 lg:grid-cols-12 lg:gap-12`}
      >
        <Reveal className="lg:col-span-5">
          <p className="mb-3 font-sans text-[0.65rem] font-medium uppercase tracking-[0.28em] text-brown sm:mb-4 sm:text-[0.7rem]">
            What is Beaned?
          </p>
          <h2 id="what-heading" className={CHAPTER_HEADING_CLASS}>
            An app that helps remote workers discover great places to work.
          </h2>
          <div className="mt-5 space-y-4 font-sans text-base leading-relaxed text-muted sm:mt-6 sm:text-[1.05rem] lg:text-lg">
            <p>Today, that means cafés and coworking spaces.</p>
            <p>
              Soon, it becomes home for entrepreneurs, freelancers, digital
              nomads, creators, and remote workers who want to work from places
              that inspire them.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="relative lg:col-span-7">
          <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[5/4] lg:aspect-[4/3]">
            <Image
              src="/what-is.jpg"
              alt="A calm café interior ready for a day of work"
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover object-center"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-sans text-[0.7rem] font-medium uppercase tracking-[0.18em] text-brown/80">
            <span>Cafés</span>
            <span>Coworking</span>
            <span>And beyond</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
