"use client";

import { SITE_SHELL_CLASS } from "@/components/layout/siteLayout";
import {
  CHAPTER_HEADING_CLASS,
  SECTION_Y_CLASS,
} from "@/components/layout/typography";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import Image from "next/image";

const notes = [
  {
    place: "Knees Up",
    area: "East London",
    line: "Outdoor seating, excellent Wi‑Fi, and specialty coffee worth lingering over. A full afternoon outside, done properly.",
  },
  {
    place: "The Hoxton",
    area: "Shoreditch",
    line: "Ample seating, reliable Wi‑Fi, and a welcome that lasts. One of East London's best hotel lobbies to work from.",
  },
  {
    place: "Wellcome Library",
    area: "Central London",
    line: "A quiet hidden gem most people walk past. Excellent Wi‑Fi, deep focus, and the calm of an underrated workspace.",
  },
] as const;

export function CommunitySection() {
  return (
    <section
      id="community"
      aria-labelledby="community-heading"
      className="bg-paper-mute/60 text-ink"
    >
      <div className={`${SITE_SHELL_CLASS} ${SECTION_Y_CLASS}`}>
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-5">
            <div className="relative aspect-[5/4] overflow-hidden sm:aspect-[5/4] lg:aspect-[3/4]">
              <Image
                src="/cities/london.jpg"
                alt="London cityscape"
                fill
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover object-[center_35%]"
              />
            </div>
          </Reveal>

          <div className="flex flex-col justify-center lg:col-span-7">
            <Reveal>
              <p className="mb-3 font-sans text-[0.65rem] font-medium uppercase tracking-[0.28em] text-brown sm:mb-4 sm:text-[0.7rem]">
                Starting in London
              </p>
              <h2 id="community-heading" className={CHAPTER_HEADING_CLASS}>
                Discovering London&apos;s best workspaces, together.
              </h2>
              <p className="mt-6 max-w-xl font-sans text-[1.05rem] leading-relaxed text-muted sm:text-lg">
                Beaned begins here. A community of people who care about where
                they work, sharing notes, photos, and picks from cafés,
                coworking spaces, and hidden corners across the city.
              </p>
              <p className="mt-4 max-w-xl font-sans text-[1.05rem] leading-relaxed text-muted sm:text-lg">
                This is just the beginning. More cities will follow. For now,
                we&apos;re building something worth belonging to in London.
              </p>
            </Reveal>

            <RevealGroup className="mt-10 grid gap-7 border-t border-border pt-8 sm:grid-cols-3 sm:gap-5">
              {notes.map((note) => (
                <RevealItem key={note.place} as="article">
                  <p className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">
                    {note.place}
                  </p>
                  <p className="mt-1.5 font-sans text-[0.65rem] font-medium uppercase tracking-[0.18em] text-brown">
                    {note.area}
                  </p>
                  <p className="mt-3.5 font-sans text-sm leading-relaxed text-muted">
                    {note.line}
                  </p>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </div>
      </div>
    </section>
  );
}
