#!/usr/bin/env node

/**
 * Simple MCP Test Server
 * This is a basic MCP server for testing ContextGuard
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";

// Create server instance
const server = new Server(
  {
    name: "test-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool 1: Echo - Simple text echo (safe)
// Tool 2: Read File - Reads files (vulnerable to path traversal)
// Tool 3: Get Secret - Returns API key (vulnerable to data leakage)
// Tool 4: Execute Command - Runs commands (vulnerable to prompt injection)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "echo",
        description: "Echoes back the input text",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The message to echo back",
            },
          },
          required: ["message"],
        },
      },
      {
        name: "read_file",
        description: "Reads a file from the filesystem",
        inputSchema: {
          type: "object",
          properties: {
            filepath: {
              type: "string",
              description: "Path to the file to read",
            },
          },
          required: ["filepath"],
        },
      },
      {
        name: "get_config",
        description: "Gets application configuration (contains API keys)",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Configuration key to retrieve",
            },
          },
          required: ["key"],
        },
      },
      {
        name: "search_database",
        description: "Searches the user database",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "echo": {
        return {
          content: [
            {
              type: "text",
              text: `Echo: ${args.message}`,
            },
          ],
        };
      }

      case "read_file": {
        // VULNERABLE: No path validation!
        // An attacker could use: ../../../../etc/passwd
        const filepath = args.filepath;

        try {
          const content = await fs.readFile(filepath, "utf-8");
          return {
            content: [
              {
                type: "text",
                text: `File content:\n${content}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error reading file: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }

      case "get_config": {
        // VULNERABLE: Returns sensitive data!
        const configs = {
          api_key: "sk-1234567890abcdefghijklmnop",
          database_password: "super_secret_password_123",
          aws_secret: "AKIAIOSFODNN7EXAMPLE",
          stripe_key: "sk_live_51234567890",
        };

        return {
          content: [
            {
              type: "text",
              text: `Config value: ${configs[args.key] || "Not found"}`,
            },
          ],
        };
      }

      case "search_database": {
        // VULNERABLE: Could be manipulated via prompt injection
        const query = args.query;

        // Simulated database with sensitive info
        const users = [
          {
            id: 1,
            name: "John Doe",
            ssn: "123-45-6789",
            email: "john@example.com",
          },
          {
            id: 2,
            name: "Jane Smith",
            ssn: "987-65-4321",
            email: "jane@example.com",
          },
        ];

        return {
          content: [
            {
              type: "text",
              text: `Search results for "${query}":\n${JSON.stringify(
                users,
                null,
                2
              )}`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Test MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
