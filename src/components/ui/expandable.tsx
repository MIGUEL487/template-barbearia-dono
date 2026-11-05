"use client";
import { useInterfaceReducedMotion as useReducedMotion } from "@/components/ui/use-interface-motion";
import {
  Children,
  isValidElement,
  useId,
  useRef,
  useState,
  useEffect,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
export function Expandable({
  children,
  open = false,
  className = "",
  id,
  onExpandedChange,
  ...props
}: HTMLAttributes<HTMLElement> & {
  open?: boolean;
  onExpandedChange?: (value: boolean) => void;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(open),
    reduced = useReducedMotion(),
    generated = useId(),
    root = useRef<HTMLElement>(null);
  const contentId = generated + "-content",
    triggerId = generated + "-trigger";
  const nodes = Children.toArray(children),
    summary = nodes.find((n) => isValidElement(n) && n.type === "summary");
  const rest = nodes.filter((n) => n !== summary);
  useEffect(() => {
    const el = root.current;
    const show = () => {
      setExpanded(true);
      onExpandedChange?.(true);
    };
    el?.addEventListener("expand", show);
    return () => el?.removeEventListener("expand", show);
  }, [onExpandedChange]);
  return (
    <section
      {...props}
      id={id}
      ref={root}
      className={"ui-expandable " + className}
      data-expanded={expanded}
    >
      <button
        type="button"
        id={triggerId}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="ui-expandable-trigger"
        onClick={() => {
          setExpanded(!expanded);
          onExpandedChange?.(!expanded);
        }}
      >
        <span>
          {isValidElement<{ children: ReactNode }>(summary)
            ? summary.props.children
            : "Detalhes"}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: reduced ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>
      <div
        className="ui-expandable-grid"
        data-open={expanded}
        style={{ transitionDuration: reduced ? "0ms" : undefined }}
        inert={!expanded}
        aria-hidden={!expanded}
      >
        <div className="ui-expandable-clip">
          <div
            id={contentId}
            role="region"
            aria-labelledby={triggerId}
            className="ui-expandable-content"
          >
            {rest}
          </div>
        </div>
      </div>
    </section>
  );
}
