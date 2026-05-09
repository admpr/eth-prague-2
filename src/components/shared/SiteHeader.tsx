import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FireflyConnectionControl } from "@/components/shared/FireflyConnectionControl";

export function SiteHeader() {
  return (
    <header className="border-b border-border/50">
      <div className="container flex items-center justify-between py-5">
        <Link href="/" className="group flex items-center gap-3">
          <span
            aria-hidden
            className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-sm"
          >
            <Image
              src="/wallexa-logo.png"
              alt=""
              width={32}
              height={32}
              className="h-full w-full object-cover"
              priority
            />
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-[0.95rem] font-semibold tracking-tight">Wallexa</span>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
              v0.1
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <FireflyConnectionControl />
          <Badge variant="muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Base Sepolia
          </Badge>
        </div>
      </div>
    </header>
  );
}
