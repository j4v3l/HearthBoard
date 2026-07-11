#!/usr/bin/env node
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startTestServer } from "../tests/helpers/test-server.js";

function parseToolResult(result) {
  assert.equal(result.content?.length, 1);
  return JSON.parse(result.content[0].text);
}

const server = await startTestServer();

try {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["server/mcp/stdio.js"],
    env: {
      ...process.env,
      HEARTHBOARD_BASE_URL: server.baseUrl,
    },
    stderr: "pipe",
  });

  const client = new Client({ name: "hearthboard-mcp-smoke", version: "1.0.0" });
  await client.connect(transport);

  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  assert.ok(toolNames.includes("hearthboard_list_services"));
  assert.ok(toolNames.includes("hearthboard_create_service"));
  assert.ok(toolNames.includes("hearthboard_delete_service"));

  const health = parseToolResult(await client.callTool({ name: "hearthboard_health", arguments: {} }));
  assert.equal(health.ok, true);

  const created = parseToolResult(await client.callTool({
    name: "hearthboard_create_service",
    arguments: {
      name: "Smoke Test Service",
      category: "Infrastructure",
      checkType: "None",
    },
  }));
  assert.equal(created.name, "Smoke Test Service");

  const updated = parseToolResult(await client.callTool({
    name: "hearthboard_update_service",
    arguments: {
      id: created.id,
      description: "updated by smoke test",
    },
  }));
  assert.equal(updated.description, "updated by smoke test");

  const deleteDenied = await client.callTool({
    name: "hearthboard_delete_service",
    arguments: {
      id: created.id,
      confirm: false,
    },
  });
  assert.equal(deleteDenied.isError, true);

  const deleted = parseToolResult(await client.callTool({
    name: "hearthboard_delete_service",
    arguments: {
      id: created.id,
      confirm: true,
    },
  }));
  assert.equal(deleted.deleted, true);

  await client.close();
  console.log("MCP smoke test passed");
} finally {
  await server.cleanup();
}
