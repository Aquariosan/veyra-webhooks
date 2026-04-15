# veyra-webhooks

A webhook relay MCP tool for AI agents. Register target URLs, send payloads via HTTP, and browse send history. Reads are always free. Write operations require [Veyra](https://veyra.to) commit mode authorization.

## Overview

`veyra-webhooks` lets AI agents interact with external services through registered webhook endpoints. History is persisted in SQLite for auditing. Sending payloads and managing registrations require Veyra commit mode.

## Installation

```bash
npm install
npm run build
```

Data is stored at `~/.veyra-webhooks/data.db`, created automatically on first run.

## MCP Configuration (Claude Desktop)

```json
{
  "mcpServers": {
    "veyra-webhooks": {
      "command": "node",
      "args": ["/absolute/path/to/veyra-webhooks/dist/index.js"]
    }
  }
}
```

## Tools

| Tool | Input | Class | Price |
|------|-------|-------|-------|
| `list_webhooks` | `{}` | — | FREE |
| `get_history` | `{ webhook_id, limit? }` | — | FREE |
| `register_webhook` | `{ name, url, headers?, veyra_token? }` | A | €0.005 |
| `send_webhook` | `{ webhook_id, payload, method?, veyra_token? }` | B | €0.02 |
| `delete_webhook` | `{ webhook_id, veyra_token? }` | B | €0.02 |

## Examples

### Read (no token needed)

```json
// List all registered webhooks
{ "tool": "list_webhooks", "arguments": {} }

// View send history
{ "tool": "get_history", "arguments": { "webhook_id": "1712345678-abc1234", "limit": 20 } }
```

### Write (Veyra token required)

```json
// Register a webhook
{
  "tool": "register_webhook",
  "arguments": {
    "name": "Slack Notifications",
    "url": "https://hooks.slack.com/services/...",
    "headers": "{\"Authorization\": \"Bearer token123\"}",
    "veyra_token": "vt_..."
  }
}

// Send a payload (actually fires an HTTP request)
{
  "tool": "send_webhook",
  "arguments": {
    "webhook_id": "1712345678-abc1234",
    "payload": "{\"text\": \"Deployment complete\"}",
    "method": "POST",
    "veyra_token": "vt_..."
  }
}

// Delete a webhook (also clears its history)
{
  "tool": "delete_webhook",
  "arguments": {
    "webhook_id": "1712345678-abc1234",
    "veyra_token": "vt_..."
  }
}
```

### Error response when token is missing

```json
{
  "error": "VeyraCommitRequired",
  "message": "Write operations require Veyra commit mode.",
  "currentMode": "open",
  "requiredMode": "commit",
  "authorize_endpoint": "https://api.veyra.to/v1/authorize-action",
  "docs_url": "https://veyra.to"
}
```

## How Veyra Works

Veyra is a commit-mode authorization layer for AI agents. When an agent attempts a write:

1. The agent calls the tool without `veyra_token` → receives `VeyraCommitRequired` with `authorize_endpoint`.
2. The agent/user calls the authorize endpoint to obtain a token.
3. The agent retries with `veyra_token` set.
4. `veyra-webhooks` verifies the token via `@veyrahq/sdk-node` before executing the action.

See [veyra.to](https://veyra.to) for full documentation.

## License

MIT

## Part of the Veyra Ecosystem

Veyra is commit mode for production AI agent actions.
All tools: reads free, writes require Veyra commit mode.

| Tool | Description | Install |
|------|-------------|---------|
| [veyra-memory](https://github.com/Aquariosan/veyra-memory) | Key-value memory store | `npm i -g veyra-memory` |
| [veyra-notes](https://github.com/Aquariosan/veyra-notes) | Note-taking with tags | `npm i -g veyra-notes` |
| [veyra-tasks](https://github.com/Aquariosan/veyra-tasks) | Task management | `npm i -g veyra-tasks` |
| [veyra-snippets](https://github.com/Aquariosan/veyra-snippets) | Code snippet storage | `npm i -g veyra-snippets` |
| [veyra-bookmarks](https://github.com/Aquariosan/veyra-bookmarks) | Bookmark manager | `npm i -g veyra-bookmarks` |
| [veyra-contacts](https://github.com/Aquariosan/veyra-contacts) | Contact management | `npm i -g veyra-contacts` |
| [veyra-forms](https://github.com/Aquariosan/veyra-forms) | Form builder | `npm i -g veyra-forms` |

**SDK:** [npm install @veyrahq/sdk-node](https://www.npmjs.com/package/@veyrahq/sdk-node)
**Website:** [veyra.to](https://veyra.to)
