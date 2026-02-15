/**
 * In-memory state for demo: when true, GET /health returns 500.
 * POST /sabotage toggles this value.
 */
let healthSabotaged = false;

export function isHealthSabotaged(): boolean {
  return healthSabotaged;
}

export function toggleHealthSabotage(): boolean {
  healthSabotaged = !healthSabotaged;
  return healthSabotaged;
}
