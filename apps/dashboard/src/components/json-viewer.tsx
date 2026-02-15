"use client";

import { cn } from "@/lib/utils";

export function JsonViewer({
  data,
  className,
}: {
  data: unknown;
  className?: string;
}) {
  const str =
    data == null
      ? "null"
      : typeof data === "string"
        ? data
        : JSON.stringify(data, null, 2);
  return (
    <ScrollArea
      className={cn(
        "max-h-[420px] rounded-md border bg-muted/30 p-3 font-mono text-xs",
        className,
      )}
    >
      <pre className="whitespace-pre break-all text-foreground">
        {str.split("\n").map((line, i) => (
          <JsonLine key={i} line={line} />
        ))}
      </pre>
    </ScrollArea>
  );
}

function JsonLine({ line }: { line: string }) {
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;
  if (/^"[^"]*":\s/.test(trimmed)) {
    const match = trimmed.match(/^("[^"]*"):\s(.*)$/);
    const key = match?.[1] ?? "";
    const rest = match?.[2] ?? trimmed;
    return (
      <span>
        {" ".repeat(indent)}
        <span className="text-amber-700 dark:text-amber-400">{key}</span>
        <span className="text-muted-foreground">: </span>
        <span className={valueClass(rest)}>{rest}</span>
        {"\n"}
      </span>
    );
  }
  return (
    <span>
      {" ".repeat(indent)}
      <span className={valueClass(trimmed)}>{trimmed}</span>
      {"\n"}
    </span>
  );
}

function valueClass(part: string): string {
  const p = part.trim();
  if (p === "true" || p === "false") return "text-blue-600 dark:text-blue-400";
  if (p === "null") return "text-muted-foreground";
  if (/^-?\d+(\.\d+)?$/.test(p))
    return "text-emerald-600 dark:text-emerald-400";
  if (p.startsWith('"') && p.endsWith('"'))
    return "text-rose-600 dark:text-rose-400";
  return "text-foreground";
}

// Inline ScrollArea to avoid circular ref - use a simple div for this component
function ScrollArea({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("overflow-auto", className)}>{children}</div>;
}
