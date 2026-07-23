"use client";

import { HeroContent } from "@/components/hero/HeroContent";
import { HeroMedia } from "@/components/hero/HeroMedia";
import { HeroNav } from "@/components/hero/HeroNav";
import { ScrollCue } from "@/components/hero/ScrollCue";

export function Hero() {
  return (
    <section
      className="relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden lg:min-h-[88svh]"
      aria-label="Beaned introduction"
    >
      <HeroMedia />
      <HeroNav />
      <div className="relative z-10 flex flex-1 flex-col justify-end pb-2 lg:justify-center lg:pb-0 lg:pt-8">
        <HeroContent />
      </div>
      <ScrollCue />
    </section>
  );
}
