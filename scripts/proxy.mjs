#!/usr/bin/env node
/**
 * Single-port reverse proxy for the HyperShift backend.
 * Listens on PORT and forwards:
 *   /api/*  -> http://127.0.0.1:4000/*  (API)
 *   /*      -> http://127.0.0.1:4001/*  (Orchestrator)
 * Used when deploying API + Orchestrator behind one URL (e.g. Render, Railway).
 */
import http from "http";

const API_PORT = 4000;
const ORCHESTRATOR_PORT = 4001;
const PORT = Number(process.env.PORT) || 3001;

function proxy(req, res, targetPort, pathRewrite = null) {
  const path = pathRewrite ? pathRewrite(req.url) : req.url;
  const opts = {
    hostname: "127.0.0.1",
    port: targetPort,
    path,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${targetPort}` },
  };
  const proxyReq = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", (err) => {
    console.error(`[proxy] ${req.method} ${req.url} -> :${targetPort} error:`, err.message);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Bad Gateway", message: err.message }));
  });
  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/api")) {
    proxy(req, res, API_PORT, (url) => (url || "").replace(/^\/api/, "") || "/");
  } else {
    proxy(req, res, ORCHESTRATOR_PORT);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[proxy] Listening on 0.0.0.0:${PORT} -> API :${API_PORT}, Orchestrator :${ORCHESTRATOR_PORT}`);
});
