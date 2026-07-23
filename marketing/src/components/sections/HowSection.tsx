"use client";

import { SITE_SHELL_CLASS } from "@/components/layout/siteLayout";
import {
  CHAPTER_HEADING_CLASS,
  SECTION_Y_CLASS,
} from "@/components/layout/typography";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import Image from "next/image";

const lenses = [
  "Coffee",
  "Long stays",
  "Wi‑Fi",
  "Calls",
  "Atmosphere",
  "Comfort",
  "Natural light",
  "Focus",
] as const;

export function HowSection() {
  return (
    <section
      id="about"
      aria-labelledby="how-heading"
      className="bg-paper-deep text-ink"
    >
      <div className={`${SITE_SHELL_CLASS} ${SECTION_Y_CLASS}`}>
        <div className="grid items-stretch gap-8 lg:grid-cols-12 lg:gap-8">
          <Reveal className="relative aspect-[5/4] overflow-hidden sm:aspect-[4/3] lg:col-span-5 lg:aspect-auto lg:min-h-full">
            <Image
              src="/how.jpg"
              alt="People working together in a bright creative space"
              fill
              sizes="(max-width: 1024px) 100vw, 42vw"
              className="object-cover"
            />
          </Reveal>

          <div className="flex flex-col justify-between gap-8 lg:col-span-7 lg:gap-10 lg:pl-8 xl:pl-12">
            <Reveal delay={0.06}>
              <p className="mb-3 font-sans text-[0.65rem] font-medium uppercase tracking-[0.28em] text-brown sm:mb-4 sm:text-[0.7rem]">
                How it works
              </p>
              <h2 id="how-heading" className="sr-only">
                How Beaned works
              </h2>
              <p className={`${CHAPTER_HEADING_CLASS} text-muted`}>
                Google helps you find places.
              </p>
              <p className={`mt-3 ${CHAPTER_HEADING_CLASS}`}>
                Beaned helps you find the{" "}
                <em className="not-italic text-brown">right</em> place.
              </p>
              <p className="mt-6 max-w-md font-sans text-[1.05rem] leading-relaxed text-muted">
                We look at environments the way remote workers actually use them:
                not as pins on a map, but as somewhere you might spend the whole
                day.
              </p>
            </Reveal>

            <RevealGroup>
              <RevealItem>
                <p className="mb-4 font-sans text-[0.65rem] font-medium uppercase tracking-[0.28em] text-brown/70 sm:text-[0.7rem]">
                  Seen through the lens of work
                </p>
              </RevealItem>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 sm:gap-x-6 sm:gap-y-3">
                {lenses.map((lens) => (
                  <RevealItem key={lens} as="li">
                    <span className="font-sans text-sm font-medium tracking-[-0.01em] text-ink/80 sm:text-base">
                      {lens}
                    </span>
                  </RevealItem>
                ))}
              </ul>
            </RevealGroup>
          </div>
        </div>
      </div>
    </section>
  );
}
