import http from "node:http";
import https from "node:https";
import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? 5000);
const slowThresholdMs = Number(process.env.SLOW_THRESHOLD_MS ?? 1500);
const allowInsecureTls = (process.env.ALLOW_INSECURE_TLS ?? "true").toLowerCase() === "true";

function elapsedStatus(startedAt) {
  const responseTimeMs = Date.now() - startedAt;
  return {
    status: responseTimeMs > slowThresholdMs ? "slow" : "online",
    responseTimeMs,
  };
}

function parseTarget(service) {
  const target = service.healthUrl || service.url;
  try {
    return new URL(target);
  } catch {
    return null;
  }
}

export async function checkHttp(service) {
  const target = parseTarget(service);
  if (!target || !["http:", "https:"].includes(target.protocol)) {
    return { status: "offline", responseTimeMs: null };
  }

  const startedAt = Date.now();
  const transport = target.protocol === "https:" ? https : http;
  const agent = target.protocol === "https:" ? new https.Agent({ rejectUnauthorized: !allowInsecureTls }) : undefined;

  return new Promise((resolve) => {
    const req = transport.request(target, { method: "GET", timeout: timeoutMs, agent }, (res) => {
      res.resume();
      res.on("end", () => {
        if (res.statusCode && res.statusCode < 500) {
          resolve(elapsedStatus(startedAt));
        } else {
          resolve({ status: "offline", responseTimeMs: Date.now() - startedAt });
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ status: "offline", responseTimeMs: timeoutMs });
    });
    req.on("error", () => resolve({ status: "offline", responseTimeMs: Date.now() - startedAt }));
    req.end();
  });
}

export async function checkTcp(service) {
  const target = parseTarget(service);
  const host = target?.hostname;
  const port = Number(target?.port);
  if (!host || !port) return { status: "offline", responseTimeMs: null };

  const startedAt = Date.now();
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.destroy();
      resolve(elapsedStatus(startedAt));
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ status: "offline", responseTimeMs: timeoutMs });
    });
    socket.once("error", () => resolve({ status: "offline", responseTimeMs: Date.now() - startedAt }));
  });
}

export async function checkPing(service) {
  const target = parseTarget(service);
  const host = target?.hostname;
  if (!host) return { status: "offline", responseTimeMs: null };

  const startedAt = Date.now();
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));

  try {
    await execFileAsync("ping", ["-c", "1", "-W", String(timeoutSeconds), host], { timeout: timeoutMs + 1000 });
    return elapsedStatus(startedAt);
  } catch {
    return { status: "offline", responseTimeMs: Date.now() - startedAt };
  }
}

export async function runHealthCheck(service) {
  if (!service.statusCheckEnabled || service.checkType === "None") {
    return { status: "unknown", responseTimeMs: null };
  }

  if (service.checkType === "HTTP") return checkHttp(service);
  if (service.checkType === "TCP") return checkTcp(service);
  if (service.checkType === "Ping") return checkPing(service);

  return { status: "unknown", responseTimeMs: null };
}
