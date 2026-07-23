import { SiteFooter } from "@/components/layout/SiteFooter";
import { Hero } from "@/components/hero/Hero";
import { CommunitySection } from "@/components/sections/CommunitySection";
import { FinalCtaSection } from "@/components/sections/FinalCtaSection";
import { FutureSection } from "@/components/sections/FutureSection";
import { HowSection } from "@/components/sections/HowSection";
import { ProductSection } from "@/components/sections/ProductSection";
import { WhatIsSection } from "@/components/sections/WhatIsSection";
import { WhySection } from "@/components/sections/WhySection";

export default function Home() {
  return (
    <main>
      <Hero />
      <WhatIsSection />
      <WhySection />
      <HowSection />
      <ProductSection />
      <CommunitySection />
      <FutureSection />
      <FinalCtaSection />
      <SiteFooter />
    </main>
  );
}
