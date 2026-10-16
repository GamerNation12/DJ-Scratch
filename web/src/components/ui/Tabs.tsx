"use client";

import { useRef } from "react";

export interface TabItem {
  value: string;
  label: string;
}

interface TabsProps {
  tabs: readonly TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
}

/** Accessible pill tabs: arrow-key navigation, aria-selected, product styling. */
export default function Tabs({ tabs, value, onChange, className = "", label = "Sections" }: TabsProps) {
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusTab = (i: number) => {
    const n = tabs.length;
    const next = ((i % n) + n) % n;
    btnRefs.current[next]?.focus();
    onChange(tabs[next].value);
  };

  return (
    <div role="tablist" aria-label={label} className={`flex flex-wrap items-center gap-2 ${className}`}>
      {tabs.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => { btnRefs.current[i] = el; }}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); focusTab(i + 1); }
              if (e.key === "ArrowLeft") { e.preventDefault(); focusTab(i - 1); }
              if (e.key === "Home") { e.preventDefault(); focusTab(0); }
              if (e.key === "End") { e.preventDefault(); focusTab(tabs.length - 1); }
            }}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
              active
                ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
