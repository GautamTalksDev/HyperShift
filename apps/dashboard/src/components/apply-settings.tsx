"use client";

import { useEffect } from "react";
import { applySettings, getSettings } from "@/lib/settings";

export function ApplySettings() {
  useEffect(() => {
    applySettings(getSettings());
  }, []);
  return null;
}
