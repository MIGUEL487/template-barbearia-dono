"use client";
import { InterfaceMotion } from "./interface-motion";
import { MotionConfig } from "framer-motion";
export function MotionPreferences({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user"><InterfaceMotion />{children}</MotionConfig>;
}
