// UI THEME LOCKED

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { env } from "@/env";
import type {
  AgentId,
  AgentStates,
  Connection,
  DeploymentInfo,
  DeploymentState,
  LogEntry,
  LogLevel,
  AttackType,
  TemplateId,
} from "@/types";
import {
  agentOrder,
  attackScenarios,
  getAgentLocationsForRun,
  projectTemplates,
} from "@/utils/agents";

const INITIAL_AGENT_STATES: AgentStates = {
  architect: "idle",
  builder: "idle",
  sentinel: "idle",
  sre: "idle",
  finops: "idle",
};

const DELAY_MS = 450;
const LOG_CAP = 300;
const CONNECTIONS_CAP = 50;

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function pushLog(
  logs: LogEntry[],
  agent: AgentId,
  message: string,
  level: LogLevel = "info",
  location?: string,
): LogEntry[] {
  const next = [
    ...logs,
    { agent, message, level, timestamp: new Date().toISOString(), location },
  ];
  return next.length > LOG_CAP ? next.slice(-LOG_CAP) : next;
}

function pushConnection(
  connections: Connection[],
  from: AgentId,
  to: AgentId,
  active: boolean,
): Connection[] {
  const next = [
    ...connections,
    { from, to, active, timestamp: new Date().toISOString() },
  ];
  return next.length > CONNECTIONS_CAP ? next.slice(-CONNECTIONS_CAP) : next;
}

/**
 * Single brain for all demos. Manages workflow state and runs sequential pipeline
 * (architect → builder → sentinel → sre → finops) with optional sabotage path.
 * Uses AbortController so resetAll() cancels any ongoing simulation.
 */
