import { Hero } from "@/components/hero/Hero";

export default function Home() {
  return (
    <main>
      <Hero />
      {/* Anchor for scroll cue — remaining homepage chapters come next */}
      <div id="after-hero" className="sr-only" aria-hidden="true" />
    </main>
  );
}
