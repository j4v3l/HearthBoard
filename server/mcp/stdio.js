#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHearthboardMcpServer } from "./server.js";
import { HearthboardApiClient } from "./api-client.js";

async function main() {
  const client = new HearthboardApiClient();
  const server = createHearthboardMcpServer(client);
  const transport = new StdioServerTransport();

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });

  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start HearthBoard MCP server:", error);
  process.exit(1);
});
