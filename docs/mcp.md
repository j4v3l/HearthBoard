# HearthBoard MCP (stdio)

HearthBoard ships a local stdio Model Context Protocol (MCP) server that proxies the running HearthBoard REST API. The MCP process does not open SQLite directly, which avoids concurrent writers and reuses the same validation rules as the dashboard.

## Requirements

1. HearthBoard must already be running and reachable at `HEARTHBOARD_BASE_URL`.
2. The MCP client must support stdio transport.
3. The machine running MCP must be trusted. MCP grants dashboard-admin-equivalent access to services and settings.

Default API URL:

```text
http://127.0.0.1:3000
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `HEARTHBOARD_BASE_URL` | `http://127.0.0.1:3000` | Base URL for REST API calls made by the MCP server |

## Start the MCP server manually

```bash
npm run mcp
```

Diagnostics are written to stderr. stdout is reserved for MCP JSON-RPC traffic only.

## Generic MCP client configuration

Use your MCP client's stdio server configuration. The exact file format varies by client, but the command is always:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/HearthBoard/server/mcp/stdio.js"],
  "env": {
    "HEARTHBOARD_BASE_URL": "http://127.0.0.1:3000"
  }
}
```

If you installed dependencies in the repo, you can also point the client at the project root and run:

```json
{
  "command": "npm",
  "args": ["run", "mcp"],
  "cwd": "/absolute/path/to/HearthBoard"
}
```

## Tool catalog

### Read-only

| Tool | Description |
| --- | --- |
| `hearthboard_health` | API liveness probe |
| `hearthboard_ready` | Readiness probe including SQLite access |
| `hearthboard_get_settings` | Read dashboard header settings |
| `hearthboard_list_services` | List all services |
| `hearthboard_get_service` | Get one service by ID |

### CRUD and settings

| Tool | Description |
| --- | --- |
| `hearthboard_create_service` | Create a service |
| `hearthboard_update_service` | Update a service |
| `hearthboard_delete_service` | Delete a service (`confirm: true` required) |
| `hearthboard_update_settings` | Update dashboard header settings |
| `hearthboard_reorder_services` | Reorder all services |
| `hearthboard_import_services` | Bulk import up to 500 services (`confirm: true` required) |

### Operations with network side effects

| Tool | Description |
| --- | --- |
| `hearthboard_check_service` | Run one health check (outbound network request) |
| `hearthboard_check_all_services` | Run all health checks (`confirm: true` required) |

## Confirmation gates

These tools require `confirm: true`:

- `hearthboard_delete_service`
- `hearthboard_import_services`
- `hearthboard_check_all_services`

`hearthboard_delete_service` also verifies the target exists before deletion.

## Troubleshooting

### `NETWORK_ERROR` or connection refused

- Confirm HearthBoard is running: `curl http://127.0.0.1:3000/api/health`
- Verify `HEARTHBOARD_BASE_URL` matches the running app port and host.

### `CONFIRMATION_REQUIRED`

- Set `confirm: true` for destructive or bulk network operations listed above.

### MCP client shows no tools

- Ensure the client is configured for stdio transport, not HTTP.
- Check stderr from `npm run mcp` for startup errors.

## Security notes

- MCP is local-only via stdio. HearthBoard does not expose a remote `/mcp` HTTP endpoint.
- Anyone who can run the MCP process against a reachable HearthBoard instance can perform the same actions as the dashboard admin UI.
- Health-check tools can trigger outbound requests to URLs or hosts configured in your services.

See [SECURITY.md](../SECURITY.md) for the broader threat model.
