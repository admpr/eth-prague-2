import { Hero } from "@/components/landing/Hero";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { SiteHeader } from "@/components/shared/SiteHeader";

export default function HomePage() {
  return (
    <main>
      <SiteHeader />
      <Hero />
      <FeatureGrid />
      <footer className="container border-t border-border/60 py-8 text-xs text-muted-foreground">
        Wallexa · Hackathon proof of concept · Base Sepolia only · Hardware wallet required
      </footer>
    </main>
  );
}
