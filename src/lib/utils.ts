import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function shortAddress(address: string, head = 6, tail = 4): string {
  if (!address || address.length < head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
