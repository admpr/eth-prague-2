"use client";

import { motion } from "framer-motion";
import { Plus, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmployeeEmptyStateProps = {
  onHire: () => void;
};

export function EmployeeEmptyState({ onHire }: EmployeeEmptyStateProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="container py-12"
    >
      <div className="grid gap-10 rounded-xl surface p-10 md:p-16">
        <div className="flex items-center gap-3">
          <span className="num-pin">Workforce / Empty</span>
          <span className="hidden h-px flex-1 bg-border md:block" />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
            00 active
          </span>
        </div>

        <div className="grid items-center gap-10 md:grid-cols-[auto_1fr]">
          <div className="relative h-28 w-28 shrink-0">
            <div className="absolute inset-0 border border-primary/40" />
            <div className="absolute -left-1.5 -top-1.5 h-3 w-3 border-l border-t border-primary" />
            <div className="absolute -right-1.5 -bottom-1.5 h-3 w-3 border-r border-b border-primary" />
            <div className="absolute inset-2 flex items-center justify-center bg-secondary/50">
              <Bot className="h-10 w-10 text-primary" strokeWidth={1.5} />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.02] tracking-tightest">
              Hire your first <span className="editorial text-accent">AI employee.</span>
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Pick a role, set a budget, define a time window. Your hardware wallet signs once;
              the agent works inside the lines you draw.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Button type="button" size="lg" onClick={onHire}>
                <Plus className="h-4 w-4" />
                Hire employee
              </Button>
              <Button variant="outline" size="lg" disabled>
                Import policy preset
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
