"use client";

import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";

/** Fade-and-rise on first scroll into view. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVis(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVis(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`reveal ${vis ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** Animated number that counts up on mount. Renders "..." for 0/NaN. */
export function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!value || value <= 0) return;
    setStarted(true);
    const dur = 1400;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (!value || value <= 0 || !started) return <>...</>;
  return <>{n.toLocaleString()}</>;
}

/** Grid-level mouse handler powering per-card spotlight glow.
 *  Attach to the container; cards need class "bento-spot". */
export function handleSpot(e: MouseEvent<HTMLElement>) {
  const card = (e.target as HTMLElement).closest(".bento-spot") as HTMLElement | null;
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty("--mx", `${e.clientX - r.left}px`);
  card.style.setProperty("--my", `${e.clientY - r.top}px`);
}
