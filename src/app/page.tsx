import { Hero } from "@/components/landing/Hero";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { SiteHeader } from "@/components/shared/SiteHeader";

export default function HomePage() {
  return (
    <main>
      <SiteHeader />
      <Hero />
      <FeatureGrid />
      <footer className="border-t border-border/50">
        <div className="container flex flex-col items-start justify-between gap-3 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 font-mono uppercase tracking-[0.18em]">
            <span className="text-foreground">Wallexa</span>
            <span className="h-px w-6 bg-border" />
            <span>Hackathon proof of concept</span>
          </div>
          <div className="font-mono uppercase tracking-[0.18em]">
            Base Sepolia · Hardware wallet required
          </div>
        </div>
      </footer>
    </main>
  );
}
