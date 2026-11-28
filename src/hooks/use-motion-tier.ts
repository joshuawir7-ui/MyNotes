"use client";

import { usePerfTier, resolveEffectiveAttributes } from "@/lib/perf-tier";

export function useMotionTier() {
  const tierState = usePerfTier();
  const attrs = resolveEffectiveAttributes(tierState);
  const motion = attrs.fxMotion;
  return {
    motionTier: motion,
    durationScale: motion === "full" ? 1 : motion === "reduced" ? 0.6 : 0.35,
    enableStagger: motion === "full",
    isReduced: motion === "reduced",
    isMinimal: motion === "minimal",
  };
}
