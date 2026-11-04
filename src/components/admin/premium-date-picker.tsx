"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { saoPauloDate } from "@/lib/agenda-grid";

interface PremiumDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  className?: string;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_NAMES = ["D", "S", "T", "Q", "Q", "S", "S"];

export function PremiumDatePicker({
  value,
  onChange,
  className = "",
}: PremiumDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current selected date safely without UTC shift
  const [selYear, selMonth, selDay] = value.split("-").map(Number);

  // State for the calendar view (viewing month/year may differ from selected)
  const [viewYear, setViewYear] = useState(selYear || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(
    selMonth ? selMonth - 1 : new Date().getMonth(),
  );

  // Sync view when value changes from outside
  useEffect(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      if (y && m) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
  }, [value]);

  // Click outside listener
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

  // Navigate day by offset
  const changeDateByDays = (delta: number) => {
    const d = new Date(selYear, selMonth - 1, selDay);
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    onChange(`${y}-${m}-${day}`);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Helper to format the trigger label
  const getTriggerLabel = () => {
    const today = saoPauloDate();
    const [tY, tM, tD] = today.split("-").map(Number);
    const todayDate = new Date(tY, tM - 1, tD);
    const currDate = new Date(selYear, selMonth - 1, selDay);

    const diffDays = Math.round(
      (currDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    let prefix = "";
    if (diffDays === 0) prefix = "Hoje, ";
    else if (diffDays === 1) prefix = "Amanhã, ";
    else if (diffDays === -1) prefix = "Ontem, ";

    const weekdayShort = currDate.toLocaleDateString("pt-BR", {
      weekday: "short",
    });
    const formattedWeekday =
      weekdayShort.charAt(0).toUpperCase() + weekdayShort.slice(1);

    return {
      prefix,
      label: `${prefix}${formattedWeekday}, ${selDay} de ${MONTH_NAMES[selMonth - 1]?.slice(0, 3)}`,
      fullYear: selYear,
    };
  };

  // Build calendar matrix
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarDays = [];

  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    calendarDays.push({
      day: daysInPrevMonth - i,
      month: viewMonth === 0 ? 11 : viewMonth - 1,
      year: viewMonth === 0 ? viewYear - 1 : viewYear,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    calendarDays.push({
      day: i,
      month: viewMonth,
      year: viewYear,
      isCurrentMonth: true,
    });
  }

  // Next month leading days (fill up to 35 or 42 cells)
  const remainingCells = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    calendarDays.push({
      day: i,
      month: viewMonth === 11 ? 0 : viewMonth + 1,
      year: viewMonth === 11 ? viewYear + 1 : viewYear,
      isCurrentMonth: false,
    });
  }

  const todayStr = saoPauloDate();
  const trigger = getTriggerLabel();

  const handleSelectDay = (y: number, m: number, d: number) => {
    const formattedDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    onChange(formattedDate);
    setIsOpen(false);
  };

  const handleQuickJump = (daysDelta: number) => {
    const today = saoPauloDate();
    const [tY, tM, tD] = today.split("-").map(Number);
    const target = new Date(tY, tM - 1, tD);
    target.setDate(target.getDate() + daysDelta);
    const targetY = target.getFullYear();
    const targetM = String(target.getMonth() + 1).padStart(2, "0");
    const targetDay = String(target.getDate()).padStart(2, "0");
    const formatted = `${targetY}-${targetM}-${targetDay}`;
    onChange(formatted);
    setViewYear(targetY);
    setViewMonth(target.getMonth());
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Bar with Prev / Date Button / Next */}
      <div className="flex items-center bg-surface-2 rounded-xl border border-hairline p-1 shadow-sm">
        <button
          type="button"
          onClick={() => changeDateByDays(-1)}
          className="p-2 text-text-muted hover:text-text hover:bg-surface-3 rounded-lg transition-colors !min-h-0 !w-auto cursor-pointer"
          aria-label="Dia anterior"
          title="Dia anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text hover:bg-surface-3 transition-colors cursor-pointer !min-h-0"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label="Abrir seletor de data"
        >
          <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center text-accent-light border border-hairline shrink-0">
            <CalendarIcon className="w-3.5 h-3.5" />
          </div>

          <div className="flex flex-col text-left">
            <span className="text-text font-bold text-xs truncate">
              {mounted?trigger.label:'Selecionar data'}
            </span>
            <span className="text-[10px] text-text-muted font-normal">
              {mounted?trigger.fullYear:'Agenda'}
            </span>
          </div>

          <ChevronDown
            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ml-1 ${
              isOpen ? "rotate-180 text-accent-light" : ""
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => changeDateByDays(1)}
          className="p-2 text-text-muted hover:text-text hover:bg-surface-3 rounded-lg transition-colors !min-h-0 !w-auto cursor-pointer"
          aria-label="Próximo dia"
          title="Próximo dia"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Popover Calendar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full mt-2 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 z-50 w-[300px] sm:w-[320px] bg-surface border border-border rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)]"
          >
            {/* Quick action buttons */}
            <div className="flex items-center justify-between gap-1 pb-3 mb-3 border-b border-hairline text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickJump(0)}
                className="flex-1 py-1 px-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-text font-semibold border border-hairline/60 transition-colors text-center !min-h-0"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => handleQuickJump(1)}
                className="flex-1 py-1 px-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-text font-semibold border border-hairline/60 transition-colors text-center !min-h-0"
              >
                Amanhã
              </button>
              <button
                type="button"
                onClick={() => handleQuickJump(7)}
                className="flex-1 py-1 px-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-text font-semibold border border-hairline/60 transition-colors text-center !min-h-0"
              >
                +7 dias
              </button>
            </div>

            {/* Month & Year Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-sm text-text">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 text-text-muted hover:text-text hover:bg-surface-2 rounded-lg transition-colors cursor-pointer !min-h-0 !w-auto"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 text-text-muted hover:text-text hover:bg-surface-2 rounded-lg transition-colors cursor-pointer !min-h-0 !w-auto"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekdays header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEKDAY_NAMES.map((name, i) => (
                <span
                  key={i}
                  className="text-[11px] font-bold text-text-muted/70 py-1"
                >
                  {name}
                </span>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((c, idx) => {
                const dateKey = `${c.year}-${String(c.month + 1).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
                const isSelected = dateKey === value;
                const isToday = dateKey === todayStr;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(c.year, c.month, c.day)}
                    className={`h-9 w-full rounded-xl text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer relative !min-h-0 ${
                      isSelected
                        ? "bg-accent text-white shadow-glow font-bold z-10"
                        : c.isCurrentMonth
                          ? "text-text hover:bg-surface-2 hover:text-white"
                          : "text-text-muted/30 hover:bg-surface-2/40 hover:text-text-muted"
                    }`}
                  >
                    <span>{c.day}</span>
                    {isToday && !isSelected && (
                      <span className="w-1 h-1 rounded-full bg-accent-light absolute bottom-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
