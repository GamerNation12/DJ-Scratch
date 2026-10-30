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
