"use client";

import { motion } from "framer-motion";

export function HardwareWalletArt({ className }: { className?: string }) {
  return (
    <div className={`relative ${className ?? ""}`} aria-hidden>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative mx-auto aspect-[4/5] w-full max-w-sm"
      >
        {/* Halo */}
        <motion.div
          className="absolute -inset-10 rounded-[40%] bg-gradient-to-br from-primary/30 via-transparent to-accent/30 blur-3xl"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />

        {/* Device body */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-[88%] w-[58%] rounded-[2.4rem] border border-white/10 bg-gradient-to-b from-zinc-800 via-zinc-900 to-black p-3 shadow-[0_60px_120px_-30px_rgba(0,0,0,0.9)]">
            <div className="absolute inset-0 rounded-[2.4rem] ring-1 ring-inset ring-white/5" />
            {/* Screen */}
            <div className="relative h-[60%] w-full overflow-hidden rounded-[1.6rem] bg-black">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,hsl(263_83%_66%/0.4),transparent_70%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(188_92%_56%/0.3),transparent_70%)]" />
              <div className="relative flex h-full flex-col justify-between p-4 text-white">
                <div className="flex items-center justify-between text-[0.55rem] uppercase tracking-widest text-white/60">
                  <span>Hardware wallet</span>
                  <span className="font-mono">EIP-7702</span>
                </div>
                <div className="space-y-1.5 font-display">
                  <div className="text-[0.6rem] text-white/50">Authorize delegation</div>
                  <div className="text-base leading-tight font-semibold">Smart EOA</div>
                  <div className="text-[0.6rem] font-mono text-accent">0xef01·00…</div>
                </div>
                <div className="flex items-center gap-1.5 text-[0.55rem]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_currentColor]" />
                  <span className="text-white/60">Awaiting confirmation</span>
                </div>
              </div>
            </div>
            {/* Buttons */}
            <div className="mt-6 flex justify-around px-4">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="h-2.5 w-9 rounded-full bg-zinc-700" />
              ))}
            </div>
            {/* Brand label */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[0.5rem] uppercase tracking-[0.4em] text-white/30">
              secure element
            </div>
          </div>
        </div>

        {/* Floating agent orbs */}
        {[
          { x: "-12%", y: "10%", delay: 0, label: "AGT-01" },
          { x: "92%", y: "30%", delay: 0.6, label: "AGT-02" },
          { x: "-8%", y: "70%", delay: 1.2, label: "AGT-03" },
          { x: "94%", y: "78%", delay: 1.8, label: "AGT-04" },
        ].map((orb) => (
          <motion.div
            key={orb.label}
            className="absolute"
            style={{ left: orb.x, top: orb.y }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: orb.delay,
            }}
          >
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[0.6rem] backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
              <span className="font-mono text-white/70">{orb.label}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
