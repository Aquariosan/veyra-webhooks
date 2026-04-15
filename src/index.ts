#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as store from "./store.js";
import { requireVeyra } from "./veyra.js";

const server = new Server(
  { name: "veyra-webhooks", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_webhooks",
      description: "List all registered webhooks. FREE — no token required.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_history",
      description: "Get send history for a webhook. FREE — no token required.",
      inputSchema: {
        type: "object",
        properties: {
          webhook_id: { type: "string", description: "The webhook ID" },
          limit: { type: "number", description: "Max entries to return (default 50)" },
        },
        required: ["webhook_id"],
      },
    },
    {
      name: "register_webhook",
      description: "Register a new webhook URL. Requires Veyra commit mode (Class A — €0.005).",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Friendly name for the webhook" },
          url: { type: "string", description: "Target URL to send payloads to" },
          headers: {
            type: "string",
            description: "Optional JSON object of extra HTTP headers",
          },
          veyra_token: { type: "string", description: "Veyra authorization token" },
        },
        required: ["name", "url"],
      },
    },
    {
      name: "send_webhook",
      description:
        "Send a payload to a registered webhook URL. Requires Veyra commit mode (Class B — €0.02).",
      inputSchema: {
        type: "object",
        properties: {
          webhook_id: { type: "string", description: "The webhook ID to send to" },
          payload: { type: "string", description: "JSON payload to send" },
          method: {
            type: "string",
            enum: ["POST", "PUT", "PATCH", "GET"],
            description: "HTTP method (default: POST)",
          },
          veyra_token: { type: "string", description: "Veyra authorization token" },
        },
        required: ["webhook_id", "payload"],
      },
    },
    {
      name: "delete_webhook",
      description:
        "Delete a webhook and its history. Requires Veyra commit mode (Class B — €0.02).",
      inputSchema: {
        type: "object",
        properties: {
          webhook_id: { type: "string", description: "The webhook ID to delete" },
          veyra_token: { type: "string", description: "Veyra authorization token" },
        },
        required: ["webhook_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "list_webhooks": {
      const webhooks = store.listWebhooks();
      return {
        content: [{ type: "text", text: JSON.stringify({ count: webhooks.length, webhooks }) }],
      };
    }

    case "get_history": {
      const { webhook_id, limit } = args as { webhook_id: string; limit?: number };
      const history = store.getHistory(webhook_id, limit);
      return {
        content: [{ type: "text", text: JSON.stringify({ count: history.length, webhook_id, history }) }],
      };
    }

    case "register_webhook": {
      const { name: whName, url, headers, veyra_token } = args as {
        name: string;
        url: string;
        headers?: string;
        veyra_token?: string;
      };
      const check = await requireVeyra(veyra_token);
      if (!check.ok) {
        return { content: [{ type: "text", text: JSON.stringify(check.error, null, 2) }] };
      }
      const webhook = store.registerWebhook(whName, url, headers);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, commit_mode: "verified", ...webhook }) }],
      };
    }

    case "send_webhook": {
      const { webhook_id, payload, method, veyra_token } = args as {
        webhook_id: string;
        payload: string;
        method?: string;
        veyra_token?: string;
      };
      const check = await requireVeyra(veyra_token);
      if (!check.ok) {
        return { content: [{ type: "text", text: JSON.stringify(check.error, null, 2) }] };
      }
      try {
        const entry = await store.sendWebhook(webhook_id, payload, method ?? "POST");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                commit_mode: "verified",
                status_code: entry.status_code,
                response: entry.response,
                sent_at: entry.sent_at,
              }),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
        };
      }
    }

    case "delete_webhook": {
      const { webhook_id, veyra_token } = args as { webhook_id: string; veyra_token?: string };
      const check = await requireVeyra(veyra_token);
      if (!check.ok) {
        return { content: [{ type: "text", text: JSON.stringify(check.error, null, 2) }] };
      }
      const deleted = store.deleteWebhook(webhook_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, webhook_id, deleted, commit_mode: "verified" }),
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "UnknownTool", tool: name }) }],
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("veyra-webhooks server error:", err);
  process.exit(1);
});
