import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card border border-border bg-surface p-5", className)}
      {...props}
    />
  );
}

/** Mono, uppercase, low-emphasis section label (per the Quiet Tool system). */
export function MetaLabel({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted",
        className,
      )}
      {...props}
    />
  );
}
