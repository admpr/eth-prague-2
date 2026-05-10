"use client";

import { motion } from "framer-motion";

export function HardwareWalletArt({ className }: { className?: string }) {
  return (
    <div className={`relative ${className ?? ""}`} aria-hidden>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative mx-auto aspect-[4/5] w-full max-w-[26rem]"
      >
        {/* Crosshair frame markers */}
        <CornerTick className="left-0 top-0" />
        <CornerTick className="right-0 top-0 rotate-90" />
        <CornerTick className="left-0 bottom-0 -rotate-90" />
        <CornerTick className="right-0 bottom-0 rotate-180" />

        {/* Soft pink wash behind device — single, no rotation */}
        <div className="absolute inset-x-8 top-8 bottom-12 rounded-[2.5rem] bg-primary/[0.08]" />

        {/* Device body */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-[88%] w-[58%] rounded-[2rem] border border-white/10 bg-[#0d0d10] p-3 shadow-[0_60px_120px_-30px_rgba(0,0,0,0.85)]">
            <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/[0.04]" />
            {/* Screen */}
            <div className="relative h-[60%] w-full overflow-hidden rounded-[1.4rem] bg-black">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(236,72,153,0.16),transparent_42%)]" />
              <div className="absolute left-2 right-2 top-2 flex justify-between text-[0.5rem] font-mono uppercase tracking-[0.22em] text-white/40">
                <span>FW.4.2.1</span>
                <span>TX REVIEW</span>
              </div>
              <div className="relative flex h-full flex-col px-4 pb-4 pt-9 text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div>
                    <div className="font-mono text-[0.47rem] uppercase tracking-[0.22em] text-white/45">
                      ADD AGENT
                    </div>
                    <div className="mt-1 text-[1.05rem] font-medium leading-none text-white">
                      Name: Robert
                    </div>
                  </div>
                  <span className="h-7 w-7 rounded-full border border-primary/35 bg-primary/10 text-center font-mono text-[0.72rem] leading-7 text-primary">
                    R
                  </span>
                </div>

                <div className="mt-3 rounded-md border border-white/10 bg-white/[0.035] p-2.5 shadow-[0_0_30px_-18px_rgba(236,72,153,0.8)]">
                  <div className="font-mono text-[0.45rem] uppercase tracking-[0.2em] text-white/45">
                    Permission
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[0.58rem] leading-snug text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(236,72,153,0.9)]" />
                    <span>Spend up to $500/day</span>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-center gap-1.5 rounded-sm border border-emerald-400/20 bg-emerald-400/10 px-2 py-1.5 text-[0.48rem]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="font-mono uppercase tracking-[0.18em] text-emerald-200/80">
                    Sign transaction
                  </span>
                </div>
              </div>
            </div>
            {/* Buttons */}
            <div className="mt-5 flex justify-around px-3">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="h-2 w-7 rounded-sm bg-zinc-700" />
              ))}
            </div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[0.45rem] uppercase tracking-[0.4em] text-white/25">
              hardware wallet
            </div>
          </div>
        </div>

        {/* Floating agent identifiers */}
        {[
          { x: "-6%", y: "12%", delay: 0, label: "AGT.01", role: "stablecoin" },
          { x: "78%", y: "22%", delay: 0.6, label: "AGT.02", role: "rebalancer" },
          { x: "-8%", y: "62%", delay: 1.2, label: "AGT.03", role: "claims" },
          { x: "80%", y: "70%", delay: 1.8, label: "AGT.04", role: "treasury" },
        ].map((orb) => (
          <motion.div
            key={orb.label}
            className="absolute"
            style={{ left: orb.x, top: orb.y }}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0, y: [0, -6, 0] }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: orb.delay,
            }}
          >
            <div className="flex flex-col gap-0.5 border border-border/80 bg-background/85 px-2.5 py-1.5 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="font-mono text-[0.6rem] tracking-[0.14em] text-foreground">
                  {orb.label}
                </span>
              </div>
              <span className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-muted-foreground">
                {orb.role}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function CornerTick({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute h-4 w-4 ${className}`}
      style={{
        borderLeft: "1px solid hsl(var(--primary))",
        borderTop: "1px solid hsl(var(--primary))",
      }}
    />
  );
}
