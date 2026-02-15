"use client";

import { useState, useEffect } from "react";

const HYPERSHIFT_TRANSLATIONS: { lang: string; name: string }[] = [
  { lang: "English", name: "HyperShift" },
  { lang: "Español", name: "HyperShift" },
  { lang: "Français", name: "HyperShift" },
  { lang: "Deutsch", name: "HyperShift" },
  { lang: "हिंदी", name: "HyperShift" },
  { lang: "日本語", name: "HyperShift" },
  { lang: "العربية", name: "HyperShift" },
];

const SPLASH_DURATION_MS = 2800;
const FADEOUT_MS = 400;

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"show" | "fadeout" | "done">("show");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const reducedMotion =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("reduce-motion");
    const duration = reducedMotion ? 800 : SPLASH_DURATION_MS;
    const t = setTimeout(() => setPhase("fadeout"), duration);
    return () => clearTimeout(t);
  }, [mounted]);

  useEffect(() => {
    if (phase !== "fadeout") return;
    const t = setTimeout(() => setPhase("done"), FADEOUT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "done") return <>{children}</>;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-indigo-950/30 to-slate-950 text-white transition-opacity duration-300 ${
        phase === "fadeout" ? "opacity-0" : "opacity-100"
      }`}
      role="presentation"
      aria-live="polite"
      aria-label="Loading HyperShift"
    >
      <div className="flex flex-col items-center gap-8 px-6 animate-fade-in">
        <p className="text-lg font-medium tracking-wide text-indigo-200/95">
          Welcome to
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
          HyperShift
        </h1>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-indigo-200/80">
          {HYPERSHIFT_TRANSLATIONS.map(({ lang, name }) => (
            <li key={lang}>
              <span className="sr-only">
                {name} in {lang}
              </span>
              <span aria-hidden>
                {lang}: {name}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div
        className="absolute bottom-12 left-0 right-0 mx-12 h-1 rounded-full bg-indigo-500/20 overflow-hidden"
        aria-hidden
      >
        <div className="h-full w-full bg-indigo-400 rounded-full splash-progress-bar" />
      </div>
    </div>
  );
}
