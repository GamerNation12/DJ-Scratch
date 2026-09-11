"use client";
import { useEffect, useRef, useState } from "react";

export interface Suggestion {
  name: string;
  artist?: string;
  listeners?: number;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (s: Suggestion) => void;
  placeholder?: string;
  className?: string;
  kind: "artist" | "track" | "album";
  /** Extra context prepended to track/album searches (e.g. the artist field). */
  context?: string;
}

// Debounced .fmbot-style autocomplete input backed by /api/tools/autocomplete.
export default function AutocompleteInput({
  value, onChange, onSelect, placeholder, className, kind, context,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [focused, setFocused] = useState(false);
  const reqId = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused || value.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const q = context?.trim() ? `${context.trim()} ${value.trim()}` : value.trim();
        const res = await fetch(`/api/tools/autocomplete?kind=${kind}&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (reqId.current !== id) return; // stale response
        const list: Suggestion[] = data.suggestions || [];
        setItems(list);
        setHighlight(-1);
        setOpen(list.length > 0);
      } catch {
        /* offline/error: just no suggestions */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value, focused, kind, context]);

  const pick = (s: Suggestion) => {
    onChange(s.name);
    setOpen(false);
    setItems([]);
    onSelect?.(s);
  };

  return (
    <div ref={boxRef} className="relative flex-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + items.length) % items.length);
          } else if (e.key === "Enter" && highlight >= 0) {
            e.preventDefault();
            pick(items[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={className}
      />
      {open && items.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-zinc-950 border border-white/10 rounded-xl overflow-hidden shadow-2xl shadow-black/60 max-h-64 overflow-y-auto">
          {items.map((s, i) => (
            <button
              key={`${s.name}-${s.artist || ""}-${i}`}
              onMouseDown={(e) => {
                e.preventDefault(); // beat input blur
                pick(s);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                highlight === i ? "bg-indigo-500/20 text-white" : "text-zinc-300"
              }`}
            >
              <span className="truncate flex-1">
                <span className="font-bold">{s.name}</span>
                {s.artist && <span className="text-zinc-500"> · {s.artist}</span>}
              </span>
              {typeof s.listeners === "number" && (
                <span className="text-[11px] font-mono text-zinc-600 shrink-0">
                  {(s.listeners / 1000).toFixed(0)}k
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
