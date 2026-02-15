const KEY = "hypershift_settings";

export interface DashboardSettings {
  reducedMotion: boolean;
  highContrast: boolean;
  sound: boolean;
  haptics: boolean;
  notifications: boolean;
}

const defaults: DashboardSettings = {
  reducedMotion: false,
  highContrast: false,
  sound: false,
  haptics: false,
  notifications: false,
};

export function getSettings(): DashboardSettings {
  try {
    if (typeof window === "undefined") return defaults;
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<DashboardSettings>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults as DashboardSettings;
  }
}

export function setSettings(s: Partial<DashboardSettings>): void {
  try {
    if (typeof window === "undefined") return;
    const next = { ...getSettings(), ...s };
    localStorage.setItem(KEY, JSON.stringify(next));
    applySettings(next);
  } catch {
    // ignore
  }
}

export function applySettings(s: DashboardSettings): void {
  try {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("reduce-motion", s.reducedMotion);
    root.classList.toggle("high-contrast", s.highContrast);
  } catch {
    // ignore
  }
}

export function playStepSound(kind: "complete" | "fail"): void {
  if (
    getSettings().sound &&
    typeof window !== "undefined" &&
    window.AudioContext
  ) {
    try {
      const ctx = new window.AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = kind === "complete" ? 523 : 200;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore
    }
  }
}

/** Short system-beep style tone (e.g. per boot line). Respects sound setting. */
export function playBootBeep(): void {
  if (
    !getSettings().sound ||
    typeof window === "undefined" ||
    !window.AudioContext
  )
    return;
  try {
    const ctx = new window.AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    // ignore
  }
}

/** Agent started tone. */
export function playAgentStartedSound(): void {
  if (
    !getSettings().sound ||
    typeof window === "undefined" ||
    !window.AudioContext
  )
    return;
  try {
    const ctx = new window.AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // ignore
  }
}

/** Agent completed tone. */
export function playAgentCompletedSound(): void {
  if (
    !getSettings().sound ||
    typeof window === "undefined" ||
    !window.AudioContext
  )
    return;
  try {
    const ctx = new window.AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 523;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // ignore
  }
}

/** Agent blocked tone. */
export function playAgentBlockedSound(): void {
  if (
    !getSettings().sound ||
    typeof window === "undefined" ||
    !window.AudioContext
  )
    return;
  try {
    const ctx = new window.AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 200;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // ignore
  }
}

/** Optional "mission complete" sting. */
export function playMissionCompleteSting(): void {
  if (
    !getSettings().sound ||
    typeof window === "undefined" ||
    !window.AudioContext
  )
    return;
  try {
    const ctx = new window.AudioContext();
    const play = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + start + dur,
      );
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    play(523, 0, 0.15);
    play(659, 0.12, 0.15);
    play(784, 0.24, 0.2);
  } catch {
    // ignore
  }
}

/** Optional "mission failed" sting. */
export function playMissionFailedSting(): void {
  if (
    !getSettings().sound ||
    typeof window === "undefined" ||
    !window.AudioContext
  )
    return;
  try {
    const ctx = new window.AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 220;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // ignore
  }
}

export function triggerHaptic(): void {
  if (
    getSettings().haptics &&
    typeof navigator !== "undefined" &&
    navigator.vibrate
  ) {
    try {
      navigator.vibrate(10);
    } catch {
      // ignore
    }
  }
}

/** Show browser notification when run completes/fails, if user has enabled notifications. */
export function notifyRunOutcome(
  runId: string,
  status: "completed" | "failed" | "blocked",
): void {
  if (
    !getSettings().notifications ||
    typeof window === "undefined" ||
    !("Notification" in window)
  )
    return;
  try {
    if (Notification.permission === "granted") {
      new Notification("HyperShift", {
        body: `Run ${runId} ${status}.`,
        tag: `run-${runId}`,
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") {
          new Notification("HyperShift", {
            body: `Run ${runId} ${status}.`,
            tag: `run-${runId}`,
          });
        }
      });
    }
  } catch {
    // ignore
  }
}
