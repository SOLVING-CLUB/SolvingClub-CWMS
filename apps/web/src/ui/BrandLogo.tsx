import { cn } from "@/lib/utils";

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  if (compact) return <span className={cn("brand-symbol", className)} aria-label="Solving Club">SC<span>.</span></span>;
  return <span className={cn("brand-logo", className)}>Solving Club<span>.</span></span>;
}
