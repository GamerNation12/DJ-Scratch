import { useEffect, useRef, type ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
      {children}
      <div className="h-px bg-white/10 flex-1" />
    </h2>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-zinc-400">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-10 px-6 bg-black/20 rounded-2xl border border-dashed border-white/10">
      <p className="text-zinc-300 font-bold">{title}</p>
      {hint && <p className="text-zinc-500 text-sm mt-2">{hint}</p>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-center justify-between gap-4">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 font-bold transition-colors">
          Retry
        </button>
      )}
    </div>
  );
}

export function Dialog({ open, onClose, children, className = '', label = 'Dialog' }: {
  open: boolean; onClose: () => void; children: ReactNode; className?: string; label?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        className={`relative outline-none ${className}`}>
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-white/5 ${className}`} />;
}

export function Tabs({ tabs, value, onChange, className = '', label = 'Sections' }: {
  tabs: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
}) {
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
              if (e.key === 'ArrowRight') { e.preventDefault(); focusTab(i + 1); }
              if (e.key === 'ArrowLeft') { e.preventDefault(); focusTab(i - 1); }
              if (e.key === 'Home') { e.preventDefault(); focusTab(0); }
              if (e.key === 'End') { e.preventDefault(); focusTab(tabs.length - 1); }
            }}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
              active
                ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
