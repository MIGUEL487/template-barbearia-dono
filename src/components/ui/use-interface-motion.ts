"use client";
import { useReducedMotion } from "motion/react";
import { useMotionEnabled } from "@/components/motion-preferences";
export function useInterfaceReducedMotion() {
  const os = useReducedMotion(),
    enabled = useMotionEnabled();
  return Boolean(os) || !enabled;
}
