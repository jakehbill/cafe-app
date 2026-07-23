"use client";

import { SITE_SHELL_CLASS } from "@/components/layout/siteLayout";
import {
  CHAPTER_HEADING_CLASS,
  SECTION_Y_CLASS,
} from "@/components/layout/typography";
import { Reveal } from "@/components/motion/Reveal";

export function ProductSection() {
  return (
    <section
      id="product"
      aria-labelledby="product-heading"
      className="bg-paper text-ink"
    >
      <div
        className={`${SITE_SHELL_CLASS} grid items-center gap-10 ${SECTION_Y_CLASS} lg:grid-cols-12 lg:gap-10`}
      >
        <Reveal className="order-2 flex justify-center lg:order-1 lg:col-span-6 lg:justify-start">
          <PhoneMock />
        </Reveal>

        <Reveal
          delay={0.08}
          className="order-1 max-w-lg lg:order-2 lg:col-span-6 lg:pl-4"
        >
          <p className="mb-4 font-sans text-[0.7rem] font-medium uppercase tracking-[0.28em] text-brown">
            The companion
          </p>
          <h2 id="product-heading" className={CHAPTER_HEADING_CLASS}>
            Open the app.
            <span className="mt-2 block text-muted">
              Find somewhere you&apos;ll enjoy spending the day.
            </span>
          </h2>
          <p className="mt-6 font-sans text-[1.05rem] leading-relaxed text-muted sm:text-lg">
            Personal picks. Places nearby. Notes from people who were there, so
            discovering your next workspace feels less like research, and more
            like a recommendation from a friend.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function PhoneMock() {
  return (
    <div
      className="relative w-full max-w-[280px] sm:max-w-[300px]"
      aria-hidden="true"
    >
      <div className="rounded-[2.4rem] border border-border bg-ink p-[10px] shadow-[0_36px_70px_-36px_rgba(0,0,0,0.4)]">
        <div className="overflow-hidden rounded-[1.9rem] bg-paper">
          <div className="flex items-center justify-between px-5 pb-3 pt-4">
            <div className="h-2.5 w-16 rounded-full bg-ink/80" />
            <div className="h-2 w-2 rounded-full bg-ink/20" />
          </div>

          <div className="px-5 pb-2">
            <p className="font-display text-[1.45rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
              Top spaces for you
            </p>
            <p className="mt-1 font-sans text-[0.75rem] text-muted">
              London · today
            </p>
          </div>

          <div className="space-y-3 px-4 pb-5 pt-3">
            <PlaceRow
              title="Knees Up"
              meta="Café · East London"
              tone="warm"
            />
            <PlaceRow
              title="The Hoxton"
              meta="Hotel lobby · Shoreditch"
              tone="cool"
            />
            <PlaceRow
              title="Wellcome Library"
              meta="Library · Central"
              tone="warm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceRow({
  title,
  meta,
  tone,
}: {
  title: string;
  meta: string;
  tone: "warm" | "cool";
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-paper-deep/80">
      <div
        className={`h-20 ${
          tone === "warm"
            ? "bg-gradient-to-br from-[#d8cfc0] via-[#c4b5a0] to-[#8a9a7e]"
            : "bg-gradient-to-br from-[#c9d0c8] via-[#a8b5ae] to-[#5c6b66]"
        }`}
      />
      <div className="px-3.5 py-2.5">
        <p className="font-display text-[1.05rem] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </p>
        <p className="mt-0.5 font-sans text-[0.75rem] text-muted">{meta}</p>
      </div>
    </div>
  );
}
