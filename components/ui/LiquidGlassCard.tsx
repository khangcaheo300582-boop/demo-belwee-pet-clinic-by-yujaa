"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LiquidGlassCardProps {
  children?: ReactNode;
  className?: string;
  /** Retained for existing callers; cards no longer tilt toward the pointer. */
  flat?: boolean;
  /** Retained for existing callers; cards no longer tilt toward the pointer. */
  maxTilt?: number;
  /** Show a centered, static specular highlight. */
  glare?: boolean;
  /** Enable the fluid-wobble border-radius morph. */
  fluid?: boolean;
}

export function MagneticGlassSurface({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative", className)}>{children}</div>;
}

export default function LiquidGlassCard({
  children,
  className,
  glare = true,
  fluid = false,
}: LiquidGlassCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/15",
        "bg-white/10 backdrop-blur-2xl",
        "shadow-vision-glass transition-shadow duration-300 hover:shadow-vision-glass-hover",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-glass-noise before:bg-cover",
        fluid && "animate-fluid-wobble",
        className
      )}
    >
      {glare && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            background:
              "radial-gradient(480px circle at 50% 50%, rgba(255,255,255,0.18), transparent 62%)",
          }}
        />
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-0 z-10 h-px bg-white/20" />
      <div className="relative z-30 h-full">{children}</div>
    </div>
  );
}

export { LiquidGlassCard as MagneticGlassCard };
