"use client";

import { SITE_SHELL_CLASS } from "@/components/layout/siteLayout";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { ComingSoonNote } from "@/components/ui/ComingSoonNote";
import { EXPLORE_HREF, JOIN_HREF } from "@/lib/links";
import Image from "next/image";

/**
 * Bookend to the hero: same impact, oversized type, immersive photo.
 */
export function FinalCtaSection() {
  return (
    <section
      id="join"
      aria-labelledby="final-cta-heading"
      className="relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden bg-ink text-paper lg:min-h-[88svh]"
    >
      <div className="absolute inset-0">
        <Image
          src="/cta.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[center_45%] sm:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/45 to-ink/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/65 via-ink/25 to-transparent" />
      </div>

      <div
        className={`relative z-10 mt-auto ${SITE_SHELL_CLASS} pb-12 pt-24 sm:pb-12 sm:pt-28 lg:pb-10`}
      >
        <Reveal className="max-w-xl lg:max-w-2xl">
          <p className="mb-4 font-sans text-[0.65rem] font-medium uppercase tracking-[0.28em] text-paper/55 sm:mb-5 sm:text-[0.7rem]">
            Begin in London
          </p>
          <h2
            id="final-cta-heading"
            className="font-display text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.02em] text-paper sm:text-[3.25rem] sm:leading-[1.02] md:text-5xl lg:text-[4.5rem]"
          >
            Your next office is waiting.
          </h2>
          <p className="mt-4 max-w-md font-sans text-base leading-relaxed text-paper/78 sm:mt-5 sm:max-w-lg sm:text-lg">
            Join the community discovering London&apos;s most inspiring places
            to work, and help shape what Beaned becomes next.
          </p>
          <div className="mt-7 sm:mt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3.5">
              <Button
                href={JOIN_HREF}
                variant="primary"
                tone="onInk"
                className="w-full sm:w-auto"
              >
                Join the community
              </Button>
              <Button
                href={EXPLORE_HREF}
                variant="secondary"
                tone="onInk"
                className="w-full sm:w-auto"
              >
                Explore on web
              </Button>
            </div>
            <ComingSoonNote
              onDark
              className="mt-3.5 ml-0.5 sm:mt-4"
              delay={0.2}
              when="view"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
