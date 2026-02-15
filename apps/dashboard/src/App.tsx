// UI THEME LOCKED

"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Rocket } from "lucide-react";
import { SabotageDemo } from "@/components/demos/SabotageDemo";
import { HappyPathDemo } from "@/components/demos/HappyPathDemo";
import { MissionControl } from "@/components/demos/MissionControl";

export default function App() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-10">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Rocket className="h-8 w-8 text-primary" />
            HyperShift
          </h1>
          <p className="mt-2 text-muted-foreground">
            Start a pipeline run: Architect → Builder → Sentinel → SRE → FinOps.
          </p>
        </header>

        <Tabs defaultValue="mission-control" className="w-full">
          <TabsList className="mb-4 w-full sm:w-auto">
            <TabsTrigger value="sabotage">Sabotage</TabsTrigger>
            <TabsTrigger value="happy-path">Happy Path</TabsTrigger>
            <TabsTrigger value="mission-control">Mission Control</TabsTrigger>
          </TabsList>
          <TabsContent value="sabotage">
            <SabotageDemo />
          </TabsContent>
          <TabsContent value="happy-path">
            <HappyPathDemo />
          </TabsContent>
          <TabsContent value="mission-control">
            <MissionControl />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
