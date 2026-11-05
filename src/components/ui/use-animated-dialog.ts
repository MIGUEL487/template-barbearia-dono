"use client";
import { useInterfaceReducedMotion as useReducedMotion } from "@/components/ui/use-interface-motion";
import { useRef, useCallback } from "react";

export function useAnimatedDialog() {
  const ref = useRef<HTMLDialogElement>(null),
    reduced = useReducedMotion(),
    closing = useRef(false);
  const show = useCallback(() => {
    const d = ref.current;
    if (!d) return;
    closing.current = false;
    d.getAnimations().forEach((a) => a.cancel());
    d.showModal();
    if (!reduced)
      d.animate(
        [
          { opacity: 0, transform: "translateY(12px) scale(.98)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        { duration: 200, easing: "cubic-bezier(.16,1,.3,1)" },
      );
  }, [reduced]);
  const close = useCallback(async () => {
    const d = ref.current;
    if (!d?.open || closing.current) return;
    closing.current = true;
    if (!reduced) {
      try {
        await d.animate(
          [
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 0, transform: "translateY(4px)" },
          ],
          { duration: 160, easing: "cubic-bezier(.16,1,.3,1)" },
        ).finished;
      } catch {}
    }
    d.close();
    closing.current = false;
  }, [reduced]);
  return { ref, show, close };
}
