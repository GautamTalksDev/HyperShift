"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  getSettings,
  setSettings,
  applySettings,
  type DashboardSettings,
} from "@/lib/settings";
import { Settings } from "lucide-react";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<DashboardSettings>(getSettings());

  useEffect(() => {
    applySettings(getSettings());
  }, []);

  const update = (patch: Partial<DashboardSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    setSettings(next);
    applySettings(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Settings className="h-4 w-4" /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby="settings-description">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription id="settings-description">
            Accessibility, sound, and haptic options.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <p
            className="text-xs text-muted-foreground rounded-md border border-dashed bg-muted/30 p-3"
            role="note"
          >
            API keys are not required today — the pipeline runs with mock/stub
            agents. When real LLM or API integrations are added, keys can be
            configured via environment variables or a future settings screen.
          </p>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="reduced-motion">Reduce motion</Label>
            <input
              id="reduced-motion"
              type="checkbox"
              checked={s.reducedMotion}
              onChange={(e) => update({ reducedMotion: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="high-contrast">High contrast</Label>
            <input
              id="high-contrast"
              type="checkbox"
              checked={s.highContrast}
              onChange={(e) => update({ highContrast: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="sound">Sound (step complete/fail)</Label>
            <input
              id="sound"
              type="checkbox"
              checked={s.sound}
              onChange={(e) => update({ sound: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="haptics">Haptic feedback</Label>
            <input
              id="haptics"
              type="checkbox"
              checked={s.haptics}
              onChange={(e) => update({ haptics: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="notifications">
              Notifications (run complete/fail)
            </Label>
            <input
              id="notifications"
              type="checkbox"
              checked={s.notifications}
              onChange={(e) => update({ notifications: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
