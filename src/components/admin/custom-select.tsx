"use client";

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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = options.findIndex((opt) => opt.value === value);
        const nextIndex = Math.min(currentIndex + 1, options.length - 1);
        if (options[nextIndex]) {
          onChange(options[nextIndex].value);
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = options.findIndex((opt) => opt.value === value);
        const prevIndex = Math.max(currentIndex - 1, 0);
        if (options[prevIndex]) {
          onChange(options[prevIndex].value);
        }
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-text-muted mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Select Trigger */}
      <button
        id={selectId}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || label || placeholder}
        className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer border !min-h-0 ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-surface-2 border-hairline text-text-muted"
            : isOpen
              ? "bg-bg border-accent shadow-[0_0_0_3px_rgba(124,58,237,0.25)] text-text"
              : "bg-bg hover:bg-surface-2/60 border-border text-text hover:border-hairline"
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          {selectedOption?.icon && (
            <span className="text-accent-light shrink-0">
              {selectedOption.icon}
            </span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.subtitle && (
            <span className="text-[11px] text-text-muted font-normal truncate">
              · {selectedOption.subtitle}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-accent-light" : ""
          }`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-surface border border-border rounded-xl shadow-[0_16px_36px_rgba(0,0,0,0.85)] overflow-hidden"
          >
            <ul
              ref={listboxRef}
              role="listbox"
              tabIndex={-1}
              className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-hairline/30"
            >
              {options.length === 0 ? (
                <li className="px-3 py-2 text-xs text-text-muted text-center">
                  Nenhuma opção disponível
                </li>
              ) : (
                options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                        triggerRef.current?.focus();
                      }}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-accent text-white"
                          : "text-text hover:bg-surface-2 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {option.icon && (
                          <span
                            className={
                              isSelected ? "text-white" : "text-accent-light"
                            }
                          >
                            {option.icon}
                          </span>
                        )}
                        <span className="truncate">{option.label}</span>
                        {option.subtitle && (
                          <span
                            className={`text-[10px] truncate ${
                              isSelected
                                ? "text-white/80"
                                : "text-text-muted"
                            }`}
                          >
                            · {option.subtitle}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
