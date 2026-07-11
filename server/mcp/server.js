import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HearthboardApiClient } from "./api-client.js";
import { createToolHandlers, toolDefinitions } from "./tools.js";

export function createHearthboardMcpServer(client = new HearthboardApiClient()) {
  const server = new McpServer({
    name: "hearthboard",
    version: "1.0.0",
  });

  const handlers = createToolHandlers(client);

  for (const tool of toolDefinitions) {
    server.registerTool(
      tool.name,
      {
        ...tool.config,
        inputSchema: tool.inputSchema,
      },
      handlers[tool.name],
    );
  }

  return server;
}

export async function callHearthboardTool(name, args = {}, client = new HearthboardApiClient()) {
  const handlers = createToolHandlers(client);
  if (!handlers[name]) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handlers[name](args);
}
