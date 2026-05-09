"use client";

import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { identicon } from "@dicebear/collection";
import { cn } from "@/lib/utils";

type AgentAvatarProps = {
  seed: string;
  className?: string;
};

export function AgentAvatar({ seed, className }: AgentAvatarProps) {
  const src = useMemo(
    () => createAvatar(identicon, { seed: seed.toLowerCase() }).toDataUri(),
    [seed],
  );

  return (
    <img
      src={src}
      alt=""
      className={cn("h-12 w-12 rounded-lg border border-border bg-secondary", className)}
      decoding="async"
    />
  );
}
