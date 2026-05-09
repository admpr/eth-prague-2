import Link from "next/link";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FireflyConnectionControl } from "@/components/shared/FireflyConnectionControl";

export function SiteHeader() {
  return (
    <header className="container flex items-center justify-between py-6">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_8px_24px_-8px_hsl(263_83%_66%/0.6)]">
          <Activity className="h-4 w-4" />
        </span>
        <span className="font-display text-lg font-semibold tracking-tight">AgentForce</span>
      </Link>
      <div className="flex items-center gap-2">
        <FireflyConnectionControl />
        <Badge variant="muted">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Base Sepolia
        </Badge>
      </div>
    </header>
  );
}
