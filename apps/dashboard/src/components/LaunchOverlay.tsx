"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSettings, playBootBeep } from "@/lib/settings";

const BOOT_LINES = [
  "Initializing…",
  "Connecting to agent mesh…",
  "Run ID: ", // prefix only; runId types after
  "Mission view online.",
];

const LINE_DELAY_MS = 520;
const CHAR_DELAY_MS = 45;
const RUN_ID_CHAR_DELAY_MS = 55;
const HOLD_AFTER_LAST_MS = 800;
const FADE_OUT_MS = 600;

export interface LaunchOverlayProps {
  runId: string;
  /** Callback when overlay is dismissed (after transition). */
  onDismiss?: () => void;
}

/**
 * Full-screen mission boot: dark space gradient, optional starfield/grid,
 * terminal with CRT glow and character-by-character typing; optional beep per line;
 * blinking cursor; "Press any key or click to skip". Respects reduced-motion and sound.
 */
export function LaunchOverlay({ runId, onDismiss }: LaunchOverlayProps) {
  const router = useRouter();
  const runIdLineIndex = 2;
  const [phase, setPhase] = useState<"typing" | "hold" | "fadeout" | "done">(
    "typing",
  );
  const [reduceMotion, setReduceMotion] = useState(false);
  const [displayedLines, setDisplayedLines] = useState<
    { prefix: string; suffix: string; fullLine: string }[]
  >(() =>
    BOOT_LINES.map((line, i) => ({
      prefix: "",
      suffix: i === 0 ? line : "",
      fullLine: i === runIdLineIndex ? line + runId : line,
    })),
  );
  const [cursorLineIndex, setCursorLineIndex] = useState(0);
  const [skipRequested, setSkipRequested] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);
  const soundEnabled = getSettings().sound;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setReduceMotion(
      document.documentElement.classList.contains("reduce-motion"),
    );
  }, []);

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const skipToEnd = useCallback(() => {
    setSkipRequested(true);
    clearTimeouts();
    setDisplayedLines(
      BOOT_LINES.map((line, i) => {
        const fullLine = i === 2 ? line + runId : line;
        return { prefix: fullLine, suffix: "", fullLine };
      }),
    );
    setCursorLineIndex(BOOT_LINES.length);
    setPhase("hold");
  }, [runId, clearTimeouts]);

  useEffect(() => {
    if (phase !== "typing" || skipRequested) return;

    const totalLines = BOOT_LINES.length;

    function typeNextChar(
      lineIndex: number,
      charIndex: number,
      isRunIdSuffix: boolean,
    ) {
      if (!mountedRef.current) return;

      setDisplayedLines((prev) => {
        const next = [...prev];
        const line = next[lineIndex];
        if (!line) return prev;
        const full =
          lineIndex === runIdLineIndex
            ? BOOT_LINES[lineIndex]! + runId
            : BOOT_LINES[lineIndex]!;
        const prefixLen =
          lineIndex === runIdLineIndex
            ? BOOT_LINES[runIdLineIndex]!.length + charIndex
            : full.length;
        next[lineIndex] = {
          prefix: full.slice(0, prefixLen),
          suffix: full.slice(prefixLen),
          fullLine: full,
        };
        return next;
      });
      setCursorLineIndex(lineIndex);

      const isLastCharOfLine =
        lineIndex === runIdLineIndex ? charIndex >= runId.length - 1 : true;
      const delay = reduceMotion
        ? 0
        : isRunIdSuffix
          ? RUN_ID_CHAR_DELAY_MS
          : CHAR_DELAY_MS;

      if (isLastCharOfLine && lineIndex < totalLines - 1) {
        timeoutsRef.current.push(
          setTimeout(() => {
            if (!mountedRef.current) return;
            if (soundEnabled) playBootBeep();
            setDisplayedLines((prev) => {
              const n = [...prev];
              const idx = lineIndex + 1;
              const text =
                idx === runIdLineIndex ? BOOT_LINES[idx]! : BOOT_LINES[idx]!;
              n[idx] = {
                prefix: "",
                suffix: idx === runIdLineIndex ? "" : text,
                fullLine:
                  idx === runIdLineIndex ? BOOT_LINES[idx]! + runId : text,
              };
              return n;
            });
            setCursorLineIndex(lineIndex + 1);
            if (lineIndex + 1 === runIdLineIndex) {
              typeRunIdCharByChar(lineIndex + 1, 0);
            } else if (lineIndex + 1 < totalLines) {
              const baseDelay = reduceMotion ? 50 : LINE_DELAY_MS;
              timeoutsRef.current.push(
                setTimeout(() => advanceToNextLine(lineIndex + 1), baseDelay),
              );
            } else {
              timeoutsRef.current.push(
                setTimeout(
                  () => {
                    if (mountedRef.current) setPhase("hold");
                  },
                  reduceMotion ? 0 : HOLD_AFTER_LAST_MS,
                ),
              );
            }
          }, delay),
        );
      } else if (lineIndex === runIdLineIndex && charIndex < runId.length - 1) {
        timeoutsRef.current.push(
          setTimeout(() => typeNextChar(lineIndex, charIndex + 1, true), delay),
        );
      } else if (lineIndex === totalLines - 1) {
        timeoutsRef.current.push(
          setTimeout(
            () => {
              if (mountedRef.current) setPhase("hold");
            },
            reduceMotion ? 0 : HOLD_AFTER_LAST_MS,
          ),
        );
      }
    }

    function typeRunIdCharByChar(lineIndex: number, charIndex: number) {
      if (!mountedRef.current || lineIndex !== runIdLineIndex) return;
      if (charIndex === 0 && soundEnabled) playBootBeep();
      typeNextChar(lineIndex, charIndex, true);
    }

    function advanceToNextLine(lineIndex: number) {
      if (!mountedRef.current) return;
      const idx = lineIndex;
      if (idx > 0 && idx !== runIdLineIndex && soundEnabled) playBootBeep();
      if (idx === runIdLineIndex) {
        typeRunIdCharByChar(idx, 0);
        return;
      }
      const text = BOOT_LINES[idx]!;
      setDisplayedLines((prev) => {
        const n = [...prev];
        n[idx] = { prefix: text, suffix: "", fullLine: text };
        return n;
      });
      setCursorLineIndex(idx);
      if (idx === totalLines - 1) {
        timeoutsRef.current.push(
          setTimeout(
            () => {
              if (mountedRef.current) setPhase("hold");
            },
            reduceMotion ? 0 : HOLD_AFTER_LAST_MS,
          ),
        );
      } else {
        const baseDelay = reduceMotion ? 80 : LINE_DELAY_MS;
        timeoutsRef.current.push(
          setTimeout(() => advanceToNextLine(idx + 1), baseDelay),
        );
      }
    }

    setDisplayedLines(
      BOOT_LINES.map((line, i) => ({
        prefix: "",
        suffix: i === 0 ? line : "",
        fullLine: i === runIdLineIndex ? line + runId : line,
      })),
    );
    setCursorLineIndex(0);
    if (soundEnabled) playBootBeep();
    if (reduceMotion) {
      setDisplayedLines(
        BOOT_LINES.map((line, i) => {
          const full = i === runIdLineIndex ? line + runId : line;
          return { prefix: full, suffix: "", fullLine: full };
        }),
      );
      setCursorLineIndex(totalLines);
      timeoutsRef.current.push(setTimeout(() => setPhase("hold"), 100));
    } else {
      timeoutsRef.current.push(
        setTimeout(() => advanceToNextLine(0), LINE_DELAY_MS),
      );
    }
    return clearTimeouts;
  }, [phase, runId, reduceMotion, soundEnabled, skipRequested, clearTimeouts]);

  useEffect(() => {
    if (skipRequested && phase === "typing") return;
    if (phase !== "hold") return;
    const t = setTimeout(() => setPhase("fadeout"), reduceMotion ? 100 : 400);
    return () => clearTimeout(t);
  }, [phase, reduceMotion, skipRequested]);

  useEffect(() => {
    if (phase !== "fadeout") return;
    const t = setTimeout(
      () => {
        setPhase("done");
        const url = window.location.pathname + window.location.hash;
        router.replace(url, { scroll: false });
        onDismiss?.();
      },
      reduceMotion ? 50 : FADE_OUT_MS,
    );
    return () => clearTimeout(t);
  }, [phase, router, onDismiss, reduceMotion, runId]);

  useEffect(() => {
    const onKeyDown = () => skipToEnd();
    const onPointerDown = () => skipToEnd();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [skipToEnd]);

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center text-sky-100 transition-opacity duration-300"
      style={{
        background: reduceMotion
          ? "linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)"
          : "radial-gradient(ellipse 120% 100% at 50% 0%, #0e1a2e 0%, #020617 40%, #000 100%)",
        opacity: phase === "fadeout" ? 0 : 1,
        transitionDuration: `${reduceMotion ? 0.15 : FADE_OUT_MS / 1000}s`,
      }}
      role="status"
      aria-live="polite"
      aria-label="Mission launch sequence"
    >
      {/* Optional subtle starfield / grid */}
      {!reduceMotion && (
        <>
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            aria-hidden
            style={{
              backgroundImage: `
                radial-gradient(1.5px 1.5px at 20px 30px, rgba(148,163,184,0.4), transparent),
                radial-gradient(1.5px 1.5px at 40px 70px, rgba(148,163,184,0.3), transparent),
                radial-gradient(1.5px 1.5px at 80px 20px, rgba(148,163,184,0.35), transparent),
                radial-gradient(1.5px 1.5px at 60px 90px, rgba(148,163,184,0.25), transparent)
              `,
              backgroundSize: "100px 100px",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
            aria-hidden
          />
        </>
      )}
      {/* Scanlines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)",
        }}
        aria-hidden
      />
      {/* CRT-style glow behind terminal */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden
      >
        <div
          className="w-full max-w-2xl rounded-lg px-6 sm:px-10"
          style={{
            boxShadow:
              "0 0 80px rgba(56,189,248,0.15), 0 0 120px rgba(56,189,248,0.08)",
          }}
        />
      </div>

      <div className="relative w-full max-w-2xl px-6 sm:px-10">
        <div
          className="rounded-lg border border-sky-500/40 bg-slate-900/95 px-5 py-6 shadow-2xl ring-1 ring-sky-400/20"
          style={{
            boxShadow:
              "inset 0 0 40px rgba(56,189,248,0.06), 0 0 40px rgba(56,189,248,0.12)",
          }}
        >
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-sky-400/90">
            HyperShift — System boot
          </p>
          <div className="font-mono text-sm leading-relaxed text-sky-100">
            {BOOT_LINES.map((_, i) => {
              const line = displayedLines[i];
              const prefix = line?.prefix ?? "";
              const suffix = line?.suffix ?? "";
              const isLastWithCursor = cursorLineIndex === i;
              return (
                <div
                  key={i}
                  className="flex items-baseline gap-2"
                  style={{
                    opacity: prefix || suffix ? 1 : 0,
                    transition: reduceMotion
                      ? "none"
                      : "opacity 0.15s ease-out",
                  }}
                >
                  <span className="text-sky-500 select-none">&gt;</span>
                  <span>
                    {prefix}
                    {suffix && (
                      <span className="text-sky-200/80">{suffix}</span>
                    )}
                  </span>
                  {isLastWithCursor && (
                    <span
                      className="inline-block w-2 h-4 bg-sky-400 ml-0.5 align-middle animate-blink-cursor"
                      aria-hidden
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-sky-500/70">
          Press any key or click to skip
        </p>
      </div>
    </div>
  );
}
