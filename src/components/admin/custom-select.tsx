"use client";
import { useInterfaceReducedMotion as useReducedMotion } from "@/components/ui/use-interface-motion";
import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
}
interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  id?: string;
  "aria-label"?: string;
}
export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione uma opção",
  disabled = false,
  className = "",
  label,
  id,
  "aria-label": ariaLabel,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [above, setAbove] = useState(false),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    list = useRef<HTMLUListElement>(null),
    generated = useId(),
    reduced = useReducedMotion();
  const selectId = id || generated,
    listId = generated + "-list",
    selected = options.find((o) => o.value === value);
  const typeAhead = useRef({ text: "", at: 0 });
  function show() {
    if (disabled) return;
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    const r = trigger.current?.getBoundingClientRect();
    setAbove(Boolean(r && window.innerHeight - r.bottom < 280 && r.top > 280));
    setOpen(true);
  }
  function choose(index: number) {
    if (options[index]) onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open && list.current) {
      const container = list.current,
        item = container.querySelector<HTMLElement>(`[data-index="${active}"]`);
      if (item) {
        if (item.offsetTop < container.scrollTop)
          container.scrollTop = item.offsetTop;
        else if (
          item.offsetTop + item.offsetHeight >
          container.scrollTop + container.clientHeight
        )
          container.scrollTop =
            item.offsetTop + item.offsetHeight - container.clientHeight;
      }
    }
  }, [active, open]);
  function key(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (!open) show();
      else
        setActive((i) =>
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? options.length - 1
              : Math.max(
                  0,
                  Math.min(
                    options.length - 1,
                    i + (e.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
        );
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) choose(active);
      else show();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      typeAhead.current = {
        text:
          Date.now() - typeAhead.current.at < 700
            ? typeAhead.current.text + e.key
            : e.key,
        at: Date.now(),
      };
      const index = options.findIndex((o) =>
        o.label
          .toLocaleLowerCase()
          .startsWith(typeAhead.current.text.toLocaleLowerCase()),
      );
      if (index >= 0) {
        if (!open) show();
        setActive(index);
      }
    }
  }
  return (
    <div
      ref={root}
      className={"ui-select " + className}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      {label && (
        <label htmlFor={selectId} className="ui-select-label">
          {label}
        </label>
      )}
      <button
        type="button"
        ref={trigger}
        id={selectId}
        role="combobox"
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={
          open && options[active] ? generated + "-" + active : undefined
        }
        aria-label={ariaLabel || label || placeholder}
        disabled={disabled}
        onKeyDown={key}
        onClick={() => (open ? setOpen(false) : show())}
        className="ui-select-trigger"
      >
        <span className="ui-select-value">
          {selected?.icon}
          {selected?.label || placeholder}
          {selected?.subtitle && <small>{selected.subtitle}</small>}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduced ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="options"
            data-select-panel="true"
            className={"ui-select-panel " + (above ? "ui-select-above" : "")}
            initial={
              reduced ? false : { opacity: 0, y: above ? -8 : 8, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: above ? -4 : 4, scale: 0.98 }}
            transition={{
              duration: reduced ? 0 : 0.18,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <ul
              ref={list}
              role="listbox"
              id={listId}
              aria-label={ariaLabel || label || placeholder}
            >
              {options.map((o, i) => (
                <li
                  key={o.value}
                  id={generated + "-" + i}
                  data-index={i}
                  data-value={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  data-active={i === active}
                  onPointerMove={() => setActive(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={e => {e.preventDefault();e.stopPropagation();choose(i)}}
                >
                  {o.icon}
                  <span>
                    {o.label}
                    {o.subtitle && <small>{o.subtitle}</small>}
                  </span>
                  {o.value === value && <Check size={16} />}
                </li>
              ))}
              {!options.length && <li>Nenhuma opção disponível</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
