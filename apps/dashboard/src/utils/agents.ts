// UI THEME LOCKED

import type {
  Agent,
  AgentId,
  AgentStatus,
  AttackType,
  TemplateId,
} from "@/types";

// Canonical list of the five worker agents used in the dashboard.
// Colors reuse existing palette tokens – no new colors are introduced here.
export const agents: Agent[] = [
  { id: "architect", name: "Architect", color: "indigo-500" },
  { id: "builder", name: "Builder", color: "sky-400" },
  { id: "sentinel", name: "Sentinel", color: "amber-500" },
  { id: "sre", name: "SRE", color: "red-500" },
  { id: "finops", name: "FinOps", color: "emerald-500" },
];

// The canonical left-to-right order used across neural network and pipeline views.
export const agentOrder: AgentId[] = [
  "architect",
  "builder",
  "sentinel",
  "sre",
  "finops",
];

// High-level attack / scenario presets (4 attacks) for sabotage and happy-path demos.
export const attackScenarios: Record<
  AttackType,
  { id: AttackType; label: string; description: string; prompt: string }
> = {
  happy_path: {
    id: "happy_path",
    label: "Happy path",
    description:
      "Clean pipeline run where Architect → Builder → Sentinel → SRE → FinOps all complete successfully.",
    prompt:
      "Deploy a simple Next.js landing page to a local environment using free tier resources only.",
  },
  sabotage: {
    id: "sabotage",
    label: "Sabotage demo",
    description:
      "Simulated bad deploy where failing health checks force Sentinel and SRE to intervene and recommend rollback.",
    prompt:
      "Deploy app with sabotage demo: inject failing health checks so SRE detects incident and recommends rollback.",
  },
  timeout: {
    id: "timeout",
    label: "Timeout scenario",
    description:
      "Simulated timeout so SRE and Sentinel detect and recommend rollback.",
    prompt:
      "Deploy app with sabotage demo: inject timeout so SRE detects incident and recommends rollback.",
  },
  rollback: {
    id: "rollback",
    label: "Rollback scenario",
    description:
      "Simulated partial failure triggering rollback recommendation.",
    prompt:
      "Deploy app with sabotage demo: inject partial failure so SRE detects incident and recommends rollback.",
  },
};

// Project templates (4) for happy-path and demo flows.
export interface ProjectTemplate {
  id: TemplateId;
  label: string;
  description: string;
  userIntent: {
    description: string;
    target?: string;
    constraints?: string;
  };
}

export const projectTemplates: ProjectTemplate[] = [
  {
    id: "nextjs-landing-happy-path",
    label: "Happy path landing page",
    description:
      "Deploy a simple Next.js landing page to a local environment using free tier only.",
    userIntent: {
      description: "Deploy a simple Next.js landing page",
      target: "local",
      constraints: "use free tier only",
    },
  },
  {
    id: "sabotage-demo",
    label: "Sabotage deploy",
    description:
      "Deploy an app with sabotage demo enabled so SRE can detect failing health checks and recommend rollback.",
    userIntent: {
      description: "Deploy app with sabotage demo",
      target: "local",
      constraints: "",
    },
  },
  {
    id: "nextjs-api-free-tier",
    label: "Next.js API (free tier)",
    description: "Deploy a Next.js API to local using free tier only.",
    userIntent: {
      description: "Deploy a Next.js API",
      target: "local",
      constraints: "use free tier only",
    },
  },
  {
    id: "static-site-local",
    label: "Static site (local)",
    description: "Deploy a static site to a local environment.",
    userIntent: {
      description: "Deploy a static site",
      target: "local",
      constraints: "",
    },
  },
];

// Agent location (city) for globe and pipeline views. Same palette/regions as UI – do not change.
export type AgentCityRegion = "na" | "eu" | "apac" | "latam" | "me";

export interface AgentLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region: AgentCityRegion;
}

const AGENT_REGIONS: Record<AgentId, AgentCityRegion> = {
  architect: "na",
  builder: "eu",
  sentinel: "me",
  sre: "apac",
  finops: "latam",
};

// Default five (used for static fallback when no run).
const CITIES: AgentLocation[] = [
  { id: "na-hq", name: "New York", lat: 40.7128, lon: -74.006, region: "na" },
  { id: "eu-hq", name: "London", lat: 51.5074, lon: -0.1278, region: "eu" },
  {
    id: "apac-hq",
    name: "Singapore",
    lat: 1.3521,
    lon: 103.8198,
    region: "apac",
  },
  {
    id: "latam-hq",
    name: "São Paulo",
    lat: -23.5505,
    lon: -46.6333,
    region: "latam",
  },
  { id: "me-hq", name: "Dubai", lat: 25.2048, lon: 55.2708, region: "me" },
];

/** Cities by region: each run picks one city per region so every run has 5 different countries/regions. */
const REGIONS_ORDER: AgentCityRegion[] = ["na", "eu", "apac", "latam", "me"];

