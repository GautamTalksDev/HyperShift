"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Key, Loader2, Plus, Trash2 } from "lucide-react";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  function fetchKeys() {
    fetch("/api/api-keys")
      .then((r) => r.json())
      .then((data: { keys?: ApiKeyRow[] }) => setKeys(data.keys ?? []))
      .catch(() => setKeys([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function handleCreate() {
    if (!newName.trim() || creating) return;
    setCreating(true);
    setCreatedKey(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = (await res.json()) as { key?: string; error?: string };
      if (!res.ok) {
        alert(data.error ?? "Failed to create API key");
        return;
      }
      if (data.key) {
        setCreatedKey(data.key);
        setNewName("");
        fetchKeys();
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm("Revoke this API key? It will stop working immediately."))
      return;
    setRevoking(keyId);
    try {
      const res = await fetch(`/api/api-keys/${keyId}`, { method: "DELETE" });
      if (res.ok) fetchKeys();
      else alert("Failed to revoke");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Key className="h-7 w-7" />
          API keys
        </h1>
        <p className="text-sm text-muted-foreground">
          Use API keys to call the orchestrator (runs, usage, etc.) without
          logging in. Send as{" "}
          <code className="rounded bg-muted px-1">
            Authorization: Bearer hs_xxx...
          </code>{" "}
          or set{" "}
          <code className="rounded bg-muted px-1">HYPERSHIFT_API_KEY</code> in
          the CLI.
        </p>

        {createdKey && (
          <Card className="border-green-500/50 bg-green-500/10">
            <CardHeader>
              <CardTitle className="text-base">
                Key created — copy it now
              </CardTitle>
              <CardDescription>
                This value won&apos;t be shown again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <code className="block break-all rounded bg-muted px-3 py-2 text-sm">
                {createdKey}
              </code>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => {
                  navigator.clipboard.writeText(createdKey);
                  setCreatedKey(null);
                }}
              >
                Copy and dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create key</CardTitle>
            <CardDescription>
              Give the key a name (e.g. &quot;CLI&quot; or &quot;CI&quot;) so
              you can recognize it later.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. CLI"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="self-end gap-1.5"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create key
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your API keys</CardTitle>
            <CardDescription>
              Revoked keys stop working immediately. Keys are scoped to the
              current workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : keys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No API keys yet. Create one above.
              </p>
            ) : (
              <ul className="space-y-2">
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <span className="font-medium">{k.name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        hs_{k.key_prefix}_••••••••
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRevoke(k.id)}
                      disabled={revoking === k.id}
                    >
                      {revoking === k.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
