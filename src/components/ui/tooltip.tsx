"use client";
import { useInterfaceReducedMotion as useReducedMotion } from "@/components/ui/use-interface-motion";
import {
  cloneElement,
  useId,
  useRef,
  useState,
  useEffect,
  type ReactElement,
  type HTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
let lastTooltip = 0;
export function Tooltip({
  text,
  children,
}: {
  text: string;
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}) {
  const [position, setPosition] = useState<{
      top: number;
      left: number;
    } | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    id = useId(),
    reduced = useReducedMotion();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function hide() {
    if (timer.current) clearTimeout(timer.current);
    setPosition(null);
    lastTooltip = Date.now();
  }
  function show(e: React.SyntheticEvent<HTMLElement>) {
    const element = e.currentTarget;
    const reveal = () => {
      const rect = element.getBoundingClientRect();
      setPosition({
        top: Math.max(8, rect.top - 88),
        left: Math.max(
          16,
          Math.min(innerWidth - 256, rect.left + rect.width / 2 - 120),
        ),
      });
    };
    if (Date.now() - lastTooltip < 800) reveal();
    else timer.current = setTimeout(reveal, 250);
  }
  return (
    <>
      {cloneElement(children, {
        "aria-describedby": position ? id : undefined,
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
        onKeyDown: (e) => {
          children.props.onKeyDown?.(e);
          if (e.key === "Escape") hide();
        },
      })}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {position && (
              <motion.div
                role="tooltip"
                id={id}
                className="ui-tooltip-panel"
                style={position}
                initial={reduced ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 2 }}
                transition={{
                  duration: reduced ? 0 : 0.12,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {text}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
