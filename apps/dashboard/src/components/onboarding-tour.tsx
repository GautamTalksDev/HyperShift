"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const TOUR_STORAGE_KEY = "hypershift_tour_done";

const STEPS = [
  {
    id: "start",
    title: "Start pipeline",
    body: "Use the form or Happy Path / Sabotage Deploy to start a run. You'll be taken to the run page with Command center.",
  },
  {
    id: "command",
    title: "Command center",
    body: "On the run page you'll see a 3D globe, agent network, and FinOps cost. Use Focus mode to hide 3D and focus on pipeline + audit + outputs.",
  },
  {
    id: "audit",
    title: "Audit log",
    body: "Click 'View audit log' for the full timeline. The audit log shows every pipeline event with details.",
  },
  {
    id: "outputs",
    title: "Outputs",
    body: "Blueprint, BuildPlan, SecurityReport, SREStatus, and FinOpsReport are in the Outputs tabs. Use Replay to re-run the same intent.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (localStorage.getItem(TOUR_STORAGE_KEY)) return;
      setOpen(true);
    } catch {
      setOpen(false);
    }
  }, []);

  const finish = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (!open) return null;

  const current = STEPS[step];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      aria-modal="true"
      role="dialog"
    >
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h2 className="text-lg font-semibold">Welcome to HyperShift</h2>
          <Button variant="ghost" size="sm" onClick={finish}>
            Skip
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quick tour: {current?.title}
          </p>
          <p className="text-sm">{current?.body}</p>
          <div className="flex justify-between pt-2">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Step ${i + 1}`}
                  className={`h-2 w-2 rounded-full transition-colors ${i === step ? "bg-primary" : "bg-muted"}`}
                  onClick={() => setStep(i)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep((s) => s - 1)}
                >
                  Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                  Next
                </Button>
              ) : (
                <Button size="sm" onClick={finish}>
                  Done
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function resetOnboardingTour(): void {
  try {
    if (typeof window !== "undefined")
      localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    // ignore
  }
}
