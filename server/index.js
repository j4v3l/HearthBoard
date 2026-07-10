import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createService,
  deleteService,
  getService,
  listServices,
  seedDatabase,
  updateService,
  updateServiceStatus,
} from "./db.js";
import { runHealthCheck } from "./health-checks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicPath = path.resolve(__dirname, "..", "dist");
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const categories = new Set(["AI", "Infrastructure", "Media", "Network", "Security"]);
const checkTypes = new Set(["HTTP", "Ping", "TCP", "None"]);
const statuses = new Set(["online", "offline", "slow", "unknown"]);

seedDatabase();

const app = Fastify({
  logger: true,
  trustProxy: true,
});

await app.register(rateLimit, {
  max: Number(process.env.RATE_LIMIT_MAX ?? 120),
  timeWindow: process.env.RATE_LIMIT_WINDOW ?? "1 minute",
});

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeService(input, existing = {}) {
  const service = {
    id: existing.id ?? randomUUID(),
    name: String(input.name ?? existing.name ?? "").trim(),
    description: String(input.description ?? existing.description ?? "").trim(),
    category: String(input.category ?? existing.category ?? "Infrastructure"),
    url: String(input.url ?? existing.url ?? "").trim(),
    healthUrl: String(input.healthUrl ?? existing.healthUrl ?? "").trim(),
    checkType: String(input.checkType ?? existing.checkType ?? "HTTP"),
    icon: String(input.icon ?? existing.icon ?? "Server"),
    status: String(input.status ?? existing.status ?? "unknown"),
    statusCheckEnabled: Boolean(input.statusCheckEnabled ?? existing.statusCheckEnabled ?? true),
    lastCheckedAt: existing.lastCheckedAt ?? null,
    responseTimeMs: existing.responseTimeMs ?? null,
  };

  if (!service.name) throw badRequest("Service name is required");
  if (!service.url) throw badRequest("Service URL is required");
  if (!categories.has(service.category)) throw badRequest("Invalid category");
  if (!checkTypes.has(service.checkType)) throw badRequest("Invalid check type");
  if (!statuses.has(service.status)) throw badRequest("Invalid status");

  try {
    new URL(service.url);
  } catch {
    throw badRequest("Service URL must be a valid URL");
  }

  if (service.healthUrl) {
    try {
      new URL(service.healthUrl);
    } catch {
      throw badRequest("Health URL must be a valid URL");
    }
  }

  return service;
}

app.get("/api/health", async () => ({ ok: true }));

app.get("/api/services", async () => listServices());

app.get("/api/services/:id", async (request, reply) => {
  const service = getService(request.params.id);
  if (!service) return reply.notFound("Service not found");
  return service;
});

app.post("/api/services", async (request, reply) => {
  const service = createService(normalizeService(request.body ?? {}));
  return reply.code(201).send(service);
});

app.patch("/api/services/:id", async (request, reply) => {
  const existing = getService(request.params.id);
  if (!existing) return reply.notFound("Service not found");
  const updated = updateService(request.params.id, normalizeService(request.body ?? {}, existing));
  return updated;
});

app.delete("/api/services/:id", async (request, reply) => {
  if (!deleteService(request.params.id)) return reply.notFound("Service not found");
  return reply.code(204).send();
});

app.post("/api/services/:id/check", async (request, reply) => {
  const service = getService(request.params.id);
  if (!service) return reply.notFound("Service not found");
  const result = await runHealthCheck(service);
  return updateServiceStatus(service.id, result.status, result.responseTimeMs);
});

app.post("/api/services/check-all", async () => {
  const checked = [];
  for (const service of listServices()) {
    const result = await runHealthCheck(service);
    checked.push(updateServiceStatus(service.id, result.status, result.responseTimeMs));
  }
  return checked;
});

await app.register(fastifyStatic, {
  root: publicPath,
  prefix: "/",
});

app.setNotFoundHandler((request, reply) => {
  if (request.raw.url?.startsWith("/api/")) {
    return reply.notFound("Route not found");
  }
  return reply.sendFile("index.html");
});

await app.listen({ port, host });
