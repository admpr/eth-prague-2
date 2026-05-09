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
      <div className="grid gap-8 rounded-2xl surface p-10 text-center md:p-14">
        <div className="mx-auto relative h-32 w-32">
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 blur-2xl"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-2 flex items-center justify-center rounded-full surface-glow">
            <Bot className="h-12 w-12 text-accent" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Hire your first AI employee
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Pick a role, set a budget, define a time window. Your hardware wallet signs once;
            the agent works inside the lines you draw.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" size="lg" onClick={onHire}>
            <Plus className="h-4 w-4" />
            Hire employee
          </Button>
          <Button variant="ghost" size="lg" disabled>
            Import policy preset
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