export function useAgentOrchestrator() {
  const [agentStates, setAgentStates] = useState<AgentStates>({
    ...INITIAL_AGENT_STATES,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeCities, setActiveCities] = useState<string[]>([]);
  const [deployment, setDeployment] = useState<DeploymentInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "reconnecting" | "disconnected"
  >("connecting");

  const socketRef = useRef<Socket | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const simulationRunningRef = useRef(false);
  const [resetKey, setResetKey] = useState(0);

  // Socket: connection status only; demo state is driven by local simulation.
  useEffect(() => {
    const baseUrl =
      env?.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4001";
    const socket = io(baseUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setConnectionState("connected");
    });
    socket.on("disconnect", () => {
      setIsConnected(false);
      setConnectionState("disconnected");
    });
    socket.on("reconnect_attempt", () => setConnectionState("reconnecting"));
    socket.on("connect_error", () => {
      setConnectionState((prev) =>
        prev === "connected" ? "reconnecting" : prev,
      );
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const resetAll = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    simulationRunningRef.current = false;
    setAgentStates({ ...INITIAL_AGENT_STATES });
    setLogs([]);
    setConnections([]);
    setActiveCities([]);
    setDeployment(null);
    setResetKey((k) => k + 1);
  }, []);

  const runPipeline = useCallback(
    async (opts: {
      runId: string;
      prompt: string;
      isSabotage: boolean;
      signal: AbortSignal;
      onSuccess?: () => void;
    }) => {
      const { runId, prompt, isSabotage, signal, onSuccess } = opts;
      void prompt;
      let prev: AgentId | null = null;
      const agentLocations = getAgentLocationsForRun(runId);

      for (let i = 0; i < agentOrder.length; i++) {
        if (signal.aborted) {
          simulationRunningRef.current = false;
          return;
        }
        const agent = agentOrder[i];
        const loc = agentLocations[agent];
        const cityId = loc.id;

        setAgentStates((s) => ({ ...s, [agent]: "active" }));
        setActiveCities((arr) =>
          arr.includes(cityId) ? arr : [...arr, cityId],
        );
        if (prev) {
          setConnections((c) => pushConnection(c, prev!, agent, true));
        }
        setLogs((l) => pushLog(l, agent, `${agent} started`, "info", loc.name));

        if (signal.aborted) {
          simulationRunningRef.current = false;
          return;
        }
        await delay(DELAY_MS, signal);
        if (signal.aborted) {
          simulationRunningRef.current = false;
          return;
        }

        if (isSabotage && agent === "sentinel") {
          setLogs((l) =>
            pushLog(l, "sentinel", "Scanning deployment...", "info", loc.name),
          );
          if (signal.aborted) {
            simulationRunningRef.current = false;
            return;
          }
          await delay(DELAY_MS, signal);
          if (signal.aborted) {
            simulationRunningRef.current = false;
            return;
          }
          setLogs((l) =>
            pushLog(
              l,
              "sentinel",
              "Threat detected: failing health checks",
              "warn",
              loc.name,
            ),
          );
          setLogs((l) =>
            pushLog(
              l,
              "sentinel",
              "Blocking pipeline; rollback recommended",
              "error",
              loc.name,
            ),
          );
          setAgentStates((s) => ({ ...s, sentinel: "blocked" }));
          if (prev) {
            setConnections((c) => pushConnection(c, prev!, agent, false));
          }
          simulationRunningRef.current = false;
          return;
        }

        setAgentStates((s) => ({ ...s, [agent]: "complete" }));
        if (prev) {
          setConnections((c) => pushConnection(c, prev!, agent, false));
        }
        setLogs((l) =>
          pushLog(l, agent, `${agent} completed`, "info", loc.name),
        );
        prev = agent;

        if (signal.aborted) {
          simulationRunningRef.current = false;
          return;
        }
        await delay(DELAY_MS, signal);
        if (signal.aborted) {
          simulationRunningRef.current = false;
          return;
        }
      }

      setLogs((l) =>
        pushLog(l, "finops", `Workflow complete for run ${runId}`, "info"),
      );
      simulationRunningRef.current = false;
      onSuccess?.();
    },
    [],
  );

  const startMissionWorkflow = useCallback(
    async (prompt: string): Promise<string> => {
      const runId = `debug-run-${Math.random().toString(36).slice(2, 8)}`;
      if (simulationRunningRef.current) return runId;

      abortRef.current = new AbortController();
      simulationRunningRef.current = true;
      setAgentStates({ ...INITIAL_AGENT_STATES });
      setLogs([]);
      setConnections([]);
      setActiveCities([]);
      setDeployment(null);

      try {
        await runPipeline({
          runId,
          prompt,
          isSabotage: false,
          signal: abortRef.current.signal,
        });
      } catch {
        simulationRunningRef.current = false;
      }
      return runId;
    },
    [runPipeline],
  );

  const runHappyPath = useCallback(
    async (templateId: TemplateId): Promise<string> => {
      if (simulationRunningRef.current) {
        return `debug-run-${Math.random().toString(36).slice(2, 8)}`;
      }
      const template =
        projectTemplates.find((t) => t.id === templateId) ??
        projectTemplates[0];
      const scenario = attackScenarios.happy_path;
      const prompt = scenario.prompt || template.userIntent.description;
      const runId = `debug-run-${Math.random().toString(36).slice(2, 8)}`;

      abortRef.current = new AbortController();
      simulationRunningRef.current = true;
      setAgentStates({ ...INITIAL_AGENT_STATES });
      setLogs([]);
      setConnections([]);
      setActiveCities([]);
      setDeployment(null);

      const createDeployment = () => {
        const slug =
          prompt
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "") || "deployment";
        setDeployment({
          id: runId,
          url: `https://deploy.local/${slug}`,
          type: "happy_path",
        });
      };

      try {
        await runPipeline({
          runId,
          prompt,
          isSabotage: false,
          signal: abortRef.current.signal,
          onSuccess: createDeployment,
        });
      } catch {
        simulationRunningRef.current = false;
      }
      return runId;
    },
    [runPipeline],
  );

  const runSabotage = useCallback(
    async (attackType: AttackType): Promise<string> => {
      if (simulationRunningRef.current) {
        return `debug-run-${Math.random().toString(36).slice(2, 8)}`;
      }
      const scenario = attackScenarios[attackType] ?? attackScenarios.sabotage;
      const prompt = scenario.prompt;
      const runId = `debug-run-${Math.random().toString(36).slice(2, 8)}`;

      abortRef.current = new AbortController();
      simulationRunningRef.current = true;
      setAgentStates({ ...INITIAL_AGENT_STATES });
      setLogs([]);
      setConnections([]);
      setActiveCities([]);
      setDeployment(null);

      try {
        await runPipeline({
          runId,
          prompt,
          isSabotage: true,
          signal: abortRef.current.signal,
        });
      } catch {
        simulationRunningRef.current = false;
      }
      return runId;
    },
    [runPipeline],
  );

  const agentValues = Object.values(agentStates);
  const hasActive = agentValues.includes("active");
  const hasBlocked =
    agentValues.includes("blocked") || agentValues.includes("failed");
  const hasComplete = agentValues.includes("complete");

  let globalStatus: DeploymentState = "READY";
  if (hasBlocked) globalStatus = "BLOCKED";
  else if (hasActive) globalStatus = "RUNNING";
  else if (hasComplete) globalStatus = "COMPLETE";

  const isRunning = globalStatus === "RUNNING";

  return {
    isConnected,
    isRunning,
    agentStates,
    logs,
    connections,
    activeCities,
    deployment,
    globalStatus,
    connectionState,
    resetKey,
    startMissionWorkflow,
    runHappyPath,
    runSabotage,
    resetAll,
    startWorkflow: startMissionWorkflow,
    resetWorkflow: resetAll,
  };
}
