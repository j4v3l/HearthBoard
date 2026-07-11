import { z } from "zod";
import {
  errorToolResult,
  jsonToolResult,
  requireConfirmation,
} from "./api-client.js";
import {
  checkAllServicesSchema,
  deleteServiceSchema,
  importServicesSchema,
  reorderServicesSchema,
  serviceInputSchema,
  serviceUpdateSchema,
  settingsUpdateSchema,
} from "./schemas.js";

const READ_ONLY = { readOnlyHint: true };
const DESTRUCTIVE = { destructiveHint: true };
const IDEMPOTENT = { idempotentHint: true };
const OPEN_WORLD = { openWorldHint: true };

function safeHandler(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorToolResult(error);
    }
  };
}

export function createToolHandlers(client) {
  return {
    hearthboard_health: safeHandler(async () => jsonToolResult(await client.request("GET", "/api/health"))),

    hearthboard_ready: safeHandler(async () => jsonToolResult(await client.request("GET", "/api/ready"))),

    hearthboard_get_settings: safeHandler(async () => jsonToolResult(await client.request("GET", "/api/settings"))),

    hearthboard_update_settings: safeHandler(async (input) => jsonToolResult(await client.request("PATCH", "/api/settings", input))),

    hearthboard_list_services: safeHandler(async () => jsonToolResult(await client.request("GET", "/api/services"))),

    hearthboard_get_service: safeHandler(async ({ id }) => jsonToolResult(await client.request("GET", `/api/services/${id}`))),

    hearthboard_create_service: safeHandler(async (input) => jsonToolResult(await client.request("POST", "/api/services", input))),

    hearthboard_update_service: safeHandler(async ({ id, ...input }) => jsonToolResult(await client.request("PATCH", `/api/services/${id}`, input))),

    hearthboard_delete_service: safeHandler(async ({ id, confirm }) => {
      requireConfirmation(confirm, "deleting a service");
      await client.request("GET", `/api/services/${id}`);
      await client.request("DELETE", `/api/services/${id}`);
      return jsonToolResult({ deleted: true, id });
    }),

    hearthboard_reorder_services: safeHandler(async ({ ids }) => jsonToolResult(await client.request("POST", "/api/services/reorder", { ids }))),

    hearthboard_import_services: safeHandler(async ({ confirm, mode, services }) => {
      requireConfirmation(confirm, "importing services");
      return jsonToolResult(await client.request("POST", "/api/services/import", { mode, services }));
    }),

    hearthboard_check_service: safeHandler(async ({ id }) => jsonToolResult(await client.request("POST", `/api/services/${id}/check`))),

    hearthboard_check_all_services: safeHandler(async ({ confirm }) => {
      requireConfirmation(confirm, "checking all services");
      return jsonToolResult(await client.request("POST", "/api/services/check-all"));
    }),
  };
}

export const toolDefinitions = [
  {
    name: "hearthboard_health",
    config: {
      description: "Check whether the HearthBoard API process is alive.",
      annotations: READ_ONLY,
    },
    inputSchema: undefined,
  },
  {
    name: "hearthboard_ready",
    config: {
      description: "Check whether HearthBoard is ready to serve requests and can reach SQLite.",
      annotations: READ_ONLY,
    },
    inputSchema: undefined,
  },
  {
    name: "hearthboard_get_settings",
    config: {
      description: "Read dashboard header settings.",
      annotations: READ_ONLY,
    },
    inputSchema: undefined,
  },
  {
    name: "hearthboard_update_settings",
    config: {
      description: "Update dashboard header settings.",
    },
    inputSchema: settingsUpdateSchema,
  },
  {
    name: "hearthboard_list_services",
    config: {
      description: "List all monitored services in display order.",
      annotations: READ_ONLY,
    },
    inputSchema: undefined,
  },
  {
    name: "hearthboard_get_service",
    config: {
      description: "Get one monitored service by ID.",
      annotations: READ_ONLY,
    },
    inputSchema: {
      id: z.string().min(1).describe("Service ID"),
    },
  },
  {
    name: "hearthboard_create_service",
    config: {
      description: "Create a new monitored service.",
    },
    inputSchema: serviceInputSchema.shape,
  },
  {
    name: "hearthboard_update_service",
    config: {
      description: "Update an existing monitored service.",
    },
    inputSchema: {
      id: z.string().min(1).describe("Service ID"),
      ...serviceUpdateSchema.shape,
    },
  },
  {
    name: "hearthboard_delete_service",
    config: {
      description: "Delete a monitored service. Requires confirm=true.",
      annotations: { ...DESTRUCTIVE, ...IDEMPOTENT },
    },
    inputSchema: deleteServiceSchema,
  },
  {
    name: "hearthboard_reorder_services",
    config: {
      description: "Reorder services. The ids array must include every existing service ID exactly once.",
    },
    inputSchema: reorderServicesSchema.shape,
  },
  {
    name: "hearthboard_import_services",
    config: {
      description: "Import up to 500 services. Requires confirm=true.",
      annotations: DESTRUCTIVE,
    },
    inputSchema: importServicesSchema,
  },
  {
    name: "hearthboard_check_service",
    config: {
      description: "Run a health check for one service. This triggers an outbound network request.",
      annotations: OPEN_WORLD,
    },
    inputSchema: {
      id: z.string().min(1).describe("Service ID"),
    },
  },
  {
    name: "hearthboard_check_all_services",
    config: {
      description: "Run health checks for every enabled service. Requires confirm=true because it triggers outbound network requests.",
      annotations: { ...OPEN_WORLD, ...DESTRUCTIVE },
    },
    inputSchema: checkAllServicesSchema,
  },
];
