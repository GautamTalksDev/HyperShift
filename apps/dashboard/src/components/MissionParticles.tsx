"use client";

import { useEffect, useRef, useState } from "react";
import { getSettings } from "@/lib/settings";

export interface MissionParticlesProps {
  /** When this changes (e.g. step completion), a small particle burst is triggered. */
  triggerKey?: string | number | null;
  /** Optional class for the container. */
  className?: string;
  /** Whether the mission view is in focus (e.g. show particles only when not in focus mode). */
  active?: boolean;
}

const PARTICLE_COUNT = 24;
const BURST_PARTICLE_COUNT = 8;

function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    setReduceMotion(getSettings().reducedMotion);
    const check = () => setReduceMotion(getSettings().reducedMotion);
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);
  return reduceMotion;
}

/**
 * Subtle background particles that react to step completion (e.g. small burst when an agent finishes).
 * Respects reduced-motion and existing settings.
 */
export function MissionParticles({
  triggerKey,
  className = "",
  active = true,
}: MissionParticlesProps) {
  const reduceMotion = useReduceMotion();
  const prevTriggerRef = useRef<typeof triggerKey>(undefined);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (reduceMotion || !active) return;
    if (triggerKey != null && triggerKey !== prevTriggerRef.current) {
      prevTriggerRef.current = triggerKey;
      setBurst((b) => b + 1);
    }
  }, [triggerKey, reduceMotion, active]);

  if (reduceMotion || !active) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {/* Optional subtle connection lines (respect reduced-motion via CSS) */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.04]"
        aria-hidden
      >
        <line
          x1="10%"
          y1="20%"
          x2="90%"
          y2="80%"
          stroke="rgb(56,189,248)"
          strokeWidth="0.5"
        />
        <line
          x1="20%"
          y1="80%"
          x2="80%"
          y2="20%"
          stroke="rgb(56,189,248)"
          strokeWidth="0.5"
        />
        <line
          x1="5%"
          y1="50%"
          x2="95%"
          y2="50%"
          stroke="rgb(56,189,248)"
          strokeWidth="0.5"
        />
      </svg>
      {/* Ambient subtle particles */}
      <div className="absolute inset-0">
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <div
            key={`ambient-${i}`}
            className="absolute h-1 w-1 rounded-full bg-sky-400/20"
            style={{
              left: `${(i * 17 + 5) % 100}%`,
              top: `${(i * 23 + 11) % 100}%`,
              animation: "mission-particle-float 12s ease-in-out infinite",
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>
      {/* Burst on step completion */}
      {burst > 0 && (
        <div
          key={burst}
          className="absolute inset-0 flex items-center justify-center"
        >
          {Array.from({ length: BURST_PARTICLE_COUNT }).map((_, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                transform: `rotate(${(i * 360) / BURST_PARTICLE_COUNT}deg)`,
              }}
            >
              <div
                className="h-1.5 w-1.5 rounded-full bg-sky-300/50"
                style={{
                  animation: "mission-particle-burst 0.8s ease-out forwards",
                  animationDelay: `${i * 0.02}s`,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
