import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HearthboardApiClient } from "../server/mcp/api-client.js";
import { callHearthboardTool, createHearthboardMcpServer } from "../server/mcp/server.js";
import { toolDefinitions } from "../server/mcp/tools.js";
import { withTestServer } from "./helpers/test-server.js";

function parseToolText(result) {
  assert.equal(result.content.length, 1);
  return JSON.parse(result.content[0].text);
}

describe("MCP tool handlers", () => {
  it("registers every planned tool", () => {
    const names = toolDefinitions.map((tool) => tool.name);
    assert.deepEqual(names, [
      "hearthboard_health",
      "hearthboard_ready",
      "hearthboard_get_settings",
      "hearthboard_update_settings",
      "hearthboard_list_services",
      "hearthboard_get_service",
      "hearthboard_create_service",
      "hearthboard_update_service",
      "hearthboard_delete_service",
      "hearthboard_reorder_services",
      "hearthboard_import_services",
      "hearthboard_check_service",
      "hearthboard_check_all_services",
    ]);
    const server = createHearthboardMcpServer();
    assert.ok(server);
  });

  it("requires confirmation before delete", async () => {
    await withTestServer(async ({ baseUrl }) => {
      const client = new HearthboardApiClient(baseUrl);
      const createResult = await callHearthboardTool("hearthboard_create_service", {
        name: "MCP Delete Me",
        category: "Infrastructure",
        checkType: "None",
      }, client);
      const created = parseToolText(createResult);

      const denied = await callHearthboardTool("hearthboard_delete_service", {
        id: created.id,
        confirm: false,
      }, client);
      assert.equal(denied.isError, true);
      const deniedBody = parseToolText(denied);
      assert.equal(deniedBody.error.code, "CONFIRMATION_REQUIRED");

      const allowed = await callHearthboardTool("hearthboard_delete_service", {
        id: created.id,
        confirm: true,
      }, client);
      assert.notEqual(allowed.isError, true);
      assert.equal(parseToolText(allowed).deleted, true);
    });
  });

  it("performs create, get, update, list, and delete CRUD", async () => {
    await withTestServer(async ({ baseUrl }) => {
      const client = new HearthboardApiClient(baseUrl);

      const health = parseToolText(await callHearthboardTool("hearthboard_health", {}, client));
      assert.equal(health.ok, true);

      const created = parseToolText(await callHearthboardTool("hearthboard_create_service", {
        name: "MCP CRUD",
        description: "created by test",
        category: "Network",
        checkType: "None",
      }, client));
      assert.equal(created.name, "MCP CRUD");

      const fetched = parseToolText(await callHearthboardTool("hearthboard_get_service", { id: created.id }, client));
      assert.equal(fetched.id, created.id);

      const updated = parseToolText(await callHearthboardTool("hearthboard_update_service", {
        id: created.id,
        description: "updated by test",
      }, client));
      assert.equal(updated.description, "updated by test");

      const listed = parseToolText(await callHearthboardTool("hearthboard_list_services", {}, client));
      assert.ok(listed.some((service) => service.id === created.id));

      const deleted = parseToolText(await callHearthboardTool("hearthboard_delete_service", {
        id: created.id,
        confirm: true,
      }, client));
      assert.equal(deleted.deleted, true);

      const missing = await callHearthboardTool("hearthboard_delete_service", {
        id: created.id,
        confirm: true,
      }, client);
      assert.equal(missing.isError, true);
      assert.equal(parseToolText(missing).error.code, "NOT_FOUND");
    });
  });

  it("updates settings and reorders services", async () => {
    await withTestServer(async ({ baseUrl }) => {
      const client = new HearthboardApiClient(baseUrl);

      const first = parseToolText(await callHearthboardTool("hearthboard_create_service", {
        name: "Alpha",
        category: "Infrastructure",
        checkType: "None",
      }, client));
      const second = parseToolText(await callHearthboardTool("hearthboard_create_service", {
        name: "Beta",
        category: "Infrastructure",
        checkType: "None",
      }, client));

      const settings = parseToolText(await callHearthboardTool("hearthboard_update_settings", {
        dashboardName: "MCP Dashboard",
      }, client));
      assert.equal(settings.dashboardName, "MCP Dashboard");

      const reordered = parseToolText(await callHearthboardTool("hearthboard_reorder_services", {
        ids: [second.id, first.id],
      }, client));
      assert.equal(reordered[0].id, second.id);

      await callHearthboardTool("hearthboard_delete_service", { id: first.id, confirm: true }, client);
      await callHearthboardTool("hearthboard_delete_service", { id: second.id, confirm: true }, client);
    });
  });

  it("requires confirmation for import and check-all", async () => {
    await withTestServer(async ({ baseUrl }) => {
      const client = new HearthboardApiClient(baseUrl);

      const importDenied = await callHearthboardTool("hearthboard_import_services", {
        confirm: false,
        services: [{ name: "Imported", category: "Infrastructure", checkType: "None" }],
      }, client);
      assert.equal(importDenied.isError, true);

      const importAllowed = parseToolText(await callHearthboardTool("hearthboard_import_services", {
        confirm: true,
        services: [{ name: "Imported", category: "Infrastructure", checkType: "None" }],
      }, client));
      assert.equal(importAllowed.created, 1);

      const checkAllDenied = await callHearthboardTool("hearthboard_check_all_services", {
        confirm: false,
      }, client);
      assert.equal(checkAllDenied.isError, true);

      const checkAllAllowed = await callHearthboardTool("hearthboard_check_all_services", {
        confirm: true,
      }, client);
      assert.notEqual(checkAllAllowed.isError, true);

      const services = parseToolText(await callHearthboardTool("hearthboard_list_services", {}, client));
      for (const service of services) {
        await callHearthboardTool("hearthboard_delete_service", { id: service.id, confirm: true }, client);
      }
    });
  });
});