const CITIES_BY_REGION: Record<AgentCityRegion, AgentLocation[]> = {
  na: [
    { id: "na-ny", name: "New York", lat: 40.7128, lon: -74.006, region: "na" },
    {
      id: "na-sf",
      name: "San Francisco",
      lat: 37.7749,
      lon: -122.4194,
      region: "na",
    },
    {
      id: "na-toronto",
      name: "Toronto",
      lat: 43.6532,
      lon: -79.3832,
      region: "na",
    },
    {
      id: "na-chicago",
      name: "Chicago",
      lat: 41.8781,
      lon: -87.6298,
      region: "na",
    },
  ],
  eu: [
    {
      id: "eu-london",
      name: "London",
      lat: 51.5074,
      lon: -0.1278,
      region: "eu",
    },
    {
      id: "eu-frankfurt",
      name: "Frankfurt",
      lat: 50.1109,
      lon: 8.6821,
      region: "eu",
    },
    { id: "eu-paris", name: "Paris", lat: 48.8566, lon: 2.3522, region: "eu" },
    {
      id: "eu-amsterdam",
      name: "Amsterdam",
      lat: 52.3676,
      lon: 4.9041,
      region: "eu",
    },
  ],
  apac: [
    {
      id: "apac-singapore",
      name: "Singapore",
      lat: 1.3521,
      lon: 103.8198,
      region: "apac",
    },
    {
      id: "apac-tokyo",
      name: "Tokyo",
      lat: 35.6762,
      lon: 139.6503,
      region: "apac",
    },
    {
      id: "apac-sydney",
      name: "Sydney",
      lat: -33.8688,
      lon: 151.2093,
      region: "apac",
    },
    {
      id: "apac-hongkong",
      name: "Hong Kong",
      lat: 22.3193,
      lon: 114.1694,
      region: "apac",
    },
  ],
  latam: [
    {
      id: "latam-saopaulo",
      name: "São Paulo",
      lat: -23.5505,
      lon: -46.6333,
      region: "latam",
    },
    {
      id: "latam-mexico",
      name: "Mexico City",
      lat: 19.4326,
      lon: -99.1332,
      region: "latam",
    },
    {
      id: "latam-bogota",
      name: "Bogotá",
      lat: 4.711,
      lon: -74.0721,
      region: "latam",
    },
    {
      id: "latam-buenosaires",
      name: "Buenos Aires",
      lat: -34.6037,
      lon: -58.3816,
      region: "latam",
    },
  ],
  me: [
    { id: "me-dubai", name: "Dubai", lat: 25.2048, lon: 55.2708, region: "me" },
    {
      id: "me-telaviv",
      name: "Tel Aviv",
      lat: 32.0853,
      lon: 34.7818,
      region: "me",
    },
    {
      id: "me-mumbai",
      name: "Mumbai",
      lat: 19.076,
      lon: 72.8777,
      region: "me",
    },
    {
      id: "me-johannesburg",
      name: "Johannesburg",
      lat: -26.2041,
      lon: 28.0473,
      region: "me",
    },
  ],
};

const LOCATION_FOR_AGENT: Record<AgentId, AgentLocation> = {
  architect: CITIES.find((c) => c.region === AGENT_REGIONS.architect)!,
  builder: CITIES.find((c) => c.region === AGENT_REGIONS.builder)!,
  sentinel: CITIES.find((c) => c.region === AGENT_REGIONS.sentinel)!,
  sre: CITIES.find((c) => c.region === AGENT_REGIONS.sre)!,
  finops: CITIES.find((c) => c.region === AGENT_REGIONS.finops)!,
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Next LCG step (deterministic). */
function nextSeed(seed: number): number {
  return (seed * 1103515245 + 12345) & 0x7fffffff;
}

/** Deterministic index in [0, n) from seed. */
function indexFromSeed(n: number, seed: number): number {
  return seed % n;
}

/** Deterministic shuffle of indices [0..n-1] using seed (LCG). */
function shuffledIndices(n: number, seed: number): number[] {
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    seed = nextSeed(seed);
    const j = seed % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/**
 * Agent → location mapping for this pipeline/run. Picks one city per region (NA, EU, APAC, LATAM, ME)
 * from the pool, then assigns them to agents in a shuffled order. Every run gets a different
 * set of countries/regions/places (which city per region + which agent gets which region both vary by runId).
 */
export function getAgentLocationsForRun(
  runId: string,
): Record<AgentId, AgentLocation> {
  let seed = hashString(runId);
  // Pick one city per region (deterministic per runId)
  const fiveByRegion: AgentLocation[] = REGIONS_ORDER.map((region) => {
    const cities = CITIES_BY_REGION[region];
    const idx = indexFromSeed(cities.length, seed);
    seed = nextSeed(seed);
    return cities[idx]!;
  });
  // Shuffle which agent gets which of the 5 (so every run has a different assignment)
  const agentPerm = shuffledIndices(5, seed);
  const out = {} as Record<AgentId, AgentLocation>;
  agentOrder.forEach((agent, i) => {
    out[agent] = fiveByRegion[agentPerm[i]!]!;
  });
  return out;
}

export function getAgentById(id: AgentId): Agent | undefined {
  return agents.find((a) => a.id === id);
}

export function getAgentLocation(id: AgentId): AgentLocation {
  return LOCATION_FOR_AGENT[id];
}

/** Display label for location: "New York (NA)" or "London (EU)". */
export function formatLocationDisplay(loc: AgentLocation): string {
  const region = loc.region.toUpperCase();
  return `${loc.name} (${region})`;
}

/** Status-based node color for neural mesh / pipeline (UI theme – do not change). */
export function getStatusColor(state: AgentStatus): string {
  if (state === "blocked" || state === "failed") return "bg-red-500";
  if (state === "complete") return "bg-emerald-500";
  if (state === "active") return "bg-sky-400";
  return "bg-slate-600";
}
