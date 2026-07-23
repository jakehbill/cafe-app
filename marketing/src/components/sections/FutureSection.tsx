"use client";

import { SITE_SHELL_CLASS } from "@/components/layout/siteLayout";
import { CHAPTER_HEADING_CLASS } from "@/components/layout/typography";
import { Reveal } from "@/components/motion/Reveal";
import Image from "next/image";

const places = [
  { name: "Cafés", image: "/places/cafes.jpg" },
  { name: "Coworking spaces", image: "/places/coworking.jpg" },
  { name: "Hotel lobbies", image: "/places/hotels.jpg" },
  { name: "Libraries", image: "/places/libraries.jpg" },
  { name: "Gyms", image: "/places/gyms.jpg" },
  { name: "Yoga studios", image: "/places/yoga-studios.jpg" },
] as const;

export function FutureSection() {
  return (
    <section
      id="places"
      aria-labelledby="future-heading"
      className="bg-paper text-ink"
    >
      <div className={`${SITE_SHELL_CLASS} pt-10 sm:pt-12 lg:pt-16`}>
        <Reveal className="max-w-3xl">
          <p className="mb-3 font-sans text-[0.65rem] font-medium uppercase tracking-[0.28em] text-brown sm:mb-4 sm:text-[0.7rem]">
            Places to work
          </p>
          <h2 id="future-heading" className={CHAPTER_HEADING_CLASS}>
            The world is your office.
          </h2>
          <p className="mt-4 max-w-xl font-sans text-base leading-relaxed text-muted sm:mt-5 sm:text-[1.05rem] lg:text-lg">
            Today in Beaned you&apos;ll find cafés, coworking spaces, hotel
            lobbies, libraries, gyms, and yoga studios. More places, and more
            cities, will follow.
          </p>
        </Reveal>
      </div>

      <Reveal className="mt-7 sm:mt-9">
        <div
          className="flex gap-2.5 overflow-x-auto px-6 pb-10 scrollbar-none sm:gap-4 sm:px-10 sm:pb-12 lg:gap-5 lg:px-14 lg:pb-16"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {places.map((place) => (
            <article
              key={place.name}
              className="group relative aspect-[3/4] w-[min(70vw,240px)] shrink-0 overflow-hidden sm:w-[280px]"
              style={{ scrollSnapAlign: "start" }}
            >
              <Image
                src={place.image}
                alt=""
                fill
                sizes="280px"
                className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
              <h3 className="absolute bottom-5 left-5 font-sans text-sm font-medium tracking-[-0.01em] text-paper">
                {place.name}
              </h3>
            </article>
          ))}
          <div className="w-2 shrink-0" aria-hidden="true" />
        </div>
      </Reveal>
    </section>
  );
}
