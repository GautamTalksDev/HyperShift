// UI THEME LOCKED

"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import type { AgentLocation } from "@/utils/agents";
import {
  agentOrder,
  getAgentById,
  getAgentLocation,
  getStatusColor,
} from "@/utils/agents";
import type { AgentId, AgentStates, Connection } from "@/types";

/** Compact location label for network nodes (city name only). */
function formatLocationShort(loc: AgentLocation): string {
  return loc.name;
}

const NODE_POSITIONS: Record<AgentId, { x: number; y: number }> = {
  architect: { x: 10, y: 50 },
  builder: { x: 28, y: 22 },
  sentinel: { x: 50, y: 12 },
  sre: { x: 72, y: 22 },
  finops: { x: 90, y: 50 },
};

export interface NeuralNetworkProps {
  agentStates: AgentStates;
  connections?: Connection[];
  isRunning: boolean;
  /** Run-scoped agent→location; when provided, locations change per pipeline. */
  agentLocations?: Record<AgentId, AgentLocation>;
  /** When true, component fills parent height (e.g. on run page). */
  fullHeight?: boolean;
  /** Current pipeline step (1–5) so edge animations flow with agents. */
  currentStep?: number;
}

export function NeuralNetwork({
  agentStates,
  connections = [],
  isRunning,
  agentLocations,
  fullHeight = false,
  currentStep = 0,
}: NeuralNetworkProps) {
  const isEdgeActive = (from: AgentId, to: AgentId) =>
    connections.some((c) => c.from === from && c.to === to && c.active);

  const fallbackEdgeActive = (agent: AgentId) =>
    (agentStates[agent as keyof AgentStates] ?? "idle") === "active";

  /** Edge index (0–3) is "current" when pipeline is on the step that just finished that edge (step === idx+2). */
  const isEdgeCurrent = (edgeIndex: number) =>
    isRunning && currentStep >= 1 && currentStep === edgeIndex + 2;

  const reduceMotion = useMemo(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("reduce-motion");
  }, []);

  const getLoc = (id: AgentId) => agentLocations?.[id] ?? getAgentLocation(id);

  return (
    <Card
      className={`relative flex w-full flex-col overflow-hidden rounded-xl border border-sky-500/40 bg-slate-950 shadow-lg ${fullHeight ? "h-full min-h-[60vh]" : "h-64 min-h-[16rem]"}`}
      aria-label="Agent pipeline network"
    >
      {/* Subtle sky accent – aligned with Globe tab */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(56,189,248,0.2)_0,_transparent_60%)]" />
      </div>

      <header className="relative z-10 border-b border-sky-500/20 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-sky-300/90">
          Agent neural mesh
        </h3>
      </header>

      <div className="relative z-10 flex flex-1 flex-col px-4 pb-4 pt-4">
        <div className="relative min-h-[200px] flex-1 rounded-lg border border-sky-500/20 bg-slate-950/50 p-4">
          {/* edges */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 60"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <defs>
              <linearGradient id="nnEdgeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(56,189,248,0.5)" />
                <stop offset="100%" stopColor="rgba(56,189,248,0.85)" />
              </linearGradient>
            </defs>

            {agentOrder.map((agent, idx) => {
              const next = agentOrder[idx + 1];
              if (!next) return null;

              const from = NODE_POSITIONS[agent];
              const to = NODE_POSITIONS[next];
              const isActive =
                connections.length > 0
                  ? isEdgeActive(agent, next)
                  : fallbackEdgeActive(agent);
              const current = isEdgeCurrent(idx);
              const d = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

              return (
                <g key={`${agent}-${next}`}>
                  <motion.line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={
                      isActive
                        ? current
                          ? "rgba(56,189,248,0.55)"
                          : "rgba(56,189,248,0.4)"
                        : "rgba(56,189,248,0.25)"
                    }
                    strokeWidth={isActive ? (current ? 2.2 : 1.8) : 1}
                    strokeLinecap="round"
                    initial={{ opacity: 0.6 }}
                    animate={{
                      opacity: isActive ? (current ? 0.95 : 0.8) : 0.5,
                    }}
                    transition={{ duration: reduceMotion ? 0 : 0.3 }}
                  />
                  {isActive && (
                    <>
                      <motion.line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="url(#nnEdgeGlow)"
                        strokeWidth={current ? 1.8 : 1.2}
                        strokeLinecap="round"
                        initial={{ opacity: 0.3 }}
                        animate={
                          reduceMotion
                            ? {}
                            : {
                                opacity: current
                                  ? [0.6, 0.9, 0.6]
                                  : [0.4, 0.7, 0.4],
                              }
                        }
                        transition={{
                          repeat: reduceMotion ? 0 : Infinity,
                          duration: current ? 1 : 1.5,
                        }}
                      />
                      <motion.path
                        d={d}
                        fill="none"
                        stroke="rgba(56,189,248,0.9)"
                        strokeWidth={current ? 1.2 : 1}
                        strokeLinecap="round"
                        strokeDasharray="0.12 0.88"
                        pathLength={1}
                        initial={{ strokeDashoffset: 0 }}
                        animate={
                          reduceMotion ? {} : { strokeDashoffset: [0, 1] }
                        }
                        transition={{
                          repeat: reduceMotion ? 0 : Infinity,
                          duration: current ? 0.9 : 1.2,
                          ease: "linear",
                        }}
                      />
                      {!reduceMotion && (
                        <motion.circle
                          r={current ? 1.4 : 1}
                          fill="rgba(56,189,248,0.95)"
                          initial={{ cx: from.x, cy: from.y }}
                          animate={{ cx: [from.x, to.x], cy: [from.y, to.y] }}
                          transition={{
                            repeat: Infinity,
                            duration: current ? 1.2 : 1.5,
                            ease: "linear",
                          }}
                        />
                      )}
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* nodes */}
          {agentOrder.map((agent) => {
            const pos = NODE_POSITIONS[agent];
            const state = agentStates[agent as keyof AgentStates];
            const color = getStatusColor(state);
            const isActive = state === "active";
            const isBlocked = state === "blocked" || state === "failed";
            const isComplete = state === "complete";
            const stateLabel =
              state === "idle"
                ? "Idle"
                : state === "active"
                  ? "Running"
                  : state === "complete"
                    ? "Done"
                    : state === "blocked" || state === "failed"
                      ? "Blocked"
                      : state;

            const isRevealed = state !== "idle";
            const revealDelay =
              agentOrder.indexOf(agent) * (reduceMotion ? 0 : 0.1);

            return (
              <motion.div
                key={agent}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  pointerEvents: isRevealed ? "auto" : "none",
                }}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{
                  opacity: isRevealed ? 1 : 0,
                  scale: reduceMotion
                    ? isRevealed
                      ? 1
                      : 0.85
                    : isActive
                      ? [1, 1.06, 1]
                      : isRevealed
                        ? 1
                        : 0.85,
                }}
                transition={{
                  duration: reduceMotion ? 0.15 : isActive ? 1.2 : 0.35,
                  delay: isRevealed ? revealDelay : 0,
                  repeat: reduceMotion ? 0 : isActive ? Infinity : 0,
                  ease: "easeInOut",
                }}
                aria-label={`${getAgentById(agent)?.name ?? agent}: ${stateLabel}`}
                aria-hidden={!isRevealed}
              >
                <div className="relative flex flex-col items-center gap-2">
                  {!reduceMotion && isRevealed && (
                    <svg
                      className="absolute h-9 w-9"
                      viewBox="0 0 36 36"
                      aria-hidden
                    >
                      <motion.circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        stroke="rgba(56,189,248,0.7)"
                        strokeWidth="2"
                        strokeDasharray={2 * Math.PI * 16}
                        initial={{ strokeDashoffset: 2 * Math.PI * 16 }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </svg>
                  )}
                  {!reduceMotion && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ boxShadow: "0 0 16px rgba(56,189,248,0.4)" }}
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: isRevealed
                          ? isActive
                            ? 0.7
                            : isBlocked
                              ? 0.4
                              : isComplete
                                ? 0.5
                                : 0.25
                          : 0,
                        scale: isActive ? [1.2, 1.35, 1.2] : 1.1,
                      }}
                      transition={{
                        duration: isActive ? 1.2 : 0.4,
                        repeat: isActive ? Infinity : 0,
                        ease: "easeInOut",
                      }}
                    />
                  )}

                  <motion.div
                    className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-sky-300/40 bg-slate-950/90 shadow-md ${color}`}
                    initial={
                      !reduceMotion && isRevealed ? { opacity: 0 } : false
                    }
                    animate={{ opacity: 1 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.25,
                      delay: reduceMotion ? 0 : 0.35,
                    }}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-50">
                      {agent === "sre" ? "SRE" : agent[0].toUpperCase()}
                    </span>
                  </motion.div>
                </div>

                <div className="flex flex-col items-center gap-0.5 text-center">
                  <span className="text-xs font-semibold text-sky-100">
                    {getAgentById(agent)?.name ?? agent}
                  </span>
                  <span className="text-[10px] font-medium text-sky-200/90">
                    {stateLabel}
                  </span>
                  <span
                    className="text-[10px] text-sky-300/70"
                    title={getLoc(agent).name}
                  >
                    {formatLocationShort(getLoc(agent))}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
