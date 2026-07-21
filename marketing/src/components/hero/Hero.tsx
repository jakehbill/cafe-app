"use client";

import { HeroContent } from "@/components/hero/HeroContent";
import { HeroMedia } from "@/components/hero/HeroMedia";
import { HeroNav } from "@/components/hero/HeroNav";
import { ScrollCue } from "@/components/hero/ScrollCue";

export function Hero() {
  return (
    <section
      className="relative isolate min-h-[100svh] w-full overflow-hidden"
      aria-label="Beaned introduction"
    >
      <HeroMedia />
      <HeroNav />
      <HeroContent />
      <ScrollCue />
    </section>
  );
}
