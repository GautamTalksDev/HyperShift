"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

export default function StyleTestPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted to-background">
      <div className="max-w-md px-4">
        <Card className="border-2 shadow-xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Tailwind + shadcn check</CardTitle>
              <p className="text-sm text-muted-foreground">
                Card, Button, and Icon should all be styled.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you can see the gradient background, rounded card, and a
              primary button below, your Tailwind + shadcn/ui setup is working
              inside the dashboard app.
            </p>
            <Button className="w-full gap-2">
              <Rocket className="h-4 w-4" />
              Launch test run
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
