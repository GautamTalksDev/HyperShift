// Operation-style codenames for runs (e.g. "Operation Phoenix")
const CODENAMES = [
  "Phoenix",
  "Falcon",
  "Mercury",
  "Apollo",
  "Atlas",
  "Titan",
  "Orion",
  "Nova",
  "Vanguard",
  "Sentinel",
  "Horizon",
  "Apex",
  "Pinnacle",
  "Summit",
  "Beacon",
  "Forge",
  "Catalyst",
  "Nexus",
  "Vertex",
  "Pulse",
  "Flux",
  "Spark",
  "Echo",
  "Ripple",
];

export function generateCodename(): string {
  const name = CODENAMES[Math.floor(Math.random() * CODENAMES.length)];
  return `Operation ${name}`;
}
